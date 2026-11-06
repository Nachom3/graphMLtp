"""Composición: construcción e inyección explícita de dependencias.

Sin contenedores DI ni factories abstractas (KISS/YAGNI): funciones que
arman cada caso de uso con sus adaptadores concretos.
"""
from __future__ import annotations

from .adaptadores import (
    CsvLectorDataset,
    NetworkxPlanificador,
    PredictorReglaV1,
    SklearnEvaluador,
    SklearnPredictor,
    crear_predictor_demo,
    filas_para_ml,
)
from .aplicacion import (
    ProtocoloEvaluacion,
    comparar_modelos,
    planificar_recoleccion,
    predecir_prioridades,
    validar_cargar_dataset,
)
from .dominio import ConfigRecorrido


def cargar_dataset_v1(fuente: str):
    """Caso de uso validar/cargar con el lector CSV real."""
    return validar_cargar_dataset(fuente, "v1", CsvLectorDataset())


def comparar_demos(filas: list[dict], semilla: int = 0):
    """Compara 'arbol' vs 'logistica' con el protocolo reproducible."""
    return comparar_modelos(
        filas, ["arbol", "logistica"],
        ProtocoloEvaluacion(semilla=semilla), SklearnEvaluador())


def predecir_con(modelo_id: str, filas: list[dict], tramos, semilla: int = 0):
    """Predice con un modelo demo sklearn, o 'regla-v1' sin entrenar."""
    if modelo_id == "regla-v1":
        return predecir_prioridades(modelo_id, tramos, PredictorReglaV1())
    predictor = crear_predictor_demo(modelo_id, filas, semilla)
    return predecir_prioridades(modelo_id, tramos, predictor)


def planificar(nodos, tramos, prioridades, incluir=("media", "alta")):
    """Planifica el recorrido con networkx."""
    return planificar_recoleccion(
        nodos, tramos, prioridades,
        ConfigRecorrido(incluir=tuple(incluir)), NetworkxPlanificador())


__all__ = [
    "SklearnPredictor",
    "cargar_dataset_v1",
    "comparar_demos",
    "filas_para_ml",
    "planificar",
    "predecir_con",
]
