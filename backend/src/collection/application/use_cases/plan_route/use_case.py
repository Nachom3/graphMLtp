"""Use case plan_route implementation stub (template)."""
from __future__ import annotations
from ....domain.entities.predicted_segment import PredictedSegment
from ....domain.entities.route import Route
from ....domain.entities.route_config import RouteConfig
from ....domain.entities.segment_features import SegmentFeatures
from ...ports.route_planner import RoutePlanner
from .contract import PlanRouteContract


class PlanRoute(PlanRouteContract):
    def __init__(self, planner: RoutePlanner):
        self._planner = planner

    def execute(self, nodes: list[dict], segments: list[SegmentFeatures], priorities: list[PredictedSegment], config: RouteConfig) -> Route:
        """Template. TODO: implement."""
        raise NotImplementedError
