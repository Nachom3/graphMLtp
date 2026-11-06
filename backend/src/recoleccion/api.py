"""Transporte HTTP (FastAPI): punto de entrada al mismo código reutilizable.

Toda la lógica vive en aplicación/adaptadores; acá solo hay validación
de formas (Pydantic), traducción a tipos de dominio y códigos de error
estables del contrato docs/contracts/api-v1.md.
"""
from __future__ import annotations

from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .adaptadores import (
    CsvLectorDataset,
    NetworkxPlanificador,
    PredictorReglaV1,
    SklearnEvaluador,
    crear_predictor_demo,
)
from .aplicacion import (
    ProtocoloEvaluacion,
    comparar_modelos,
    planificar_recoleccion,
    predecir_prioridades,
    validar_cargar_dataset,
)
from .dominio import (
    ConfigRecorrido,
    DatasetInvalido,
    RecorridoImposible,
    TramoFeatures,
)

VERSION = "v1"


class TramoIn(BaseModel):
    tramo_id: str
    nodo_origen: str
    nodo_destino: str
    longitud_m: float = Field(gt=0)
    tipo_zona: Literal["residencial", "comercial", "industrial"]
    cantidad_contenedores: int = Field(ge=0)
    dias_desde_ultima_recoleccion: int = Field(ge=0)
    historico_quejas_vecinales: int = Field(ge=0)


class NodoIn(BaseModel):
    nodo_id: str
    lon: float
    lat: float


class FilaMLIn(TramoIn):
    prioridad_recoleccion: Literal["baja", "media", "alta"] | None = None


def _a_tramo(t: TramoIn) -> TramoFeatures:
    return TramoFeatures(
        tramo_id=t.tramo_id, nodo_origen=t.nodo_origen,
        nodo_destino=t.nodo_destino, longitud_m=t.longitud_m,
        tipo_zona=t.tipo_zona, cantidad_contenedores=t.cantidad_contenedores,
        dias_desde_ultima_recoleccion=t.dias_desde_ultima_recoleccion,
        historico_quejas_vecinales=t.historico_quejas_vecinales)


def crear_app() -> FastAPI:
    app = FastAPI(title="Recolección de residuos (TP grafos + ML)",
                  version=VERSION)

    @app.get("/salud")
    def salud() -> dict:
        return {"estado": "ok", "version": VERSION, "esquema": "v1"}

    @app.post("/dataset/validar")
    def validar_dataset(body: dict) -> dict:
        fuente = str(body.get("fuente", ""))
        version = str(body.get("version_esquema", "v1"))
        try:
            nodos, tramos = validar_cargar_dataset(
                fuente, version, CsvLectorDataset())
        except DatasetInvalido as e:
            raise HTTPException(status_code=422, detail={
                "codigo": "DATASET_INVALIDO", "detalle": str(e)}) from e
        return {"valido": True, "n_nodos": len(nodos), "n_tramos": len(tramos)}

    @app.post("/modelos/comparar")
    def comparar(body: dict) -> dict:
        filas = list(body.get("filas", []))
        configs = list(body.get("configs", ["arbol", "logistica"]))
        semilla = int(body.get("semilla", 0))
        try:
            comp = comparar_modelos(
                filas, configs, ProtocoloEvaluacion(semilla=semilla),
                SklearnEvaluador())
        except (ValueError, Exception) as e:
            raise HTTPException(status_code=422, detail={
                "codigo": "EVALUACION_INVALIDA", "detalle": str(e)}) from e
        def _metrica(m):
            # numpy.int64 no es JSON serializable: convertir a tipos planos.
            return {
                "modelo_id": m.modelo_id,
                "accuracy": float(m.accuracy),
                "precision_macro": float(m.precision_macro),
                "recall_macro": float(m.recall_macro),
                "f1_macro": float(m.f1_macro),
                "matriz_confusion": [[int(x) for x in fila]
                                     for fila in m.matriz_confusion],
                "n_train": int(m.n_train),
                "n_test": int(m.n_test),
            }

        return {
            "metricas": [_metrica(m) for m in comp.metricas],
            "baseline_accuracy": float(comp.baseline_accuracy),
            "mejor_por_cv": comp.mejor_por_cv,
            "registro": comp.registro,
        }

    @app.post("/predicciones:predecir")
    def predecir(body: dict) -> dict:
        modelo_id = str(body.get("modelo_id", "arbol"))
        tramos = [_a_tramo(TramoIn(**t)) for t in body.get("tramos", [])]
        filas_raw = body.get("filas_entrenamiento", [])
        try:
            if modelo_id == "regla-v1":
                preds = predecir_prioridades(
                    modelo_id, tramos, PredictorReglaV1())
            else:
                if not filas_raw:
                    raise HTTPException(status_code=422, detail={
                        "codigo": "MODELO_DESCONOCIDO",
                        "detalle": "sin filas_entrenamiento para modelo sklearn"})
                predictor = crear_predictor_demo(modelo_id, filas_raw)
                preds = predecir_prioridades(modelo_id, tramos, predictor)
        except HTTPException:
            raise
        except (ValueError, DatasetInvalido) as e:
            raise HTTPException(status_code=422, detail={
                "codigo": "PREDICCION_SIN_TRAMO", "detalle": str(e)}) from e
        return {"modelo_id": modelo_id, "predicciones": [
            {"tramo_id": p.tramo_id, "prioridad": p.prioridad} for p in preds]}

    @app.post("/recorridos:planificar")
    def planificar(body: dict) -> dict:
        nodos = list(body.get("nodos", []))
        tramos = [_a_tramo(TramoIn(**t)) for t in body.get("tramos", [])]
        prioridades = body.get("prioridades", {})
        incluir = tuple(body.get("incluir", ["media", "alta"]))
        from .dominio import TramoPredicho

        preds = [TramoPredicho(tid, pri)  # type: ignore[arg-type]
                 for tid, pri in prioridades.items()]
        try:
            rec = planificar_recoleccion(
                nodos, tramos, preds,
                ConfigRecorrido(incluir=incluir), NetworkxPlanificador())
        except RecorridoImposible as e:
            raise HTTPException(status_code=422, detail={
                "codigo": "RECORRIDO_IMPOSIBLE", "detalle": str(e)}) from e
        return {"orden": list(rec.orden),
                "repeticiones": list(rec.repeticiones),
                "costo_total_m": rec.costo_total_m, "unidad": rec.unidad}

    return app


app = crear_app()
