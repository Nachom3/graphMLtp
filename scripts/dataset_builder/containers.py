"""Load, assign and audit containers against the road graph."""
from __future__ import annotations

import json
from collections import Counter, defaultdict

import networkx as nx
import pandas as pd
from shapely.geometry import Point

from .config import _INV, BBOX_WGS, CONTAINERS_JSON, SMARTWASTE_CSV, SNAP_RADIUS_M


def _load_json(path) -> list:
    """Carga un JSON de entrada con error claro si falta o es invalido."""
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError as err:
        raise SystemExit(f"Falta archivo de entrada: {path}") from err
    except json.JSONDecodeError as err:
        raise SystemExit(f"JSON invalido en {path}: {err}") from err


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


