#!/usr/bin/env python3
"""Build the reproducible collection dataset (issue #9).

Usage:
    .venv/bin/python scripts/build_dataset.py
"""
from __future__ import annotations

from collections import Counter

if __package__:
    from .dataset_builder import config, containers, features, graph, output
else:
    from dataset_builder import config, containers, features, graph, output

# Keep the original entry-point names available to callers.
ROOT = config.ROOT
DATASET_DIR = config.DATASET_DIR
SALIDA_DIR = config.SALIDA_DIR
BBOX_WGS = config.BBOX_WGS
SNAP_TOL_M = config.SNAP_TOL_M
MIN_SEG_LEN_M = config.MIN_SEG_LEN_M
T0 = config.T0
SEED = config.SEED
EJES_CSV = config.EJES_CSV
CONTAINERS_JSON = config.CONTAINERS_JSON
SMARTWASTE_CSV = config.SMARTWASTE_CSV
SNAP_RADIUS_M = config.SNAP_RADIUS_M
SRC_CRS = config.SRC_CRS
DST_CRS = config.DST_CRS
_FWD, _INV, _GEOD = config._FWD, config._INV, config._GEOD
_to_wgs84, _to_utm = graph._to_wgs84, graph._to_utm
_utm_to_wgs84, _wgs84_to_utm = graph._utm_to_wgs84, graph._wgs84_to_utm
load_ejes, clip_to_bbox = graph.load_ejes, graph.clip_to_bbox
_flatten_linestrings, _extract_points = graph._flatten_linestrings, graph._extract_points
node_and_split, _split_line = graph.node_and_split, graph._split_line
_geodetic_length_m, _tramo_id, build_graph = graph._geodetic_length_m, graph._tramo_id, graph.build_graph
_load_json, load_containers = containers._load_json, containers.load_containers
_in_bbox, _nearest_tramo = containers._in_bbox, containers._nearest_tramo
snap_containers, aggregate_dias = containers.snap_containers, containers.aggregate_dias
validate_circuits, crosscheck_smartwaste = containers.validate_circuits, containers.crosscheck_smartwaste
assign_tipo_zona, assign_prioridad = features.assign_tipo_zona, features.assign_prioridad
ZONA_W = features.ZONA_W
PRIORIDAD_BAJA_MAX = features.PRIORIDAD_BAJA_MAX
PRIORIDAD_MEDIA_MAX = features.PRIORIDAD_MEDIA_MAX
TRAMOS_COLUMNS = output.TRAMOS_COLUMNS
_sha256, quality_gates = output._sha256, output.quality_gates


def write_outputs(nodos: list[dict], tramos: list[dict]) -> None:
    output.write_outputs(nodos, tramos, SALIDA_DIR)


def write_metadata(nodos: list[dict], tramos: list[dict], audit: dict, zona_dist, prio_dist) -> None:
    output.write_metadata(nodos, tramos, audit, zona_dist, prio_dist, SALIDA_DIR)


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

    # --- Etapa 4: tipo_zona (simulada) ---
    assign_tipo_zona(tramos)
    zona_dist = Counter(t["tipo_zona"] for t in tramos)
    pct = ", ".join(f"{k} {v / len(tramos) * 100:.1f}%" for k, v in sorted(zona_dist.items()))
    print(f"tipo_zona (simulada, seed {SEED}): {dict(sorted(zona_dist.items()))} -> {pct}")

    # --- Etapa 5: prioridad_recoleccion (regla v1 recalibrada) ---
    assign_prioridad(tramos)
    prio_dist = Counter(t["prioridad_recoleccion"] for t in tramos)
    pct_p = ", ".join(f"{k} {v / len(tramos) * 100:.1f}%" for k, v in sorted(prio_dist.items()))
    print(f"prioridad_recoleccion (regla v1 recalibrada): {dict(sorted(prio_dist.items()))} -> {pct_p}")

    # "utm" (geometria interna del snap) ya no se necesita
    for t in tramos:
        t.pop("utm", None)

    # --- Etapa 6: gates de calidad ---
    audit = {
        "contenedores_piloto": len(containers),
        "contenedores_no_asignados": len(unassigned),
    }
    quality_gates(nodos, tramos, audit)

    write_outputs(nodos, tramos)
    write_metadata(nodos, tramos, audit, zona_dist, prio_dist)
    print(f"-> {SALIDA_DIR / 'nodos.csv'}")
    print(f"-> {SALIDA_DIR / 'tramos.csv'}")
    print(f"-> {SALIDA_DIR / 'metadata.json'}")


if __name__ == "__main__":
    main()
