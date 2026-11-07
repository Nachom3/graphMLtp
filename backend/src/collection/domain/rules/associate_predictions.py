"""Associate predictions rule (issue #27, pure domain).

Guarantees the 1:1 association between stable segment IDs and
priorities: exactly one priority per ID, in input order, without loss
or reordering. Any inconsistency raises ``PredictionWithoutSegment``
instead of silently dropping or mixing rows.
"""
from __future__ import annotations

from ..entities.predicted_segment import PredictedSegment
from ..errors.prediction_without_segment import PredictionWithoutSegment

_VALID_PRIORITIES = ("low", "medium", "high")


def associate_predictions(
    segment_ids: list[str], priorities: list[str]
) -> list[PredictedSegment]:
    """Zip IDs to priorities preserving order; raise on any mismatch."""
    if len(segment_ids) != len(priorities):
        raise PredictionWithoutSegment(
            f"asociación 1:1 rota: {len(segment_ids)} tramos vs "
            f"{len(priorities)} prioridades"
        )
    seen: set[str] = set()
    result: list[PredictedSegment] = []
    for segment_id, priority in zip(segment_ids, priorities, strict=True):
        if not segment_id or not segment_id.strip():
            raise PredictionWithoutSegment("tramo_id debe ser no vacío")
        if segment_id in seen:
            raise PredictionWithoutSegment(f"tramo_id duplicado: {segment_id!r}")
        seen.add(segment_id)
        if priority not in _VALID_PRIORITIES:
            raise PredictionWithoutSegment(
                f"tramo {segment_id!r}: prioridad {priority!r} inválida; "
                f"esperaba una de {list(_VALID_PRIORITIES)}"
            )
        result.append(PredictedSegment(segment_id=segment_id, priority=priority))  # type: ignore[arg-type]
    return result
