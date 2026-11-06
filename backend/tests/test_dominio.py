"""Dominio: regla v1, invariantes y asociación predicción-tramo. Sin red/HTTP."""
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pytest

from recoleccion.dominio import (
    PrediccionSinTramo,
    TramoFeatures,
    asociar_predicciones,
    etiqueta_v1,
    score_v1,
    validar_tramo_features,
)


def t(**kw):
    base: dict[str, Any] = {"tramo_id": "T1", "nodo_origen": "N1",
            "nodo_destino": "N2", "longitud_m": 100.0,
            "tipo_zona": "residencial", "cantidad_contenedores": 1,
            "dias_desde_ultima_recoleccion": 2,
            "historico_quejas_vecinales": 0}
    base.update(kw)
    return TramoFeatures(**base)


def test_ejemplos_doc_coherentes_con_regla():
    # T0001..T0005 de docs/dataset-recoleccion.md recalculados.
    assert etiqueta_v1(2, 0, 1, "residencial") == "baja"   # score 5
    assert etiqueta_v1(4, 2, 2, "comercial") == "alta"     # score 18
    assert etiqueta_v1(3, 1, 1, "industrial") == "media"   # score 11
    assert score_v1(6, 3, 3, "comercial") == 26


def test_umbrales():
    assert etiqueta_v1(5, 0, 0, "residencial") == "baja"   # 10
    assert etiqueta_v1(5, 0, 1, "residencial") == "media"  # 11
    assert etiqueta_v1(8, 0, 0, "residencial") == "media"  # 16
    assert etiqueta_v1(8, 0, 1, "residencial") == "alta"   # 17


def test_invariantes_datos_invalidos():
    assert validar_tramo_features(t()) == []
    assert validar_tramo_features(t(longitud_m=0))
    assert validar_tramo_features(t(cantidad_contenedores=-1))
    assert validar_tramo_features(t(nodo_origen="N2", nodo_destino="N2"))
    assert validar_tramo_features(t(tipo_zona="rural"))


def test_asociacion_exige_identidad():
    preds = asociar_predicciones(["A", "B"], ["alta", "baja"])
    assert [(p.tramo_id, p.prioridad) for p in preds] == [("A", "alta"), ("B", "baja")]
    with pytest.raises(PrediccionSinTramo):
        asociar_predicciones(["A"], ["alta", "baja"])
    with pytest.raises(PrediccionSinTramo):
        asociar_predicciones(["A", "A"], ["alta", "alta"])
    with pytest.raises(PrediccionSinTramo):
        asociar_predicciones(["A"], ["urgente"])
