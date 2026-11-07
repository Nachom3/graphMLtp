"""Use case predict_priorities (issue #27).

Thin delegation over a FITTED predictor: never calls ``fit``, never
needs training rows from the client, never touches CSVs. It validates
segments with the domain rule, checks the requested ``model_id`` and
verifies the 1:1 ID association on the way back (no loss, no mixing).
"""
from __future__ import annotations

from ....domain.entities.predicted_segment import PredictedSegment
from ....domain.entities.segment_features import SegmentFeatures
from ....domain.errors.prediction_without_segment import PredictionWithoutSegment
from ....domain.rules.validate_segment import validate_segment_features
from ...ports.priority_predictor import PriorityPredictor
from .contract import PredictPrioritiesContract


class PredictPriorities(PredictPrioritiesContract):
    def __init__(self, predictor: PriorityPredictor):
        self._predictor = predictor

    def execute(self, model_id: str, segments: list[SegmentFeatures]) -> list[PredictedSegment]:
        """Predict one priority per segment, preserving ID order."""
        if model_id != self._predictor.model_id:
            raise ValueError(
                f"modelo desconocido: {model_id!r}; disponible: {self._predictor.model_id!r}"
            )
        if not segments:
            return []
        seen: set[str] = set()
        for segment in segments:
            if segment.segment_id in seen:
                raise ValueError(f"tramo_id duplicado: {segment.segment_id!r}")
            seen.add(segment.segment_id)
            issues = validate_segment_features(segment)
            if issues:
                raise ValueError("; ".join(issues))
        predicted = self._predictor.predict(list(segments))
        if len(predicted) != len(segments):
            raise PredictionWithoutSegment(
                f"asociación 1:1 rota: {len(segments)} tramos vs "
                f"{len(predicted)} predicciones"
            )
        for segment, item in zip(segments, predicted, strict=True):
            if item.segment_id != segment.segment_id:
                raise PredictionWithoutSegment(
                    f"predicción mezclada: esperaba {segment.segment_id!r} "
                    f"pero llegó {item.segment_id!r}"
                )
        return predicted
