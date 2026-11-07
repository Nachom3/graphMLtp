"""Paths and constants shared by dataset-builder stages."""
from __future__ import annotations

from pathlib import Path

from pyproj import Geod, Transformer

ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = ROOT / "dataset"
SALIDA_DIR = DATASET_DIR / "salida"

# Zona piloto v1 (WGS84 / EPSG:4326), de docs/dataset-recoleccion.md
BBOX_WGS = {"o": -56.16, "s": -34.915, "e": -56.15, "n": -34.905}

# Tolerancia de snap de nodos (metros, en UTM 21S). Endpoints que distan menos
# que esto se consideran el mismo nodo (interseccion/extremo compartido).
SNAP_TOL_M = 0.5

# Se descartan fragmentos/sub-segmentos mas cortos que esto (degenerados).
MIN_SEG_LEN_M = 1.0

# Foto de referencia T0: dateData del snapshot de levantes (09_levantes).
T0 = "2026-10-23"

# Semilla fija del dataset (registrada en la salida). Controla tipo_zona, la
# unica variable simulada por diseno.
SEED = 42

EJES_CSV = DATASET_DIR / "11_ejes-ide" / "ejes_montevideo.csv"
CONTAINERS_JSON = DATASET_DIR / "09_levantes" / "containers.json"
SMARTWASTE_CSV = (
    DATASET_DIR
    / "10_smartwaste-mvd"
    / "smartwaste-mvd-data"
    / "data"
    / "processed"
    / "containers_wgs84.csv"
)

# Radio maximo (m, UTM) para asignar un contenedor al tramo mas cercano.
# Contenedores mas lejos quedan no-asignados (cuarentena). En el piloto todos
# los contenedores estan a < 11 m del eje mas cercano.
SNAP_RADIUS_M = 25.0

SRC_CRS = "EPSG:32721"  # UTM 21S (origen de los ejes IDE)
DST_CRS = "EPSG:4326"  # WGS84 (salida + clip)

_FWD = Transformer.from_crs(SRC_CRS, DST_CRS, always_xy=True)
_INV = Transformer.from_crs(DST_CRS, SRC_CRS, always_xy=True)
_GEOD = Geod(ellps="WGS84")


