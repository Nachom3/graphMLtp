"""Flujo entrenado reproducible: features -> sklearn -> prioridades -> ruta HTTP."""
from dataclasses import replace

from fastapi.testclient import TestClient

from recoleccion.api import crear_app


def _json_tramo(tramo):
    return {
        "tramo_id": tramo.tramo_id,
        "nodo_origen": tramo.nodo_origen,
        "nodo_destino": tramo.nodo_destino,
        "longitud_m": tramo.longitud_m,
        "tipo_zona": tramo.tipo_zona,
        "cantidad_contenedores": tramo.cantidad_contenedores,
        "dias_desde_ultima_recoleccion": tramo.dias_desde_ultima_recoleccion,
        "historico_quejas_vecinales": tramo.historico_quejas_vecinales,
    }


def test_sklearn_entrenado_predice_y_actualiza_recorrido_http(tramos, filas, nodos):
    client = TestClient(crear_app())
    entrenamiento = [
        {"tipo_zona": fila["tipo_zona"],
         "cantidad_contenedores": fila["cantidad_contenedores"],
         "dias_desde_ultima_recoleccion": fila["dias_desde_ultima_recoleccion"],
         "historico_quejas_vecinales": fila["historico_quejas_vecinales"],
         "prioridad_recoleccion": fila["prioridad_recoleccion"]}
        for fila in filas
    ]

    def predecir(actuales):
        respuesta = client.post("/predicciones:predecir", json={
            "modelo_id": "arbol",
            "tramos": [_json_tramo(t) for t in actuales],
            "filas_entrenamiento": entrenamiento,
        })
        assert respuesta.status_code == 200
        return {p["tramo_id"]: p["prioridad"]
                for p in respuesta.json()["predicciones"]}

    originales = predecir(tramos)
    ejemplo_alto = next(fila for fila in filas
                        if fila["prioridad_recoleccion"] == "alta")
    cambiado = [replace(
        t,
        tipo_zona=ejemplo_alto["tipo_zona"],
        cantidad_contenedores=ejemplo_alto["cantidad_contenedores"],
        dias_desde_ultima_recoleccion=ejemplo_alto["dias_desde_ultima_recoleccion"],
        historico_quejas_vecinales=ejemplo_alto["historico_quejas_vecinales"])
        if t.tramo_id == "T0001" else t for t in tramos]
    actualizadas = predecir(cambiado)
    assert originales["T0001"] == "baja"
    assert actualizadas["T0001"] == "alta"

    def planificar(datos, prioridades):
        respuesta = client.post("/recorridos:planificar", json={
            "nodos": nodos,
            "tramos": [_json_tramo(t) for t in datos],
            "prioridades": prioridades,
            "incluir": ["media", "alta"],
        })
        assert respuesta.status_code == 200
        cuerpo = respuesta.json()
        assert cuerpo["unidad"] == "metros"
        assert cuerpo["costo_total_m"] == sum(
            next(t.longitud_m for t in datos if t.tramo_id == tid)
            for tid in cuerpo["orden"])
        return cuerpo

    ruta_original = planificar(tramos, originales)
    ruta_actualizada = planificar(cambiado, actualizadas)
    assert "T0001" not in ruta_original["orden"]
    assert "T0001" in ruta_actualizada["orden"]
    assert ruta_original["orden"] != ruta_actualizada["orden"]
    assert ruta_original["costo_total_m"] != ruta_actualizada["costo_total_m"]
