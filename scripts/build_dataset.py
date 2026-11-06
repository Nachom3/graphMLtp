#!/usr/bin/env python3
"""Build del dataset final (issue #9): nodos.csv + tramos.csv reproducibles.

Pipeline (cada etapa se desarrolla y commitea por separado):
  1. Grafo: ejes IDE (EWKB, UTM 21S) -> clip al bbox del piloto -> nodos en
     intersecciones/extremos -> componente conexo mayor -> longitud_m geodesica
     -> tramo_id desde reftramo -> nombre_calle.
  (etapas posteriores: contenedores, dias, quejas, tipo_zona, prioridad)

Uso:
    .venv/bin/python scripts/build_dataset.py
"""

from __future__ import annotations

from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd
from pyproj import Geod, Transformer
from shapely import from_wkb, transform
from shapely.geometry import (
    GeometryCollection,
    LineString,
    MultiLineString,
    MultiPoint,
    Point,
    box,
)
from shapely.ops import substring

# --------------------------------------------------------------------------- #
# Config (semilla y versiones se registran en la salida)
# --------------------------------------------------------------------------- #
ROOT = Path(__file__).resolve().parents[1]
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

EJES_CSV = DATASET_DIR / "11_ejes-ide" / "ejes_montevideo.csv"

SRC_CRS = "EPSG:32721"  # UTM 21S (origen de los ejes IDE)
DST_CRS = "EPSG:4326"  # WGS84 (salida + clip)

_FWD = Transformer.from_crs(SRC_CRS, DST_CRS, always_xy=True)
_INV = Transformer.from_crs(DST_CRS, SRC_CRS, always_xy=True)
_GEOD = Geod(ellps="WGS84")


def _to_wgs84(geom):
    """shapely geometry UTM 21S -> WGS84."""
    return transform(geom, _utm_to_wgs84)


def _to_utm(geom):
    """shapely geometry WGS84 -> UTM 21S."""
    return transform(geom, _wgs84_to_utm)


def _utm_to_wgs84(coords: np.ndarray) -> np.ndarray:
    xs, ys = _FWD.transform(coords[:, 0], coords[:, 1])
    return np.column_stack([xs, ys])


def _wgs84_to_utm(coords: np.ndarray) -> np.ndarray:
    xs, ys = _INV.transform(coords[:, 0], coords[:, 1])
    return np.column_stack([xs, ys])


# --------------------------------------------------------------------------- #
# Etapa 1: grafo
# --------------------------------------------------------------------------- #
def load_ejes() -> list[tuple[int, str, str]]:
    """Lee ejes_montevideo.csv, deduplica por reftramo y parsea la geometria.

    Devuelve lista de (reftramo, nombre, geom_utm) ordenada por reftramo.
    El CSV trae 3.126 filas duplicadas exactas (mismo reftramo + misma geom):
    se conserva la primera.
    """
    df = pd.read_csv(EJES_CSV, encoding="latin-1")
    df = df.drop_duplicates(subset=["reftramo"], keep="first")
    df = df.sort_values("reftramo")
    out = []
    for rec in df.to_dict(orient="records"):
        geom = from_wkb(bytes.fromhex(str(rec["geom"])))
        nombre = str(rec["nombre"]).strip()
        # 'UYMOMVD_SN_*' es el placeholder de "sin nombre" del IDE.
        if nombre.startswith("UYMOMVD_SN"):
            nombre = ""
        out.append((int(rec["reftramo"]), nombre, geom))
    return out


def _flatten_linestrings(geom) -> list[LineString]:
    """Aplana una geometria (LineString/MultiLineString/GeometryCollection) a
    LineStrings. Descarta puntos y geometrias vacias. (El filtro por longitud
    minima se hace en UTM, en metros, en clip_to_bbox.)"""
    if geom is None or geom.is_empty:
        return []
    if isinstance(geom, LineString):
        return [geom]
    if isinstance(geom, (MultiLineString, GeometryCollection)):
        out = []
        for g in geom.geoms:
            out.extend(_flatten_linestrings(g))
        return out
    return []  # Point / MultiPoint / otros


def clip_to_bbox(ejes: list[tuple[int, str, str]]) -> list[dict]:
    """Recorta cada eje al bbox del piloto (en WGS84) y devuelve fragmentos.

    Cada fragmento = {"reftramo", "nombre", "utm": LineString en UTM 21S,
    "wgs84": LineString en WGS84}.
    """
    bbox_box = box(BBOX_WGS["o"], BBOX_WGS["s"], BBOX_WGS["e"], BBOX_WGS["n"])
    fragments = []
    for reftramo, nombre, geom_utm in ejes:
        geom_wgs84 = _to_wgs84(geom_utm)
        clipped = geom_wgs84.intersection(bbox_box)
        for ls in _flatten_linestrings(clipped):
            ls_utm = _to_utm(ls)
            if ls_utm.length < MIN_SEG_LEN_M:
                continue  # descarta slivers del borde del bbox
            fragments.append(
                {
                    "reftramo": reftramo,
                    "nombre": nombre,
                    "utm": ls_utm,
                    "wgs84": ls,
                }
            )
    return fragments


def _extract_points(geom) -> list[Point]:
    """Puntos de una interseccion entre dos lineas (descarta solapes colineales)."""
    if geom.is_empty:
        return []
    if isinstance(geom, Point):
        return [geom]
    if isinstance(geom, MultiPoint):
        return list(geom.geoms)
    if isinstance(geom, GeometryCollection):
        return [g for g in geom.geoms if isinstance(g, Point)]
    return []  # LineString/MultiLineString: solape colineal, no es cruce


def node_and_split(fragments: list[dict]) -> list[dict]:
    """Divide los fragmentos en los cruces a media arista y devuelve sub-segmentos.

    Cada sub-segmento = {"reftramo", "nombre", "utm": LineString UTM,
    "frag_idx": orden del sub-segmento a lo largo del eje original}.
    Los 8 cruces a media arista del piloto (donde dos ejes se cruzan sin
    compartir endpoint) se "nodifican" aqui para que el grafo sea planar.
    """
    geoms = [f["utm"] for f in fragments]

    sub_segments = []
    for i, frag in enumerate(fragments):
        ls = frag["utm"]
        split_dists = set()
        for j, other in enumerate(geoms):
            if j == i:
                continue
            if not ls.intersects(other):
                continue
            for p in _extract_points(ls.intersection(other)):
                d = ls.project(p)
                if d <= SNAP_TOL_M or d >= ls.length - SNAP_TOL_M:
                    continue  # cruce en un extremo: ya es nodo compartido
                split_dists.add(round(d, 6))
        pieces = _split_line(ls, sorted(split_dists))
        for k, piece in enumerate(pieces):
            sub_segments.append(
                {
                    "reftramo": frag["reftramo"],
                    "nombre": frag["nombre"],
                    "utm": piece,
                    "frag_idx": k,
                }
            )
    return sub_segments


def _split_line(ls: LineString, dists: list[float]) -> list[LineString]:
    """Corta ls en las distancias dadas (ya ordenadas y dentro de (0, length))."""
    if not dists:
        return [ls]
    pieces = []
    prev = 0.0
    for d in dists:
        sub = substring(ls, prev, d)
        if sub.length >= MIN_SEG_LEN_M:
            pieces.append(sub)
        prev = d
    sub = substring(ls, prev, ls.length)
    if sub.length >= MIN_SEG_LEN_M:
        pieces.append(sub)
    return pieces


def _geodetic_length_m(ls_utm: LineString) -> float:
    """Longitud geodesica (m) de un sub-segmento UTM -> WGS84 -> Geod."""
    wgs84 = _to_wgs84(ls_utm)
    return _GEOD.geometry_length(wgs84)


def _tramo_id(reftramo: int, frag_idx: int) -> str:
    """tramo_id derivado del reftramo estable del IDE; sufijo si se dividio."""
    if frag_idx == 0:
        return str(reftramo)
    return f"{reftramo}-{frag_idx + 1}"


def build_graph(sub_segments: list[dict]) -> tuple[list[dict], list[dict]]:
    """Nodos en extremos (snap) + aristas; filtra al componente conexo mayor.

    Devuelve (nodos, tramos) con IDs estables N0001../reftramo y coordenadas
    WGS84 en nodos.
    """
    sub_segments = sorted(sub_segments, key=lambda s: (s["reftramo"], s["frag_idx"]))

    # Snap determinista de endpoints (O(n^2), n ~ cientos).
    reps: list[tuple[float, float]] = []

    def node_for(x: float, y: float) -> int:
        for idx, (rx, ry) in enumerate(reps):
            if (x - rx) ** 2 + (y - ry) ** 2 <= SNAP_TOL_M**2:
                return idx
        reps.append((x, y))
        return len(reps) - 1

    raw_edges = []
    for s in sub_segments:
        c0 = s["utm"].coords[0]
        c1 = s["utm"].coords[-1]
        n0 = node_for(c0[0], c0[1])
        n1 = node_for(c1[0], c1[1])
        raw_edges.append((n0, n1, s))

    # Componente conexo mayor.
    g = nx.Graph()
    g.add_nodes_from(range(len(reps)))
    g.add_edges_from((n0, n1) for n0, n1, _ in raw_edges)
    largest = max(nx.connected_components(g), key=len)
    keep_nodes = set(largest)

    # Renumeracion determinista: nodos ordenados por (x, y).
    kept_reps = [(i, reps[i]) for i in range(len(reps)) if i in keep_nodes]
    kept_reps.sort(key=lambda t: (t[1][0], t[1][1]))
    new_id = {old: k for k, (old, _pos) in enumerate(kept_reps)}

    nodos = []
    for _old, (x, y) in kept_reps:
        lon, lat = _FWD.transform(x, y)
        nodos.append(
            {
                "nodo_id": f"N{len(nodos) + 1:04d}",
                "lon": round(lon, 7),
                "lat": round(lat, 7),
            }
        )

    tramos = []
    for n0, n1, s in raw_edges:
        if n0 not in keep_nodes or n1 not in keep_nodes:
            continue
        tramos.append(
            {
                "tramo_id": _tramo_id(s["reftramo"], s["frag_idx"]),
                "nodo_origen": f"N{new_id[n0] + 1:04d}",
                "nodo_destino": f"N{new_id[n1] + 1:04d}",
                "longitud_m": round(_geodetic_length_m(s["utm"]), 2),
                "nombre_calle": s["nombre"],
            }
        )
    return nodos, tramos


# --------------------------------------------------------------------------- #
# Salida
# --------------------------------------------------------------------------- #
def write_outputs(nodos: list[dict], tramos: list[dict]) -> None:
    SALIDA_DIR.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(nodos).to_csv(SALIDA_DIR / "nodos.csv", index=False)
    pd.DataFrame(tramos).to_csv(SALIDA_DIR / "tramos.csv", index=False)


def main() -> None:
    ejes = load_ejes()
    print(f"ejes unicos (dedupe reftramo): {len(ejes)}")

    fragments = clip_to_bbox(ejes)
    print(f"fragmentos en el bbox del piloto: {len(fragments)}")

    sub_segments = node_and_split(fragments)
    nodos, tramos = build_graph(sub_segments)

    print(f"nodos (CC mayor): {len(nodos)}")
    print(f"tramos (CC mayor): {len(tramos)}")

    write_outputs(nodos, tramos)
    print(f"-> {SALIDA_DIR / 'nodos.csv'}")
    print(f"-> {SALIDA_DIR / 'tramos.csv'}")


if __name__ == "__main__":
    main()
