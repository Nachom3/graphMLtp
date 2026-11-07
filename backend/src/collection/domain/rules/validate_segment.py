"""Validate segment rule (issue #27, pure domain).

Checks one ``SegmentFeatures`` without I/O or ML. Returns a list of
human-readable issues (Spanish); an empty list means valid. The
application layer raises on non-empty results instead of inventing
values.
"""
from __future__ import annotations

from math import isfinite

from ..entities.segment_features import SegmentFeatures

_VALID_ZONES = ("residential", "commercial", "industrial")


def validate_segment_features(segment: SegmentFeatures) -> list[str]:
    """Return comprehensible issues for ``segment`` (``[]`` when valid)."""
    issues: list[str] = []
    if not segment.segment_id or not segment.segment_id.strip():
        issues.append("tramo_id debe ser no vacío")
    if not segment.origin_node or not segment.origin_node.strip():
        issues.append(f"tramo {segment.segment_id!r}: nodo_origen debe ser no vacío")
    if not segment.destination_node or not segment.destination_node.strip():
        issues.append(f"tramo {segment.segment_id!r}: nodo_destino debe ser no vacío")
    if (
        not isinstance(segment.length_m, (int, float))
        or isinstance(segment.length_m, bool)
        or not isfinite(float(segment.length_m))
        or float(segment.length_m) <= 0
    ):
        issues.append(f"tramo {segment.segment_id!r}: longitud_m debe ser > 0")
    if segment.zone_type not in _VALID_ZONES:
        issues.append(
            f"tramo {segment.segment_id!r}: tipo_zona debe ser una de "
            f"{list(_VALID_ZONES)}"
        )
    for field, value in (
        ("cantidad_contenedores", segment.container_count),
        ("dias_desde_ultima_recoleccion", segment.days_since_last_collection),
        ("historico_quejas_vecinales", segment.historic_neighbor_complaints),
    ):
        if (
            isinstance(value, bool)
            or not isinstance(value, int)
            or value < 0
        ):
            issues.append(f"tramo {segment.segment_id!r}: {field} debe ser entero >= 0")
    return issues
