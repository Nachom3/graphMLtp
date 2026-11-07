"""Contratos abstractos y orquestación concreta de los casos de uso."""
import sys
from abc import ABC
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from recoleccion.aplicacion import (
    ComparacionModelos,
    PlanificadorRecorrido,
    PredictorPrioridades,
    ProtocoloEvaluacion,
)
from recoleccion.aplicacion.casos_uso import (
    CasoUsoCompararModelos,
    CasoUsoPlanificarRecoleccion,
    CasoUsoPredecirPrioridades,
    CasoUsoValidarCargarDataset,
    CompararModelos,
    PlanificarRecoleccion,
    PredecirPrioridades,
    ValidarCargarDataset,
)
from recoleccion.aplicacion.casos_uso.contratos.comparar_modelos import (
    CasoUsoCompararModelos as ContratoCompararModelos,
)
from recoleccion.aplicacion.casos_uso.contratos.planificar_recoleccion import (
    CasoUsoPlanificarRecoleccion as ContratoPlanificarRecoleccion,
)
from recoleccion.aplicacion.casos_uso.contratos.predecir_prioridades import (
    CasoUsoPredecirPrioridades as ContratoPredecirPrioridades,
)
from recoleccion.aplicacion.casos_uso.contratos.validar_cargar_dataset import (
    CasoUsoValidarCargarDataset as ContratoValidarCargarDataset,
)
from recoleccion.dominio import (
    ConfigRecorrido,
    Recorrido,
    TramoFeatures,
    TramoPredicho,
)


def test_fachada_conserva_importaciones_historicas_del_dominio():
    from recoleccion.aplicacion import (
        DatasetInvalido as dataset_invalido,
    )
    from recoleccion.aplicacion import (
        RecorridoImposible as recorrido_imposible,
    )
    from recoleccion.aplicacion import (
        asociar_predicciones as asociar,
    )
    from recoleccion.aplicacion import (
        validar_tramo_features as validar,
    )
    from recoleccion.dominio import (
        DatasetInvalido,
        RecorridoImposible,
        asociar_predicciones,
        validar_tramo_features,
    )

    assert (dataset_invalido, recorrido_imposible, asociar, validar) == (
        DatasetInvalido, RecorridoImposible,
        asociar_predicciones, validar_tramo_features,
    )


def _tramo(tid="T1"):
    return TramoFeatures(
        tramo_id=tid, nodo_origen="N1", nodo_destino="N2", longitud_m=100.0,
        tipo_zona="residencial", cantidad_contenedores=1,
        dias_desde_ultima_recoleccion=2, historico_quejas_vecinales=0,
    )


@pytest.mark.parametrize(
    "contract",
    [
        CasoUsoValidarCargarDataset,
        CasoUsoCompararModelos,
        CasoUsoPredecirPrioridades,
        CasoUsoPlanificarRecoleccion,
    ],
)
def test_contratos_son_abc_con_ejecutar_abstracto(contract):
    assert issubclass(contract, ABC)
    assert contract.__abstractmethods__ == frozenset({"ejecutar"})
    with pytest.raises(TypeError):
        contract()


@pytest.mark.parametrize(
    ("exported", "contract"),
    [
        (CasoUsoCompararModelos, ContratoCompararModelos),
        (CasoUsoPlanificarRecoleccion, ContratoPlanificarRecoleccion),
        (CasoUsoPredecirPrioridades, ContratoPredecirPrioridades),
        (CasoUsoValidarCargarDataset, ContratoValidarCargarDataset),
    ],
)
def test_contratos_tienen_modulos_independientes_y_mantienen_export(exported, contract):
    assert contract is exported
    assert contract.__module__.startswith("recoleccion.aplicacion.casos_uso.contratos.")


def test_validar_cargar_concreto_delega_y_devuelve_datos():
    esperado = ([{"nodo_id": "N1"}], [_tramo()])

    class Lector:
        def __init__(self):
            self.llamadas = []

        def cargar(self, fuente, schema_version):
            self.llamadas.append((fuente, schema_version))
            return esperado

    lector = Lector()
    caso = ValidarCargarDataset(lector)
    assert isinstance(caso, CasoUsoValidarCargarDataset)
    assert caso.ejecutar("dataset.csv", "v1") == esperado
    assert lector.llamadas == [("dataset.csv", "v1")]


def test_comparar_concreto_delega_argumentos_y_devuelve_comparacion():
    esperado = ComparacionModelos((), 0.5, "modelo-a", {})

    class Evaluador:
        def __init__(self):
            self.llamada = None

        def evaluar(self, filas, configs, protocolo):
            self.llamada = (filas, configs, protocolo)
            return esperado

    filas, configs, protocolo = [{"x": 1}] * 6, ["modelo-a"], ProtocoloEvaluacion()
    evaluador = Evaluador()
    caso = CompararModelos(evaluador)
    assert isinstance(caso, CasoUsoCompararModelos)
    assert caso.ejecutar(filas, configs, protocolo) is esperado
    assert evaluador.llamada == (filas, configs, protocolo)


def test_predecir_concreto_delega_y_asocia_predicciones():
    tramos = [_tramo("A"), _tramo("B")]

    class Predictor(PredictorPrioridades):
        @property
        def modelo_id(self) -> str:
            return "modelo-a"

        def __init__(self):
            self.llamadas = []

        def predecir(self, tramos: list[TramoFeatures]) -> list[TramoPredicho]:
            self.llamadas.append(tramos)
            return [TramoPredicho("A", "alta"), TramoPredicho("B", "baja")]

    predictor = Predictor()
    caso = PredecirPrioridades(predictor)
    assert isinstance(caso, CasoUsoPredecirPrioridades)
    resultado = caso.ejecutar("modelo-a", tramos)
    assert [(p.tramo_id, p.prioridad) for p in resultado] == [("A", "alta"), ("B", "baja")]
    assert predictor.llamadas == [tramos]


def test_planificar_concreto_delega_y_devuelve_recorrido():
    nodos, tramos = [{"nodo_id": "N1"}], [_tramo()]
    prioridades = [TramoPredicho("T1", "alta")]
    config = ConfigRecorrido(incluir=("alta",))
    esperado = Recorrido(orden=("T1",), repeticiones=(), costo_total_m=100.0)

    class Planificador(PlanificadorRecorrido):
        def __init__(self):
            self.llamada = None

        def planificar(
            self,
            nodos: list[dict],
            tramos: list[TramoFeatures],
            prioridades: list[TramoPredicho],
            config: ConfigRecorrido,
        ) -> Recorrido:
            self.llamada = (nodos, tramos, prioridades, config)
            return esperado

    planificador = Planificador()
    caso = PlanificarRecoleccion(planificador)
    assert isinstance(caso, CasoUsoPlanificarRecoleccion)
    assert caso.ejecutar(nodos, tramos, prioridades, config) is esperado
    assert planificador.llamada == (nodos, tramos, prioridades, config)
