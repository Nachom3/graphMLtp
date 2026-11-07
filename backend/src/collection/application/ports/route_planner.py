"""Route planner port (template)."""
from __future__ import annotations
from typing import Protocol
from ...domain.entities.predicted_segment import PredictedSegment
from ...domain.entities.route import Route
from ...domain.entities.route_config import RouteConfig
from ...domain.entities.segment_features import SegmentFeatures

class RoutePlanner(Protocol):
    def plan(self, nodes: list[dict], segments: list[SegmentFeatures], priorities: list[PredictedSegment], config: RouteConfig) -> Route:
        """Template. TODO: implement."""
        ...
