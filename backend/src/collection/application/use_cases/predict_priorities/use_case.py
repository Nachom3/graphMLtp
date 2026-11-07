"""Use case predict_priorities implementation stub (template)."""
from __future__ import annotations
from ....domain.entities.predicted_segment import PredictedSegment
from ....domain.entities.segment_features import SegmentFeatures
from ...ports.priority_predictor import PriorityPredictor
from .contract import PredictPrioritiesContract


class PredictPriorities(PredictPrioritiesContract):
    def __init__(self, predictor: PriorityPredictor):
        self._predictor = predictor

    def execute(self, model_id: str, segments: list[SegmentFeatures]) -> list[PredictedSegment]:
        """Template. TODO: implement."""
        raise NotImplementedError
