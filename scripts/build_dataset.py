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

import csv
import json
from collections import Counter, defaultdict
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

QUEJAS_CSV = DATASET_DIR / "07_reclamos-sur" / "pormibarrio_reports.csv"

# Categorias de residuos de Por Mi Barrio (taxonomia auditada, issue #8 / README 07).
# Se excluyen poda/arbol/playa (otro circuito).
RESIDUO_CATEGORIAS = frozenset({
    "Basural",
    "Basural de grandes dimensiones",
    "Contenedor desbordado",
    "Contenedor en mal estado",
    "Contenedor fue movido por vecino o vecina",
    "Contenedor lleno",
    "Contenedor lleno o desbordado",
    "Contenedor obstruye o dificulta la circulación en: rampa, tránsito, vereda o área de construcción",
    "Contenedor roto",
    "Contenedor sucio",
    "Denuncia por sacar basuras extraordinaria fuera de fecha",
    "Falta barrido",
    "Falta de barrido",
    "Falta de barrido en avenidas y bulevares",
    "Falta de barrido en calles internas",
    "Falta de contenedores en la zona",
    "Falta de levante manual de residuos",
    "Falta de levante manual de residuos domiciliarios",
    "Falta de limpieza en rambla",
    "Levante basurales",
    "Papelera en mal estado",
    "Presencia de basural",
    "Recolección fuera de hora",
    "Residuo fuera del contenedor",
    "Residuos en la vía pública",
    "Residuos fuera del contenedor",
    "Residuos fuera del contenedor por capacidad insuficiente",
    "Residuos fuera del contenedor por uso indebido/clasificador",
    "Solicitar contenedor adicional",
    "Solicitar contenedor adicional en la vía pública",
    "Solicitar contenedor para residuos reciclables",
    "Solicitar traslado de contenedor",
    "Solicitud de retiro de escombros",
    "Traslado de contenedor",
    "Uso no autorizado por comercios y similares",
    "Volqueta privada desbordada",
})

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
    Un cruce donde un eje toca a otro sin compartir endpoint (T-junction o
    cruce a media arista) se "nodifica" aqui para que el grafo sea planar.
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
                "utm": s["utm"],  # interno: geometria para el snap de contenedores
            }
        )
    return nodos, tramos


# --------------------------------------------------------------------------- #
# Etapa 2: contenedores (cantidad_contenedores)
# --------------------------------------------------------------------------- #
def _load_json(path) -> list:
    """Carga un JSON de entrada con error claro si falta o es invalido."""
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError as err:
        raise SystemExit(f"Falta archivo de entrada: {path}") from err
    except json.JSONDecodeError as err:
        raise SystemExit(f"JSON invalido en {path}: {err}") from err


def _read_csv(path) -> list[dict]:
    """CSV de entrada con error claro si falta (campos con espacios iniciales)."""
    try:
        with open(path, encoding="utf-8") as f:
            return list(csv.DictReader(f, skipinitialspace=True))
    except FileNotFoundError as err:
        raise SystemExit(f"Falta archivo de entrada: {path}") from err


def load_containers() -> list[dict]:
    """Lee 09_levantes/containers.json (foto T0 en WGS84)."""
    raw = _load_json(CONTAINERS_JSON)
    return [
        {
            "long": float(c["long"]),
            "lat": float(c["lat"]),
            "circuitCode": c["circuitCode"],
            "daysWithoutLift": int(c["daysWithoutLift"]),
            "position": int(c["position"]),
        }
        for c in raw
    ]


def _in_bbox(lon: float, lat: float) -> bool:
    return (
        BBOX_WGS["o"] <= lon <= BBOX_WGS["e"] and BBOX_WGS["s"] <= lat <= BBOX_WGS["n"]
    )


def _nearest_tramo(tramos: list[dict], lon: float, lat: float) -> tuple[str, float]:
    """(tramo_id, dist_m) del tramo mas cercano a (lon, lat)."""
    x, y = _INV.transform(lon, lat)
    pt = Point(x, y)
    best_d = float("inf")
    best_tid = ""
    for t in tramos:
        d = round(t["utm"].distance(pt), 3)
        if (d, t["tramo_id"]) < (best_d, best_tid):
            best_d = d
            best_tid = t["tramo_id"]
    return best_tid, best_d


def snap_containers(
    tramos: list[dict], containers: list[dict]
) -> tuple[list, list, list]:
    """Asigna cada contenedor al tramo mas cercano.

    Desempate: menor distancia; a igualdad (< 1 mm), menor tramo_id.
    Radio maximo SNAP_RADIUS_M; mas lejos -> no-asignado (cuarentena).
    Devuelve (assignments, unassigned, dists):
      assignments: lista (tramo_id, contenedor)
      unassigned:  lista de contenedores fuera de radio
      dists:       distancias (m) de los asignados (reporte)
    """
    assignments = []
    unassigned = []
    dists = []
    for c in containers:
        tid, d = _nearest_tramo(tramos, c["long"], c["lat"])
        if d > SNAP_RADIUS_M:
            unassigned.append(c)
        else:
            assignments.append((tid, c))
            dists.append(d)
    return assignments, unassigned, dists


def aggregate_dias(assignments: list) -> dict[str, int]:
    """dias_desde_ultima_recoleccion por tramo: maximo daysWithoutLift de sus
    contenedores (el contenedor mas atrasado define la urgencia del tramo)."""
    agg = {}
    for tid, c in assignments:
        agg[tid] = max(agg.get(tid, 0), c["daysWithoutLift"])
    return agg


def validate_circuits(tramos: list[dict], assignments: list) -> dict:
    """Por circuitCode: contenedores, tramos y componentes conexas del subgrafo
    de tramos (contiguidad de la ruta)."""
    g = nx.Graph()
    for t in tramos:
        g.add_edge(t["nodo_origen"], t["nodo_destino"], tramo_id=t["tramo_id"])
    circuit_tramos = defaultdict(set)
    circuit_cont = Counter()
    for tid, c in assignments:
        code = c["circuitCode"]
        circuit_tramos[code].add(tid)
        circuit_cont[code] += 1
    report = {}
    for code in sorted(circuit_tramos):
        tids = circuit_tramos[code]
        edges = [(u, v) for u, v, d in g.edges(data=True) if d["tramo_id"] in tids]
        sub = g.edge_subgraph(edges)
        report[code] = {
            "contenedores": circuit_cont[code],
            "tramos": len(tids),
            "componentes": nx.number_connected_components(sub) if edges else 0,
        }
    return report


def crosscheck_smartwaste() -> dict[str, int]:
    """Cross-check con SmartWaste (fuente independiente): contenedores en el
    piloto agrupados por circuit_id."""
    df = pd.read_csv(SMARTWASTE_CSV, dtype={"circuit_id": str})
    out = Counter()
    for rec in df.to_dict(orient="records"):
        lon = rec.get("longitude")
        lat = rec.get("latitude")
        if lon is None or lat is None:
            continue
        if isinstance(lon, float) and pd.isna(lon):
            continue
        if isinstance(lat, float) and pd.isna(lat):
            continue
        if _in_bbox(float(lon), float(lat)):
            out[str(rec["circuit_id"]).strip()] += 1
    return dict(out)


# --------------------------------------------------------------------------- #
# Etapa 3: quejas (historico_quejas_vecinales)
# --------------------------------------------------------------------------- #
def load_quejas() -> list[dict]:
    """Lee 07_reclamos-sur/pormibarrio_reports.csv y filtra categorias de residuos.

    Decidido (issue #9): se usa el historico real completo 2014-2020 de Por Mi
    Barrio. La ventana [T0-30d, T0) es vacia porque la fuente termina en 2020;
    la brecha temporal se documenta como limitacion.
    """
    rows = _read_csv(QUEJAS_CSV)

    def _f(s):
        try:
            return float(s)
        except (TypeError, ValueError):
            return None

    out = []
    for r in rows:
        if r["category"] not in RESIDUO_CATEGORIAS:
            continue
        out.append(
            {
                "category": r["category"],
                "lat": _f(r["latitude"]),
                "lon": _f(r["longitude"]),
                "whensent": (r["whensent"] or "").strip(),
                "id": r["id"],
            }
        )
    return out


def dedupe_quejas(quejas: list[dict]) -> list[dict]:
    """Deduplica reportes exactos (categoria + coord 5 decimales + whensent)."""
    seen = set()
    out = []
    for q in quejas:
        k = (round(q["lat"], 5), round(q["lon"], 5), q["category"], q["whensent"])
        if k in seen:
            continue
        seen.add(k)
        out.append(q)
    return out


def snap_quejas(tramos: list[dict], quejas: list[dict]) -> tuple[list, list]:
    """Asigna cada queja (con coords validas) al tramo mas cercano.

    Devuelve (assignments, unassigned): mismo radio y desempate que contenedores.
    """
    assignments = []
    unassigned = []
    for q in quejas:
        tid, d = _nearest_tramo(tramos, q["lon"], q["lat"])
        if d > SNAP_RADIUS_M:
            unassigned.append(q)
        else:
            assignments.append((tid, q))
    return assignments, unassigned


# --------------------------------------------------------------------------- #
# Salida
# --------------------------------------------------------------------------- #
TRAMOS_COLUMNS = [
    "tramo_id",
    "nodo_origen",
    "nodo_destino",
    "longitud_m",
    "nombre_calle",
    "cantidad_contenedores",
    "dias_desde_ultima_recoleccion",
    "historico_quejas_vecinales",
]


def write_outputs(nodos: list[dict], tramos: list[dict]) -> None:
    SALIDA_DIR.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(nodos).to_csv(SALIDA_DIR / "nodos.csv", index=False)
    pd.DataFrame(tramos)[TRAMOS_COLUMNS].to_csv(SALIDA_DIR / "tramos.csv", index=False)


def main() -> None:
    ejes = load_ejes()
    print(f"ejes unicos (dedupe reftramo): {len(ejes)}")

    fragments = clip_to_bbox(ejes)
    print(f"fragmentos en el bbox del piloto: {len(fragments)}")

    sub_segments = node_and_split(fragments)
    nodos, tramos = build_graph(sub_segments)
    print(f"nodos (CC mayor): {len(nodos)}")
    print(f"tramos (CC mayor): {len(tramos)}")

    # --- Etapa 2: contenedores ---
    containers = [c for c in load_containers() if _in_bbox(c["long"], c["lat"])]
    print(f"contenedores en el piloto: {len(containers)}")

    assignments, unassigned, dists = snap_containers(tramos, containers)
    counts = Counter(tid for tid, _c in assignments)
    dias = aggregate_dias(assignments)
    for t in tramos:
        t["cantidad_contenedores"] = counts.get(t["tramo_id"], 0)
        t["dias_desde_ultima_recoleccion"] = dias.get(t["tramo_id"], 0)

    n_tramos = sum(1 for v in counts.values() if v > 0)
    print(f"asignados: {len(assignments)} | no-asignados: {len(unassigned)}")
    print(f"tramos con >=1 contenedor: {n_tramos}")
    if dists:
        print(f"dist snap: min {min(dists):.1f} m, max {max(dists):.1f} m")
    dias_dist = Counter(dias.values())
    print(f"dias_desde_ultima_recoleccion (max por tramo): {dict(sorted(dias_dist.items()))}")

    circuits = validate_circuits(tramos, assignments)
    for code in sorted(circuits):
        r = circuits[code]
        print(
            f"  circuito {code}: {r['contenedores']} cont, {r['tramos']} tramos, {r['componentes']} comp"
        )
    sw = crosscheck_smartwaste()
    print(
        f"SmartWaste (cross-check): {sum(sw.values())} cont en piloto, {len(sw)} circuitos"
    )

    # --- Etapa 3: quejas ---
    quejas_all = load_quejas()
    q_invalid = [q for q in quejas_all if q["lat"] is None or q["lon"] is None]
    q_valid_all = [q for q in quejas_all if q["lat"] is not None and q["lon"] is not None]
    q_valid = dedupe_quejas(q_valid_all)
    q_dedup = len(q_valid_all) - len(q_valid)
    q_pilot = [q for q in q_valid if _in_bbox(q["lon"], q["lat"])]
    q_assign, q_unassigned = snap_quejas(tramos, q_pilot)
    q_counts = Counter(tid for tid, _q in q_assign)
    for t in tramos:
        t["historico_quejas_vecinales"] = q_counts.get(t["tramo_id"], 0)
    print(
        f"quejas residuos totales: {len(quejas_all)} | coords invalidas (cuarentena): "
        f"{len(q_invalid)} | dedup: {q_dedup}"
    )
    print(
        f"quejas en piloto: {len(q_pilot)} | asignadas: {len(q_assign)} | "
        f"no-asignadas (cuarentena): {len(q_unassigned)}"
    )
    q_dist = Counter(q_counts.values())
    print(f"historico_quejas_vecinales dist: {dict(sorted(q_dist.items()))}")

    write_outputs(nodos, tramos)
    print(f"-> {SALIDA_DIR / 'nodos.csv'}")
    print(f"-> {SALIDA_DIR / 'tramos.csv'}")


if __name__ == "__main__":
    main()
