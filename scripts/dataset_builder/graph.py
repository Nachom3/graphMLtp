"""Clip street geometry and construct the collection road graph."""
from __future__ import annotations

from collections import defaultdict
from math import floor

import networkx as nx
import numpy as np
import pandas as pd
from shapely import STRtree, from_wkb, transform
from shapely.geometry import (
    GeometryCollection,
    LineString,
    MultiLineString,
    MultiPoint,
    Point,
    box,
)
from shapely.ops import substring

from .config import _FWD, _GEOD, _INV, BBOX_WGS, EJES_CSV, MIN_SEG_LEN_M, SNAP_TOL_M


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


CITY_MIN_SEG_LEN_M = 0.01


def all_ejes(ejes: list[tuple[int, str, str]]) -> list[dict]:
    """Flatten city roads, excluding sub-centimetre numerical artifacts."""
    return [
        {"reftramo": reftramo, "nombre": nombre, "utm": line}
        for reftramo, nombre, geom in ejes
        for line in _flatten_linestrings(geom)
        if line.length >= CITY_MIN_SEG_LEN_M
    ]


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


def node_and_split(
    fragments: list[dict], *, min_segment_length: float = MIN_SEG_LEN_M
) -> list[dict]:
    """Divide los fragmentos en los cruces a media arista y devuelve sub-segmentos.

    Cada sub-segmento = {"reftramo", "nombre", "utm": LineString UTM,
    "frag_idx": orden del sub-segmento a lo largo del eje original}.
    Un cruce donde un eje toca a otro sin compartir endpoint (T-junction o
    cruce a media arista) se "nodifica" aqui para que el grafo sea planar.
    """
    geoms = [f["utm"] for f in fragments]
    # Only geometries with overlapping envelopes can intersect. STRtree is
    # static and returns indices into geoms (Shapely >= 2).
    tree = STRtree(geoms)

    sub_segments = []
    for i, frag in enumerate(fragments):
        ls = frag["utm"]
        split_dists = set()
        for j in sorted(int(index) for index in tree.query(ls)):
            if j == i:
                continue
            other = geoms[j]
            if not ls.intersects(other):
                continue
            for p in _extract_points(ls.intersection(other)):
                d = ls.project(p)
                if d <= SNAP_TOL_M or d >= ls.length - SNAP_TOL_M:
                    continue  # cruce en un extremo: ya es nodo compartido
                split_dists.add(round(d, 6))
        pieces = _split_line(ls, sorted(split_dists), min_length=min_segment_length)
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


def _split_line(
    ls: LineString, dists: list[float], *, min_length: float = MIN_SEG_LEN_M
) -> list[LineString]:
    """Corta ls en las distancias dadas (ya ordenadas y dentro de (0, length))."""
    if not dists:
        return [ls]
    pieces = []
    prev = 0.0
    for d in dists:
        sub = substring(ls, prev, d)
        if sub.length > 0 and sub.length >= min_length:
            pieces.append(sub)
        prev = d
    sub = substring(ls, prev, ls.length)
    if sub.length > 0 and sub.length >= min_length:
        pieces.append(sub)
    return pieces


def _geodetic_length_m(ls_utm: LineString) -> float:
    """Longitud geodesica (m) de un sub-segmento UTM -> WGS84 -> Geod."""
    wgs84 = _to_wgs84(ls_utm)
    return _GEOD.geometry_length(wgs84)


def _tramo_id(reftramo: int, occ: int) -> str:
    """tramo_id derivado del reftramo estable del IDE; sufijo si se dividio.

    occ es el indice de ocurrencia 0-based del reftramo entre todos los
    sub-segmentos (no el frag_idx intra-fragmento): un mismo reftramo puede
    producir varios fragmentos disjuntos al recortar por bbox (entra y sale
    del recorte), y cada fragmento se parte a su vez en node_and_split.
    Sin contador global habria duplicados (visto en el recorte medio)."""
    if occ == 0:
        return str(reftramo)
    return f"{reftramo}-{occ + 1}"


def build_graph(
    sub_segments: list[dict], *, keep_all_components: bool = False,
    length_decimals: int = 2, coordinate_decimals: int = 7,
) -> tuple[list[dict], list[dict]]:
    """Nodos en extremos (snap) + aristas; por defecto conserva la CC mayor.

    Devuelve (nodos, tramos) con IDs estables N0001../reftramo y coordenadas
    WGS84 en nodos.
    """
    sub_segments = sorted(sub_segments, key=lambda s: (s["reftramo"], s["frag_idx"]))

    # Dynamic spatial hash: unlike an immutable STRtree it can be updated as
    # representatives are added. Always pick the earliest representative,
    # preserving the legacy scan's deterministic (not nearest) semantics.
    reps: list[tuple[float, float]] = []
    cells: dict[tuple[int, int], list[int]] = defaultdict(list)

    def node_for(x: float, y: float) -> int:
        cell_x, cell_y = floor(x / SNAP_TOL_M), floor(y / SNAP_TOL_M)
        candidates = (
            idx
            for dx in (-1, 0, 1)
            for dy in (-1, 0, 1)
            for idx in cells.get((cell_x + dx, cell_y + dy), ())
        )
        matches = [
            idx for idx in candidates
            if (x - reps[idx][0]) ** 2 + (y - reps[idx][1]) ** 2 <= SNAP_TOL_M**2
        ]
        if matches:
            return min(matches)
        reps.append((x, y))
        cells[(cell_x, cell_y)].append(len(reps) - 1)
        return len(reps) - 1

    raw_edges = []
    for s in sub_segments:
        c0 = s["utm"].coords[0]
        c1 = s["utm"].coords[-1]
        n0 = node_for(c0[0], c0[1])
        n1 = node_for(c1[0], c1[1])
        if n0 != n1:
            raw_edges.append((n0, n1, s))
            continue

        # Real IDE axes can form a closed ring (or have endpoints closer
        # than the snap tolerance). Keep the road and its exact shape: split
        # it at half length into two edges with a distinct intermediate node.
        # This special node must not enter the normal snap grid: otherwise a
        # small ring could collapse back onto its own endpoint, or affect
        # unrelated subsequent roads.
        line = s["utm"]
        midpoint = line.interpolate(line.length / 2)
        middle = len(reps)
        reps.append((midpoint.x, midpoint.y))
        first = {**s, "utm": substring(line, 0, line.length / 2)}
        second = {**s, "utm": substring(line, line.length / 2, line.length)}
        raw_edges.extend(((n0, middle, first), (middle, n1, second)))

    # Componente conexo mayor.
    g = nx.Graph()
    g.add_nodes_from(range(len(reps)))
    g.add_edges_from((n0, n1) for n0, n1, _ in raw_edges)
    if keep_all_components:
        keep_nodes = set(g.nodes)
    else:
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
                "lon": round(lon, coordinate_decimals),
                "lat": round(lat, coordinate_decimals),
            }
        )

    tramos = []
    occ_por_reftramo: dict[int, int] = {}
    for n0, n1, s in raw_edges:
        if n0 not in keep_nodes or n1 not in keep_nodes:
            continue
        occ = occ_por_reftramo.get(s["reftramo"], 0)
        occ_por_reftramo[s["reftramo"]] = occ + 1
        tramos.append(
            {
                "tramo_id": _tramo_id(s["reftramo"], occ),
                "nodo_origen": f"N{new_id[n0] + 1:04d}",
                "nodo_destino": f"N{new_id[n1] + 1:04d}",
                "longitud_m": round(_geodetic_length_m(s["utm"]), length_decimals),
                "nombre_calle": s["nombre"],
                "utm": s["utm"],  # interno: geometria para el snap de contenedores
            }
        )
    return nodos, tramos


