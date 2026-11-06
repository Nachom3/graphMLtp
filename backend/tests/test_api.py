"""API: contrato v1 por HTTP con TestClient (sin red ni servidor real)."""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from fastapi.testclient import TestClient

from recoleccion.api import crear_app

FIX = Path(__file__).parent / "fixtures"
app = crear_app()
client = TestClient(app)


def _tramos_in():
    rows = list(csv.DictReader((FIX / "tramos.csv").read_text(encoding="utf-8").splitlines()))
    tramos, filas = [], []
    for r in rows:
        tramos.append({
            "tramo_id": r["tramo_id"], "nodo_origen": r["nodo_origen"],
            "nodo_destino": r["nodo_destino"], "longitud_m": float(r["longitud_m"]),
            "tipo_zona": r["tipo_zona"],
            "cantidad_contenedores": int(r["cantidad_contenedores"]),
            "dias_desde_ultima_recoleccion": int(r["dias_desde_ultima_recoleccion"]),
            "historico_quejas_vecinales": int(r["historico_quejas_vecinales"]),
        })
        filas.append({**tramos[-1], "prioridad_recoleccion": r["prioridad_recoleccion"]})
    nodos = list(csv.DictReader((FIX / "nodos.csv").read_text(encoding="utf-8").splitlines()))
    return nodos, tramos, filas


def test_salud():
    r = client.get("/salud")
    assert r.status_code == 200
    assert r.json()["estado"] == "ok"


def test_validar_dataset_real():
    r = client.post("/dataset/validar", json={
        "fuente": str(FIX), "version_esquema": "v1"})
    assert r.status_code == 200
    assert r.json()["n_tramos"] == 12


def test_validar_dataset_invalido_codigo_estable():
    r = client.post("/dataset/validar", json={
        "fuente": str(FIX / "noexiste"), "version_esquema": "v1"})
    assert r.status_code == 422
    assert r.json()["detail"]["codigo"] == "DATASET_INVALIDO"


def test_comparar_y_predecir():
    nodos, tramos, filas = _tramos_in()
    r = client.post("/modelos/comparar", json={"filas": filas})
    assert r.status_code == 200
    body = r.json()
    assert body["mejor_por_cv"] in ("arbol", "logistica")
    assert "registro" in body

    r = client.post("/predicciones:predecir", json={
        "modelo_id": "regla-v1", "tramos": tramos})
    assert r.status_code == 200
    assert len(r.json()["predicciones"]) == 12

    r = client.post("/predicciones:predecir", json={
        "modelo_id": "arbol", "tramos": tramos[:4],
        "filas_entrenamiento": filas})
    assert r.status_code == 200
    ids = [p["tramo_id"] for p in r.json()["predicciones"]]
    assert ids == [t["tramo_id"] for t in tramos[:4]]


def test_planificar_y_error_imposible():
    nodos, tramos, _ = _tramos_in()
    prioridades = {"T0002": "alta", "T0005": "alta", "T0008": "alta",
                   "T0011": "alta"}
    r = client.post("/recorridos:planificar", json={
        "nodos": nodos, "tramos": tramos, "prioridades": prioridades,
        "incluir": ["alta"]})
    assert r.status_code == 200
    body = r.json()
    assert body["unidad"] == "metros"
    assert body["costo_total_m"] > 0

    r = client.post("/recorridos:planificar", json={
        "nodos": nodos, "tramos": tramos, "prioridades": {},
        "incluir": ["alta"]})
    assert r.status_code == 422
    assert r.json()["detail"]["codigo"] == "RECORRIDO_IMPOSIBLE"
