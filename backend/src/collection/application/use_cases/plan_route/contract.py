"""Use case contract plan_route (template)."""
from __future__ import annotations
from abc import ABC, abstractmethod
from ....domain.entities.predicted_segment import PredictedSegment
from ....domain.entities.route import Route
from ....domain.entities.route_config import RouteConfig
from ....domain.entities.segment_features import SegmentFeatures

class PlanRouteContract(ABC):
    """Abstract use case contract."""

    @abstractmethod
    def execute(self, nodes: list[dict], segments: list[SegmentFeatures], priorities: list[PredictedSegment], config: RouteConfig) -> Route:
        """Abstract method. TODO: implement in use case."""
        raise NotImplementedError
