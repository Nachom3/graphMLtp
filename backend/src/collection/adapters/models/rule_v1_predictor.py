"""Rule v1 predictor (template)."""
from __future__ import annotations
from ...domain.entities.predicted_segment import PredictedSegment
from ...domain.entities.segment_features import SegmentFeatures

class RuleV1Predictor:
    """Template. TODO: implement."""
    def __init__(self, model_id: str = "rule-v1") -> None:
        self._id = model_id
    @property
    def model_id(self) -> str:
        return self._id
    def predict(self, segments: list[SegmentFeatures]) -> list[PredictedSegment]:
        """Template. TODO: implement."""
        raise NotImplementedError
