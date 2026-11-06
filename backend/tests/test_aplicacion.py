"""Aplicación: sustitución de dependencias con fakes (LSP/ISP/DIP).

Verifica que cambiar lector/predictor/planificador no exige modificar
el caso de uso, más errores del planificador. Sin red ni servidor HTTP.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pytest

from recoleccion.aplicacion import (
    ProtocoloEvaluacion,
    comparar_modelos,
    planificar_recoleccion,
    predecir_prioridades,
    validar_cargar_dataset,
)
from recoleccion.dominio import (
    ConfigRecorrido,
    DatasetInvalido,
    Recorrido,
    RecorridoImposible,
    TramoFeatures,
    TramoPredicho,
)


class LectorFalso:
    """Sustituto de CsvLectorDataset: misma forma, sin archivos."""

    def __init__(self, tramos):
        self._tramos = tramos

    def cargar(self, fuente, schema_version):
        assert schema_version == "v1"
        return ([{"nodo_id": "N1", "lon": 0.0, "lat": 0.0}], list(self._tramos))


class PredictorFalso:
    def __init__(self, modelo_id, prioridades):
        self._id = modelo_id
        self._pri = list(prioridades)

    @property
    def modelo_id(self):
        return self._id

    def predecir(self, tramos):
        return [TramoPredicho(t.tramo_id, p)
                for t, p in zip(tramos, self._pri, strict=True)]


class PlanificadorFalso:
    def planificar(self, nodos, tramos, prioridades, config):
        sel = [p.tramo_id for p in prioridades if p.prioridad in config.incluir]
        if not sel:
            raise RecorridoImposible("vacío (falso)")
        return Recorrido(orden=tuple(sel), repeticiones=(),
                         costo_total_m=float(len(sel) * 100))


def _tramo(tid="T1"):
    return TramoFeatures(
        tramo_id=tid, nodo_origen="N1", nodo_destino="N2", longitud_m=100.0,
        tipo_zona="residencial", cantidad_contenedores=1,
        dias_desde_ultima_recoleccion=2, historico_quejas_vecinales=0)


def test_validar_cargar_acepta_sustituto():
    nodos, tramos = validar_cargar_dataset("cualquiera", "v1",
                                           LectorFalso([_tramo()]))
    assert len(tramos) == 1


def test_validar_cargar_rechaza():
    with pytest.raises(DatasetInvalido):
        validar_cargar_dataset("", "v1", LectorFalso([_tramo()]))
    with pytest.raises(DatasetInvalido):
        validar_cargar_dataset("x", "v9", LectorFalso([_tramo()]))
    with pytest.raises(DatasetInvalido):
        validar_cargar_dataset("x", "v1", LectorFalso([]))
    malo2 = TramoFeatures(
        tramo_id="M", nodo_origen="N1", nodo_destino="N2", longitud_m=-5.0,
        tipo_zona="residencial", cantidad_contenedores=0,
        dias_desde_ultima_recoleccion=0, historico_quejas_vecinales=0)
    with pytest.raises(DatasetInvalido):
        validar_cargar_dataset("x", "v1", LectorFalso([malo2]))


def test_predecir_exige_modelo_y_asocia():
    tramos = [_tramo("A"), _tramo("B")]
    preds = predecir_prioridades("m1", tramos, PredictorFalso("m1", ["alta", "baja"]))
    assert [(p.tramo_id, p.prioridad) for p in preds] == [("A", "alta"), ("B", "baja")]
    with pytest.raises(ValueError):
        predecir_prioridades("otro", tramos, PredictorFalso("m1", ["alta", "baja"]))
    with pytest.raises(ValueError):
        predecir_prioridades("m1", tramos, PredictorFalso("m1", ["alta"]))


def test_planificar_errores_identificables():
    tramos = [_tramo("A")]
    preds = [TramoPredicho("A", "baja")]
    with pytest.raises(RecorridoImposible):
        planificar_recoleccion([], tramos, preds,
                               ConfigRecorrido(incluir=("alta",)),
                               PlanificadorFalso())
    rec = planificar_recoleccion([], tramos, preds,
                                 ConfigRecorrido(incluir=("baja",)),
                                 PlanificadorFalso())
    assert rec.orden == ("A",)


def test_comparar_delega_en_evaluador():
    class EvalFalso:
        def evaluar(self, filas, configs, protocolo):
            from recoleccion.aplicacion import ComparacionModelos
            assert isinstance(protocolo, ProtocoloEvaluacion)
            return ComparacionModelos((), 0.5, configs[0], {})

    comp = comparar_modelos([{"a": 1}] * 6, ["x"], ProtocoloEvaluacion(), EvalFalso())
    assert comp.mejor_por_cv == "x"
    with pytest.raises(ValueError):
        comparar_modelos([{"a": 1}] * 6, [], ProtocoloEvaluacion(), EvalFalso())
