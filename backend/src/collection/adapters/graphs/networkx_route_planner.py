"""NetworkX route planner (template)."""
from __future__ import annotations
from ...domain.entities.predicted_segment import PredictedSegment
from ...domain.entities.route import Route
from ...domain.entities.route_config import RouteConfig
from ...domain.entities.segment_features import SegmentFeatures

class NetworkxRoutePlanner:
    """Template. TODO: implement."""
    def plan(self, nodes: list[dict], segments: list[SegmentFeatures], priorities: list[PredictedSegment], config: RouteConfig) -> Route:
        """Template. TODO: implement."""
        raise NotImplementedError
