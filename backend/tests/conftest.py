import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import csv  # noqa: E402

import pytest  # noqa: E402

FIX = Path(__file__).parent / "fixtures"


@pytest.fixture()
def nodos():
    return list(csv.DictReader((FIX / "nodos.csv").read_text(encoding="utf-8").splitlines()))


@pytest.fixture()
def tramos():
    from recoleccion.adaptadores import CsvLectorDataset

    _, tramos = CsvLectorDataset().cargar(str(FIX), "v1")
    return tramos


@pytest.fixture()
def etiquetas(tramos):
    from recoleccion.dominio import etiqueta_v1

    return {t.tramo_id: etiqueta_v1(
        t.dias_desde_ultima_recoleccion, t.historico_quejas_vecinales,
        t.cantidad_contenedores, t.tipo_zona) for t in tramos}


@pytest.fixture()
def filas(tramos, etiquetas):
    from recoleccion.adaptadores import filas_para_ml

    return filas_para_ml(tramos, etiquetas)
