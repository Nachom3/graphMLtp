"""Use case contract predict_priorities (template)."""
from __future__ import annotations
from abc import ABC, abstractmethod
from ....domain.entities.predicted_segment import PredictedSegment
from ....domain.entities.segment_features import SegmentFeatures

class PredictPrioritiesContract(ABC):
    """Abstract use case contract."""

    @abstractmethod
    def execute(self, model_id: str, segments: list[SegmentFeatures]) -> list[PredictedSegment]:
        """Abstract method. TODO: implement in use case."""
        raise NotImplementedError

    @abstractmethod
    def explain(self, model_id: str, segment: SegmentFeatures) -> dict:
        """Explain one prediction. TODO: implement in use case."""
        raise NotImplementedError
