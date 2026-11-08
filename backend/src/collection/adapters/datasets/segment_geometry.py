"""Read persisted WGS84 road geometry without a runtime GIS dependency."""
from __future__ import annotations

import json
from math import isfinite
from pathlib import Path
from typing import Any

from ...domain.errors.invalid_dataset import InvalidDataset


def load_segment_geometries(source: str, *, required: bool) -> dict[str, dict[str, Any]]:
    """Read the builder's GeoJSON, keyed by segment id.

    Coordinates are GeoJSON [lon, lat] and follow origin -> destination.
    An absent sidecar is allowed only for explicitly injected legacy fixtures.
    """
    base = Path(source)
    path = (base if base.is_dir() else base.parent) / "geometrias.geojson"
    if not path.exists():
        if required:
            raise InvalidDataset(f"no existe {path}; generar el dataset completo y sus geometrías")
        return {}
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise InvalidDataset(f"geometrías ilegibles: {path}: {exc}") from exc
    if not isinstance(document, dict) or document.get("type") != "FeatureCollection" or not isinstance(document.get("features"), list):
        raise InvalidDataset(f"GeoJSON inválido en {path}: se esperaba FeatureCollection")
    if not document["features"]:
        raise InvalidDataset(f"GeoJSON vacío en {path}")
    result: dict[str, dict[str, Any]] = {}
    for feature in document["features"]:
        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            raise InvalidDataset("GeoJSON contiene un feature inválido")
        props = feature.get("properties")
        geometry = feature.get("geometry")
        segment_id = props.get("tramo_id") if isinstance(props, dict) else None
        if not isinstance(segment_id, str) or not segment_id or segment_id in result:
            raise InvalidDataset("GeoJSON contiene tramo_id vacío, inválido o duplicado")
        if not isinstance(geometry, dict) or geometry.get("type") != "LineString":
            raise InvalidDataset(f"geometría de {segment_id!r} debe ser LineString")
        coordinates = geometry.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            raise InvalidDataset(f"geometría de {segment_id!r} requiere al menos dos puntos")
        for point in coordinates:
            if (not isinstance(point, list) or len(point) != 2
                or any(isinstance(value, bool) or not isinstance(value, (int, float)) or not isfinite(value) for value in point)
                or not -180 <= point[0] <= 180 or not -90 <= point[1] <= 90):
                raise InvalidDataset(f"coordenada WGS84 inválida en tramo {segment_id!r}")
        result[segment_id] = {"type": "LineString", "coordinates": coordinates}
    return result
