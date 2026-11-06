"""Adaptadores: CSV, scikit-learn, networkx, artefactos locales.

Todo lo científico (pandas, sklearn, networkx) vive acá, detrás de los
contratos de aplicación. Dominio/aplicación no importan esto.
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

from .aplicacion import ComparacionModelos, MetricasModelo, ProtocoloEvaluacion
from .dominio import (
    ConfigRecorrido,
    DatasetInvalido,
    Recorrido,
    RecorridoImposible,
    TramoFeatures,
    TramoPredicho,
    etiqueta_v1,
)

COLUMNAS_TRAMOS = (
    "tramo_id", "nodo_origen", "nodo_destino", "longitud_m", "tipo_zona",
    "cantidad_contenedores", "dias_desde_ultima_recoleccion",
    "historico_quejas_vecinales", "prioridad_recoleccion",
)
FEATURES = (
    "tipo_zona", "cantidad_contenedores",
    "dias_desde_ultima_recoleccion", "historico_quejas_vecinales",
)
TARGET = "prioridad_recoleccion"
CLASES = ("baja", "media", "alta")

# sklearn acepta 0/1 aquí en runtime; el stub de tipos solo declara str.
_CERO_DIV: Any = 0


# ------------------------------------------------------------ lector CSV
class CsvLectorDataset:
    """Lee nodos.csv + tramos.csv (esquema v1) desde un directorio.

    Sustituye a LectorMemoria de tests sin tocar el caso de uso.
    """

    def cargar(self, fuente: str, schema_version: str) -> tuple[list[dict], list[TramoFeatures]]:
        base = Path(fuente)
        nodos_p = base / "nodos.csv"
        tramos_p = base / "tramos.csv"
        try:
            nodos = list(csv.DictReader(nodos_p.read_text(encoding="utf-8").splitlines()))
            filas = list(csv.DictReader(tramos_p.read_text(encoding="utf-8").splitlines()))
        except OSError as e:
            raise DatasetInvalido(f"fuente ilegible {fuente!r}: {e}") from e
        tramos: list[TramoFeatures] = []
        for r in filas:
            try:
                tramos.append(TramoFeatures(
                    tramo_id=r["tramo_id"],
                    nodo_origen=r["nodo_origen"],
                    nodo_destino=r["nodo_destino"],
                    longitud_m=float(r["longitud_m"]),
                    tipo_zona=r["tipo_zona"],  # type: ignore[arg-type]
                    cantidad_contenedores=int(r["cantidad_contenedores"]),
                    dias_desde_ultima_recoleccion=int(r["dias_desde_ultima_recoleccion"]),
                    historico_quejas_vecinales=int(r["historico_quejas_vecinales"]),
                ))
            except (KeyError, ValueError) as e:
                raise DatasetInvalido(f"fila inválida {r!r}: {e}") from e
        return nodos, tramos


def filas_para_ml(tramos: list[TramoFeatures], etiquetas: dict[str, str]) -> list[dict]:
    """Une features + etiqueta construida para evaluación (solo demo/#10)."""
    filas: list[dict] = []
    for t in tramos:
        filas.append({
            "tipo_zona": t.tipo_zona,
            "cantidad_contenedores": t.cantidad_contenedores,
            "dias_desde_ultima_recoleccion": t.dias_desde_ultima_recoleccion,
            "historico_quejas_vecinales": t.historico_quejas_vecinales,
            "prioridad_recoleccion": etiquetas[t.tramo_id],
        })
    return filas


# ------------------------------------------------------- predictor regla v1
class PredictorReglaV1:
    """Predictor demo sin sklearn: aplica la regla construida v1.

    Sirve para probar planificación sin entrenar (no es ML).
    """

    def __init__(self, modelo_id: str = "regla-v1") -> None:
        self._id = modelo_id

    @property
    def modelo_id(self) -> str:
        return self._id

    def predecir(self, tramos: list[TramoFeatures]) -> list[TramoPredicho]:
        return [TramoPredicho(t.tramo_id, etiqueta_v1(
            t.dias_desde_ultima_recoleccion, t.historico_quejas_vecinales,
            t.cantidad_contenedores, t.tipo_zona)) for t in tramos]


# ------------------------------------------------------------- sklearn
def _hacer_pipeline(config: str, semilla: int):
    if config == "arbol":
        pre = ColumnTransformer([
            ("cat", OneHotEncoder(handle_unknown="ignore"), ["tipo_zona"]),
        ], remainder="passthrough")
        return make_pipeline(pre, DecisionTreeClassifier(random_state=semilla))
    if config == "logistica":
        pre = ColumnTransformer([
            ("cat", OneHotEncoder(handle_unknown="ignore"), ["tipo_zona"]),
            ("num", StandardScaler(), ["cantidad_contenedores",
             "dias_desde_ultima_recoleccion", "historico_quejas_vecinales"]),
        ])
        return make_pipeline(pre, LogisticRegression(max_iter=1000, random_state=semilla))
    raise ValueError(f"config desconocida: {config!r} (usar 'arbol' o 'logistica')")


class SklearnPredictor:
    """Predictor sklearn entrenado offline sobre filas completas."""

    def __init__(self, modelo_id: str, filas: list[dict], semilla: int = 0) -> None:
        self._id = modelo_id
        df = pd.DataFrame(filas)
        self._pipe = _hacer_pipeline(modelo_id, semilla)
        self._pipe.fit(df[list(FEATURES)], df[TARGET])
        self._cols = list(FEATURES)

    @property
    def modelo_id(self) -> str:
        return self._id

    def predecir(self, tramos: list[TramoFeatures]) -> list[TramoPredicho]:
        df = pd.DataFrame([{
            "tipo_zona": t.tipo_zona,
            "cantidad_contenedores": t.cantidad_contenedores,
            "dias_desde_ultima_recoleccion": t.dias_desde_ultima_recoleccion,
            "historico_quejas_vecinales": t.historico_quejas_vecinales,
        } for t in tramos], index=[t.tramo_id for t in tramos])
        preds = self._pipe.predict(df[self._cols])
        return [TramoPredicho(tid, p) for tid, p in zip(df.index, preds, strict=True)]


class SklearnEvaluador:
    """Evaluación reproducible: holdout estratificado + CV sobre train.

    La elección del mejor modelo usa SOLO el CV-train; el test se reporta
    una vez. Todo lo que aprende va dentro del Pipeline (anti-leakage).
    """

    def evaluar(self, filas: list[dict], configs: list[str],
            protocolo: ProtocoloEvaluacion) -> ComparacionModelos:
        df = pd.DataFrame(filas)
        X, y = df[list(FEATURES)], df[TARGET]
        Xtr, Xte, ytr, yte = train_test_split(
            X, y, test_size=protocolo.test_size,
            random_state=protocolo.semilla,
            stratify=y if protocolo.estratificado else None)
        # CV ajustado al tamaño real del train (fixture chico -> menos folds).
        min_clase = int(pd.Series(ytr).value_counts().min())
        cv = max(2, min(protocolo.cv_folds, len(ytr), min_clase))
        mayoria = str(pd.Series(ytr).mode().iloc[0])
        baseline = float(accuracy_score(yte, [mayoria] * len(yte)))
        metricas: list[MetricasModelo] = []
        cv_medias: dict[str, float] = {}
        for cfg in configs:
            pipe = _hacer_pipeline(cfg, protocolo.semilla)
            cv_medias[cfg] = float(cross_val_score(
                pipe, Xtr, ytr, cv=cv, scoring="accuracy").mean())
            pipe.fit(Xtr, ytr)
            p = pipe.predict(Xte)
            metricas.append(MetricasModelo(
                modelo_id=cfg,
                accuracy=float(accuracy_score(yte, p)),
                precision_macro=float(precision_score(yte, p, average="macro", zero_division=_CERO_DIV)),
                recall_macro=float(recall_score(yte, p, average="macro", zero_division=_CERO_DIV)),
                f1_macro=float(f1_score(yte, p, average="macro", zero_division=_CERO_DIV)),
                matriz_confusion=tuple(map(tuple, confusion_matrix(yte, p, labels=list(CLASES)))),
                n_train=len(ytr), n_test=len(yte)))
        mejor = max(configs, key=lambda c: cv_medias[c])
        registro = {
            "n_filas": len(filas),
            "test_size": protocolo.test_size,
            "semilla": protocolo.semilla,
            "cv_folds_pedidos": protocolo.cv_folds,
            "cv_folds_usados": cv,
            "cv_accuracy_media_train": cv_medias,
            "baseline_mayoria_test": baseline,
            "versiones": {
                "python": sys.version.split()[0],
                "sklearn": sklearn.__version__,
                "pandas": pd.__version__,
            },
        }
        return ComparacionModelos(tuple(metricas), baseline, mejor, registro)


def crear_predictor_demo(config: str, filas: list[dict], semilla: int = 0):
    """Dos modelos de demostración: 'arbol' o 'logistica' (sklearn)."""
    return SklearnPredictor(config, filas, semilla)


# ------------------------------------------------------------- grafos
class NetworkxPlanificador:
    """Hierholzer si el subgrafo es euleriano; si no, cartero chino.

    Emparejamiento mínimo con networkx (aclarado en el informe, como pide
    el enunciado). Repeticiones y costo en metros.
    """

    def planificar(self, nodos, tramos, prioridades, config: ConfigRecorrido) -> Recorrido:
        import networkx as nx

        mapa = {p.tramo_id: p.prioridad for p in prioridades}
        sel = {t.tramo_id for t in tramos if mapa.get(t.tramo_id) in config.incluir}
        if not sel:
            raise RecorridoImposible("ningún tramo coincide con el criterio")
        long_m = {t.tramo_id: t.longitud_m for t in tramos}
        extremos = {t.tramo_id: (t.nodo_origen, t.nodo_destino) for t in tramos}

        G = nx.MultiGraph()
        for t in tramos:
            if t.tramo_id in sel:
                G.add_edge(t.nodo_origen, t.nodo_destino, key=t.tramo_id,
                           weight=t.longitud_m)
        if G.number_of_edges() == 0:
            raise RecorridoImposible("subgrafo seleccionado vacío")
        if not nx.is_connected(G):
            raise RecorridoImposible("subgrafo seleccionado desconexo")

        duplicados: list[str] = []
        if not nx.is_eulerian(G):
            # Cartero chino: caminos mínimos entre impares (grafo completo
            # para poder pasar por tramos no seleccionados) + matching mínimo.
            Fall = nx.MultiGraph()
            for t in tramos:
                Fall.add_edge(t.nodo_origen, t.nodo_destino, key=t.tramo_id,
                              weight=t.longitud_m)
            impares = [n for n, d in G.degree() if d % 2 == 1]
            pares: dict[tuple[str, str], list[str]] = {}
            H = nx.Graph()
            for i, a in enumerate(impares):
                for b in impares[i + 1:]:
                    camino = nx.shortest_path(Fall, a, b, weight="weight")
                    costo = nx.shortest_path_length(Fall, a, b, weight="weight")
                    tids: list[str] = []
                    # camino tiene n nodos y camino[1:] n-1: strict=False
                    # es intencional (aristas entre nodos consecutivos).
                    for u, v in zip(camino, camino[1:], strict=False):
                        e = min(Fall.get_edge_data(u, v).items(),
                                key=lambda kv: kv[1]["weight"])
                        tids.append(str(e[0]))
                    pares[(a, b)] = tids
                    H.add_edge(a, b, weight=costo)
            matching = nx.min_weight_matching(H)
            for a, b in matching:
                key = (a, b) if (a, b) in pares else (b, a)
                for tid in pares[key]:
                    u, v = extremos[tid]
                    G.add_edge(u, v, key=tid, weight=long_m[tid])
                    duplicados.append(tid)

        circuito = list(nx.eulerian_circuit(G, keys=True))
        orden = tuple(e[2] for e in circuito)
        costo = sum(long_m[tid] for tid in orden)
        vistos: list[str] = []
        for tid in orden:
            if orden.count(tid) > 1 and tid not in vistos:
                vistos.append(tid)
        return Recorrido(orden=orden, repeticiones=tuple(vistos),
                         costo_total_m=float(costo))


# ------------------------------------------------- artefactos locales
def guardar_registro(path: str, comparacion) -> None:
    Path(path).write_text(json.dumps(comparacion.registro, indent=2,
                                     ensure_ascii=False), encoding="utf-8")
