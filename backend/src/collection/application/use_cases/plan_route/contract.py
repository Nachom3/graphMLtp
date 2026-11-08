"""Use case contract plan_route (issue #28)."""

from __future__ import annotations

from abc import ABC, abstractmethod

from ....domain.entities.predicted_segment import PredictedSegment
from ....domain.entities.route import Route
from ....domain.entities.route_config import RouteConfig
from ....domain.entities.segment_features import SegmentFeatures


class PlanRouteContract(ABC):
    """Abstract use case contract."""

    @abstractmethod
    def execute(
        self,
        nodes: list[dict],
        segments: list[SegmentFeatures],
        priorities: list[PredictedSegment],
        config: RouteConfig,
    ) -> Route:
        """Plan a closed circuit; never mutates inputs.

        Raises ``ImpossibleRoute`` when no destination remains after the
        container>0 + include filter, when the planner reports no connection
        through the full graph, or when the configured start node cannot be
        used as the source of the closed circuit.
        """
        raise NotImplementedError
