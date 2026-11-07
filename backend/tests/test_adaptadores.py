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


def test_planificador_import_nuevo_y_legacy_resuelven_la_misma_clase():
    from recoleccion.infraestructura.grafos.networkx_planificador import (
        NetworkxPlanificador as PlanificadorInfraestructura,
    )

    assert PlanificadorInfraestructura is NetworkxPlanificador


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
    # Los componentes prioritarios se conectan usando calles de menor prioridad.
    preds = [TramoPredicho("T0002", "alta"), TramoPredicho("T0004", "alta")]
    resto = [TramoPredicho(t.tramo_id, "baja") for t in tramos
             if t.tramo_id not in ("T0002", "T0004")]
    rec = plan.planificar(nodos, tramos, preds + resto,
                          ConfigRecorrido(incluir=("alta",)))
    assert {"T0002", "T0004"} <= set(rec.orden)
    assert rec.costo_total_m > 0


def test_planificador_rechaza_componentes_viales_realmente_desconectados():
    from recoleccion.dominio import TramoFeatures

    tramos = [
        TramoFeatures("t1", "A", "B", 10, "residencial", 1, 1, 0),
        TramoFeatures("t2", "X", "Y", 10, "residencial", 1, 1, 0),
    ]
    prioridades = [TramoPredicho("t1", "alta"), TramoPredicho("t2", "alta")]

    with pytest.raises(RecorridoImposible, match="desconexo"):
        NetworkxPlanificador().planificar(
            [], tramos, prioridades, ConfigRecorrido(incluir=("alta",)))


def test_planificador_un_tramo_cerrado_duplica_y_suma_costo():
    from recoleccion.dominio import TramoFeatures

    tramo = TramoFeatures(
        tramo_id="t1", nodo_origen="A", nodo_destino="B", longitud_m=10,
        tipo_zona="residencial", cantidad_contenedores=1,
        dias_desde_ultima_recoleccion=1, historico_quejas_vecinales=0)

    recorrido = NetworkxPlanificador().planificar(
        [], [tramo], [TramoPredicho("t1", "alta")],
        ConfigRecorrido(incluir=("alta",)))

    assert recorrido.orden == ("t1", "t1")
    assert recorrido.repeticiones == ("t1",)
    assert recorrido.costo_total_m == 20


def test_planificador_conecta_componentes_por_calle_no_seleccionada():
    from recoleccion.dominio import TramoFeatures

    tramos = [
        TramoFeatures("t1", "A", "B", 10, "residencial", 1, 1, 0),
        TramoFeatures("puente", "B", "C", 5, "residencial", 1, 1, 0),
        TramoFeatures("t2", "C", "D", 10, "residencial", 1, 1, 0),
    ]
    prioridades = [TramoPredicho("t1", "alta"),
                   TramoPredicho("puente", "baja"),
                   TramoPredicho("t2", "alta")]

    recorrido = NetworkxPlanificador().planificar(
        [], tramos, prioridades, ConfigRecorrido(incluir=("alta",)))

    assert set(recorrido.orden) == {"t1", "t2", "puente"}
    assert len(recorrido.orden) == 6
    assert recorrido.costo_total_m == 50
    assert set(recorrido.repeticiones) == {"t1", "t2", "puente"}
    _assert_route_is_closed_and_contiguous(recorrido.orden, tramos)


def test_planificador_usa_camino_vial_ponderado_y_cuenta_conectores():
    from recoleccion.dominio import TramoFeatures

    tramos = [
        TramoFeatures("obligatorio", "A", "B", 10, "residencial", 1, 1, 0),
        TramoFeatures("atajo1", "A", "C", 1, "residencial", 1, 1, 0),
        TramoFeatures("atajo2", "C", "B", 1, "residencial", 1, 1, 0),
    ]
    prioridades = [TramoPredicho("obligatorio", "alta"),
                   TramoPredicho("atajo1", "baja"),
                   TramoPredicho("atajo2", "baja")]

    recorrido = NetworkxPlanificador().planificar(
        [], tramos, prioridades, ConfigRecorrido(incluir=("alta",)))

    assert recorrido.orden.count("obligatorio") == 1
    assert recorrido.orden.count("atajo1") == 1
    assert recorrido.orden.count("atajo2") == 1
    assert recorrido.costo_total_m == 12
    assert recorrido.repeticiones == ()
    _assert_route_is_closed_and_contiguous(recorrido.orden, tramos)


def test_planificador_preserva_tramos_paralelos_seleccionados():
    from recoleccion.dominio import TramoFeatures

    tramos = [
        TramoFeatures("t1", "A", "B", 10, "residencial", 1, 1, 0),
        TramoFeatures("t2", "A", "B", 2, "residencial", 1, 1, 0),
    ]
    prioridades = [TramoPredicho("t1", "alta"), TramoPredicho("t2", "alta")]

    recorrido = NetworkxPlanificador().planificar(
        [], tramos, prioridades, ConfigRecorrido(incluir=("alta",)))

    assert len(recorrido.orden) == 2
    assert set(recorrido.orden) == {"t1", "t2"}
    assert recorrido.costo_total_m == 12
    _assert_route_is_closed_and_contiguous(recorrido.orden, tramos)


def _assert_route_is_closed_and_contiguous(orden, tramos):
    extremos = {t.tramo_id: (t.nodo_origen, t.nodo_destino) for t in tramos}
    nodos = []
    for tid in orden:
        a, b = extremos[tid]
        if not nodos:
            nodos.extend((a, b))
        elif nodos[-1] == a:
            nodos.append(b)
        elif nodos[-1] == b:
            nodos.append(a)
        else:
            pytest.fail(f"ruta discontinua al recorrer {tid}: {nodos[-1]} no toca {a}-{b}")
    assert nodos[0] == nodos[-1]


def test_guardar_registro(tmp_path, filas):
    comp = SklearnEvaluador().evaluar(filas, ["arbol"], ProtocoloEvaluacion())
    dest = tmp_path / "registro.json"
    guardar_registro(str(dest), comp)
    assert dest.exists()
