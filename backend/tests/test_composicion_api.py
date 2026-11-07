"""La API recibe casos de uso construidos por la raíz de composición."""
from fastapi.testclient import TestClient

from recoleccion import composicion
from recoleccion.api import crear_app
from recoleccion.aplicacion import ComparacionModelos, ProtocoloEvaluacion
from recoleccion.dominio import ConfigRecorrido, Recorrido, TramoPredicho


class CasoFalso:
    def __init__(self, resultado):
        self.resultado = resultado
        self.llamadas = []

    def ejecutar(self, *args):
        self.llamadas.append(args)
        return self.resultado


def _instalar_caso(monkeypatch, nombre, caso):
    construcciones = []

    def construir(*args):
        construcciones.append(args)
        return caso

    monkeypatch.setattr(composicion, nombre, construir, raising=False)
    return construcciones


def test_validacion_http_usa_caso_de_composicion(monkeypatch):
    caso = CasoFalso(([{"nodo_id": "n1"}], [object(), object()]))
    construcciones = _instalar_caso(
        monkeypatch, "crear_caso_validar_cargar_dataset", caso
    )
    respuesta = TestClient(crear_app()).post(
        "/dataset/validar", json={"fuente": "ejemplo", "version_esquema": "v1"}
    )

    assert construcciones == [()]
    assert caso.llamadas == [("ejemplo", "v1")]
    assert respuesta.status_code == 200
    assert respuesta.json() == {"valido": True, "n_nodos": 1, "n_tramos": 2}


def test_comparacion_http_usa_caso_de_composicion(monkeypatch):
    caso = CasoFalso(ComparacionModelos((), 0.5, "arbol", {"demo": True}))
    construcciones = _instalar_caso(monkeypatch, "crear_caso_comparar_modelos", caso)
    filas = [{"dato": 1}]
    respuesta = TestClient(crear_app()).post(
        "/modelos/comparar", json={"filas": filas, "configs": ["arbol"], "semilla": 7}
    )

    assert construcciones == [()]
    assert caso.llamadas == [(filas, ["arbol"], ProtocoloEvaluacion(semilla=7))]
    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "metricas": [], "baseline_accuracy": 0.5,
        "mejor_por_cv": "arbol", "registro": {"demo": True},
    }


def test_prediccion_http_usa_caso_de_composicion(monkeypatch):
    caso = CasoFalso([TramoPredicho("t1", "alta")])
    construcciones = _instalar_caso(monkeypatch, "crear_caso_predecir_prioridades", caso)
    respuesta = TestClient(crear_app()).post(
        "/predicciones:predecir", json={"modelo_id": "regla-v1", "tramos": []}
    )

    assert construcciones == [("regla-v1", [])]
    assert caso.llamadas == [("regla-v1", [])]
    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "modelo_id": "regla-v1",
        "predicciones": [{"tramo_id": "t1", "prioridad": "alta"}],
    }


def test_planificacion_http_usa_caso_de_composicion(monkeypatch):
    caso = CasoFalso(Recorrido(("t1", "t1"), ("t1",), 20.0))
    construcciones = _instalar_caso(monkeypatch, "crear_caso_planificar_recoleccion", caso)
    respuesta = TestClient(crear_app()).post(
        "/recorridos:planificar",
        json={"nodos": [], "tramos": [], "prioridades": {"t1": "alta"}, "incluir": ["alta"]},
    )

    assert construcciones == [()]
    assert caso.llamadas == [(
        [], [], [TramoPredicho("t1", "alta")], ConfigRecorrido(incluir=("alta",))
    )]
    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "orden": ["t1", "t1"], "repeticiones": ["t1"],
        "costo_total_m": 20.0, "unidad": "metros",
    }
