"""Priority predictor port (template)."""
from __future__ import annotations
from typing import Protocol
from ...domain.entities.predicted_segment import PredictedSegment
from ...domain.entities.segment_features import SegmentFeatures

class PriorityPredictor(Protocol):
    @property
    def model_id(self) -> str: ...
    def predict(self, segments: list[SegmentFeatures]) -> list[PredictedSegment]: ...
