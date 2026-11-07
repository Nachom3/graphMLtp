"""Aplicación: casos de uso y contratos pequeños definidos por quienes los consumen.

Cada contrato es un Protocol mínimo (ISP/DIP): quien solo predice no conoce
entrenamiento. Cada abstracción se justifica con una sustitución concreta
(ver docstring de cada Protocol). Orquestación en funciones puras; sin HTTP,
sin pandas, sin sklearn, sin networkx acá.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .dominio import (
    ConfigRecorrido,
    DatasetInvalido,
    Recorrido,
    RecorridoImposible,
    TramoFeatures,
    TramoPredicho,
    asociar_predicciones,
    validar_tramo_features,
)


# ---------------------------------------------------------------- contratos
class LectorDataset(Protocol):
    """Lee nodos/tramos desde una fuente.

    Sustitución concreta: CsvLectorDataset (pandas) <-> LectorMemoria (tests)
    sin modificar el caso de uso validar_cargar_dataset.
    """

    def cargar(self, fuente: str, schema_version: str) -> tuple[list[dict], list[TramoFeatures]]:
        """Devuelve (nodos, tramos). Lanza DatasetInvalido si es ilegible."""
        ...


class EvaluadorModelos(Protocol):
    """Compara configuraciones de modelo con protocolo reproducible.

    Sustitución concreta: SklearnEvaluador <-> EvaluadorFalso (tests, sin sklearn).
    """

    def evaluar(
        self,
        filas: list[dict],
        configs: list[str],
        protocolo: ProtocoloEvaluacion,
    ) -> ComparacionModelos:
        ...


class PredictorPrioridades(Protocol):
    """Predice prioridades dado un modelo identificado.

    Sustitución concreta: SklearnPredictor <-> PredictorReglaV1 (usa la regla
    construida) <-> PredictorFalso. Quien predice no conoce entrenamiento.
    """

    @property
    def modelo_id(self) -> str: ...

    def predecir(self, tramos: list[TramoFeatures]) -> list[TramoPredicho]: ...


class PlanificadorRecorrido(Protocol):
    """Resuelve el recorrido sobre el grafo con prioridades dadas.

    Sustitución concreta: NetworkxPlanificador <-> PlanificadorFalso (grafo
    lineal de juguete). Verificado con las mismas pruebas de contrato (LSP).
    """

    def planificar(
        self,
        nodos: list[dict],
        tramos: list[TramoFeatures],
        prioridades: list[TramoPredicho],
        config: ConfigRecorrido,
    ) -> Recorrido:
        ...


# ------------------------------------------------------------------- tipos
@dataclass(frozen=True)
class ProtocoloEvaluacion:
    test_size: float = 0.25
    semilla: int = 0
    cv_folds: int = 5  # CV sobre entrenamiento (nunca sobre test)
    estratificado: bool = True


@dataclass(frozen=True)
class MetricasModelo:
    modelo_id: str
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    matriz_confusion: tuple[tuple[int, ...], ...]
    n_train: int
    n_test: int


@dataclass(frozen=True)
class ComparacionModelos:
    metricas: tuple[MetricasModelo, ...]
    baseline_accuracy: float  # predecir siempre la mayoría
    mejor_por_cv: str  # modelo_id elegido SOLO con CV-train, nunca con test
    registro: dict  # dataset, partición, parámetros, versiones


# --------------------------------------------------------------- casos de uso
def validar_cargar_dataset(
    fuente: str,
    schema_version: str,
    lector: LectorDataset,
) -> tuple[list[dict], list[TramoFeatures]]:
    """Valida/carga dataset: (fuente, versión) -> datos válidos o errores.

    Precondiciones: schema_version == "v1"; fuente no vacía.
    Errores: DatasetInvalido (fuente ilegible, esquema incompatible, invariantes).
    Efectos secundarios: solo lectura de la fuente. Sin red ni servidor.
    """
    if not fuente:
        raise DatasetInvalido("fuente vacía")
    if schema_version != "v1":
        raise DatasetInvalido(
            f"schema_version incompatible: {schema_version!r} (se esperaba 'v1')")
    nodos, tramos = lector.cargar(fuente, schema_version)
    if not tramos:
        raise DatasetInvalido("dataset sin tramos")
    errores: list[str] = []
    for t in tramos:
        errores.extend(validar_tramo_features(t))
    if errores:
        raise DatasetInvalido("; ".join(errores[:10]))
    return nodos, tramos


def comparar_modelos(
    filas: list[dict],
    configs: list[str],
    protocolo: ProtocoloEvaluacion,
    evaluador: EvaluadorModelos,
) -> ComparacionModelos:
    """Dataset + configs + protocolo -> métricas, baseline y metadatos.

    Precondiciones: >=6 filas, >=2 clases, configs no vacío.
    No selecciona modelos ajustándose al test: mejor_por_cv sale del CV-train.
    Efectos: cómputo offline (NO llamar desde una consulta de visualización).
    """
    if not configs:
        raise ValueError("configs vacío")
    if len(filas) < 6:
        raise ValueError("se necesitan >= 6 filas para comparar")
    return evaluador.evaluar(filas, configs, protocolo)


def predecir_prioridades(
    modelo_id: str,
    tramos: list[TramoFeatures],
    predictor: PredictorPrioridades,
) -> list[TramoPredicho]:
    """Modelo identificado + features válidas -> prioridad por tramo.

    Garantiza asociación inequívoca tramo<->prioridad (delega en dominio).
    Errores: PrediccionSinTramo si el predictor devuelve algo inconsistente.
    Sin efectos secundarios; inferencia separada de entrenamiento offline.
    """
    if predictor.modelo_id != modelo_id:
        raise ValueError(
            f"predictor {predictor.modelo_id!r} no es el modelo {modelo_id!r}")
    for t in tramos:
        errs = validar_tramo_features(t)
        if errs:
            raise DatasetInvalido("; ".join(errs[:5]))
    preds = predictor.predecir(tramos)
    # Re-verificación en el borde: nunca confiar ciegamente en el adaptador.
    return asociar_predicciones(
        [p.tramo_id for p in preds], [p.prioridad for p in preds])


def planificar_recoleccion(
    nodos: list[dict],
    tramos: list[TramoFeatures],
    prioridades: list[TramoPredicho],
    config: ConfigRecorrido,
    planificador: PlanificadorRecorrido,
) -> Recorrido:
    """Grafo + prioridades + config -> recorrido o causa de imposibilidad.

    Precondiciones: >=1 tramo seleccionado por el criterio; prioridades
    cubren esos tramos. Errores: RecorridoImposible (vacío, desconexo...).
    Sin efectos secundarios.
    """
    mapa = {p.tramo_id: p.prioridad for p in prioridades}
    sel = [t for t in tramos if mapa.get(t.tramo_id) in config.incluir]
    if not sel:
        raise RecorridoImposible("ningún tramo coincide con el criterio")
    faltan = [t.tramo_id for t in sel if t.tramo_id not in mapa]
    if faltan:
        raise RecorridoImposible(f"tramos sin prioridad: {faltan[:5]}")
    return planificador.planificar(nodos, tramos, prioridades, config)


__all__ = [
    "ComparacionModelos",
    "EvaluadorModelos",
    "LectorDataset",
    "MetricasModelo",
    "PlanificadorRecorrido",
    "PredictorPrioridades",
    "ProtocoloEvaluacion",
    "comparar_modelos",
    "planificar_recoleccion",
    "predecir_prioridades",
    "validar_cargar_dataset",
]
