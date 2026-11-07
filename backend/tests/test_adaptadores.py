"""Adaptadores: CSV, sklearn demo, networkx y artefactos. Sin red/HTTP."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pytest

from recoleccion.adaptadores import (
    CsvLectorDataset,
    NetworkxPlanificador,
    PredictorReglaV1,
    SklearnEvaluador,
    crear_predictor_demo,
    guardar_registro,
)
from recoleccion.aplicacion import ProtocoloEvaluacion
from recoleccion.dominio import (
    ConfigRecorrido,
    DatasetInvalido,
    RecorridoImposible,
    TramoPredicho,
)

FIX = Path(__file__).parent / "fixtures"


def test_lector_csv_y_error_fuente():
    nodos, tramos = CsvLectorDataset().cargar(str(FIX), "v1")
    assert len(nodos) == 6 and len(tramos) == 12
    with pytest.raises(DatasetInvalido):
        CsvLectorDataset().cargar(str(FIX / "noexiste"), "v1")


def test_evaluacion_reproducible_con_baseline(filas):
    comp = SklearnEvaluador().evaluar(
        filas, ["arbol", "logistica"], ProtocoloEvaluacion())
    ids = [m.modelo_id for m in comp.metricas]
    assert ids == ["arbol", "logistica"]
    assert comp.mejor_por_cv in ids  # elegido por CV-train, no por test
    assert 0.0 <= comp.baseline_accuracy <= 1.0
    assert comp.registro["semilla"] == 0
    assert comp.registro["versiones"]["sklearn"]
    for m in comp.metricas:
        assert m.n_train + m.n_test == len(filas)
        total = sum(sum(f) for f in m.matriz_confusion)
        assert total == m.n_test


def test_dos_modelos_demo_predicen(filas, tramos):
    for cfg in ("arbol", "logistica"):
        predictor = crear_predictor_demo(cfg, filas)
        assert predictor.modelo_id == cfg
        preds = predictor.predecir(tramos)
        assert [p.tramo_id for p in preds] == [t.tramo_id for t in tramos]
        assert {p.prioridad for p in preds} <= {"baja", "media", "alta"}
    with pytest.raises(ValueError):
        crear_predictor_demo("transformer-gigante", filas)


def test_predictor_regla_sin_sklearn(tramos):
    preds = PredictorReglaV1().predecir(tramos)
    assert len(preds) == len(tramos)


def test_planificador_euleriano_y_cartero(nodos, tramos, etiquetas):
    preds = [TramoPredicho(tid, pri) for tid, pri in etiquetas.items()]
    plan = NetworkxPlanificador()
    rec = plan.planificar(nodos, tramos, preds, ConfigRecorrido())
    assert set(rec.orden) >= {t.tramo_id for t in tramos
                              if etiquetas[t.tramo_id] in ("media", "alta")}
    assert rec.costo_total_m > 0
    # Criterio que deja subgrafo no euleriano -> cartero chino con repeticiones.
    rec2 = plan.planificar(nodos, tramos, preds, ConfigRecorrido(incluir=("alta",)))
    assert len(rec2.orden) >= 4
    assert rec2.costo_total_m > 0


def test_planificador_errores(nodos, tramos):
    plan = NetworkxPlanificador()
    with pytest.raises(RecorridoImposible):
        plan.planificar(nodos, tramos, [], ConfigRecorrido())
    # Subgrafo desconexo: solo dos tramos lejanos en alta.
    preds = [TramoPredicho("T0002", "alta"), TramoPredicho("T0004", "alta")]
    resto = [TramoPredicho(t.tramo_id, "baja") for t in tramos
             if t.tramo_id not in ("T0002", "T0004")]
    with pytest.raises(RecorridoImposible):
        plan.planificar(nodos, tramos, preds + resto,
                        ConfigRecorrido(incluir=("alta",)))


def test_guardar_registro(tmp_path, filas):
    comp = SklearnEvaluador().evaluar(filas, ["arbol"], ProtocoloEvaluacion())
    dest = tmp_path / "registro.json"
    guardar_registro(str(dest), comp)
    assert dest.exists()
