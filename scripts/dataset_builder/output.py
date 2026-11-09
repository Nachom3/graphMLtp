"""Validate and persist the generated collection dataset."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd

from .config import BBOX_WGS, CONTAINERS_JSON, EJES_CSV, SEED, SMARTWASTE_CSV, T0
from .features import PRIORIDAD_BAJA_MAX, PRIORIDAD_MEDIA_MAX, ZONA_W

TRAMOS_COLUMNS = [
    "tramo_id",
    "nodo_origen",
    "nodo_destino",
    "longitud_m",
    "nombre_calle",
    "tipo_zona",
    "cantidad_contenedores",
    "dias_desde_ultima_recoleccion",
    "prioridad_recoleccion",
]


def write_outputs(nodos: list[dict], tramos: list[dict], salida_dir: Path) -> None:
    salida_dir.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(nodos).to_csv(salida_dir / "nodos.csv", index=False)
    pd.DataFrame(tramos)[TRAMOS_COLUMNS].to_csv(salida_dir / "tramos.csv", index=False)


def geometry_collection(tramos: list[dict], *, coordinate_decimals: int = 7) -> dict:
    """Export the actual clipped/split IDE geometries, keyed by tramo_id.

    Coordinates are GeoJSON WGS84 [longitude, latitude] in the direction
    nodo_origen -> nodo_destino. These are the same lines used for snapping
    containers, not a reconstruction from the original unsplit IDE feature.
    """
    from .graph import _to_wgs84

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"tramo_id": str(tramo["tramo_id"])},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [round(float(lon), coordinate_decimals), round(float(lat), coordinate_decimals)]
                        for lon, lat in _to_wgs84(tramo["utm"]).coords
                    ],
                },
            }
            for tramo in tramos
        ],
    }


def write_geometries(collection: dict, salida_dir: Path) -> None:
    salida_dir.mkdir(parents=True, exist_ok=True)
    (salida_dir / "geometrias.geojson").write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def _sha256(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_metadata(nodos: list[dict], tramos: list[dict], audit: dict, zona_dist, prio_dist, salida_dir: Path, *, full_city: bool = False) -> None:
    """Escribe dataset/salida/metadata.json: foto T0, semilla, versiones (sha256)
    y balance de clases."""
    inputs = {
        "11_ejes-ide/ejes_montevideo.csv": EJES_CSV,
        "09_levantes/containers.json": CONTAINERS_JSON,
        "10_smartwaste-mvd/containers_wgs84.csv": SMARTWASTE_CSV,
    }
    n = len(tramos)
    meta = {
        "t0": T0,
        "seed": SEED,
        "bbox_wgs84": None if full_city else BBOX_WGS,
        "alcance": "montevideo" if full_city else "piloto",
        "regla_v1": {
            "score": "2*dias + 1*contenedores + zona_w + 2*quejas (comercial 2, industrial 1, residencial 0; quejas = suma sintetica [0,3] por contenedor, seed 0 por tramo_id)",
            "umbrales_originales": {"baja_max": 10, "media_max": 16},
            "umbrales_recalibrados": {"baja_max": PRIORIDAD_BAJA_MAX, "media_max": PRIORIDAD_MEDIA_MAX},
            "nota": "sin quejas: la original (con 3*quejas) daba 99.7% baja; score max 7",
        },
        "conteos": {
            "nodos": len(nodos),
            "tramos": n,
            "contenedores_fuente": audit["contenedores_piloto"],
        },
        "balance_tipo_zona": {k: {"n": v, "pct": round(v / n * 100, 1)} for k, v in sorted(zona_dist.items())},
        "balance_prioridad": {k: {"n": v, "pct": round(v / n * 100, 1)} for k, v in sorted(prio_dist.items())},
        "no_asignados": {
            "contenedores": audit["contenedores_no_asignados"],
        },
        "ejes_excluidos": audit.get("ejes_excluidos", []),
        "input_sha256": {k: _sha256(p) for k, p in inputs.items()},
        "output_sha256": {
            "nodos.csv": _sha256(salida_dir / "nodos.csv"),
            "tramos.csv": _sha256(salida_dir / "tramos.csv"),
            "geometrias.geojson": _sha256(salida_dir / "geometrias.geojson"),
        },
    }
    (salida_dir / "metadata.json").write_text(
        json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


# --------------------------------------------------------------------------- #
# Etapa 6: gates de calidad (fallan fuerte)
# --------------------------------------------------------------------------- #
def quality_gates(nodos: list[dict], tramos: list[dict], audit: dict, *, full_city: bool = False) -> None:
    """Gates de calidad. Falla fuerte (SystemExit) si esquema/cobertura no cierran."""
    errors = []
    nids = {n["nodo_id"] for n in nodos}
    if sorted(nodos[0].keys()) != ["lat", "lon", "nodo_id"]:
        errors.append(f"nodos.csv columnas: {sorted(nodos[0].keys())}")
    if len(nids) != len(nodos):
        errors.append("nodo_id duplicados")
    if sorted(tramos[0].keys()) != sorted(TRAMOS_COLUMNS):
        errors.append(f"tramos.csv columnas: {sorted(tramos[0].keys())}")
    tids = [t["tramo_id"] for t in tramos]
    if len(set(tids)) != len(tids):
        errors.append("tramo_id duplicados")
    margen = 1e-5
    for n in ([] if full_city else nodos):
        if not (
            BBOX_WGS["o"] - margen <= n["lon"] <= BBOX_WGS["e"] + margen
            and BBOX_WGS["s"] - margen <= n["lat"] <= BBOX_WGS["n"] + margen
        ):
            errors.append(f"nodo fuera de bbox: {n['nodo_id']} ({n['lon']},{n['lat']})")
    for t in tramos:
        if t["nodo_origen"] not in nids or t["nodo_destino"] not in nids:
            errors.append(f"FK rota en {t['tramo_id']}")
        if t["nodo_origen"] == t["nodo_destino"]:
            errors.append(f"self-loop en {t['tramo_id']}")
        if t["longitud_m"] <= 0:
            errors.append(f"longitud_m <= 0 en {t['tramo_id']}")
        if t["cantidad_contenedores"] < 0 or t["dias_desde_ultima_recoleccion"] < 0:
            errors.append(f"feature negativa en {t['tramo_id']}")
        if t["tipo_zona"] not in ZONA_W:
            errors.append(f"tipo_zona invalida: {t['tramo_id']}")
        if t["prioridad_recoleccion"] not in ("baja", "media", "alta"):
            errors.append(f"prioridad invalida: {t['tramo_id']}")
    if errors:
        for e in errors:
            print(f"[GATE] FALLIDO: {e}")
        raise SystemExit(1)
    print(f"[GATE] esquema OK ({len(nodos)} nodos, {len(tramos)} tramos), cobertura OK")
    print(f"[GATE] no-asignados -> contenedores: {audit['contenedores_no_asignados']}")


