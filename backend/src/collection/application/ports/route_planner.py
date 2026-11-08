"""Route planner port (issue #28)."""

from __future__ import annotations

from typing import Protocol

from ...domain.entities.predicted_segment import PredictedSegment
from ...domain.entities.route import Route
from ...domain.entities.route_config import RouteConfig
from ...domain.entities.segment_features import SegmentFeatures


class RoutePlanner(Protocol):
    def plan(
        self,
        nodes: list[dict],
        segments: list[SegmentFeatures],
        priorities: list[PredictedSegment],
        config: RouteConfig,
    ) -> Route:
        """Plan a closed circuit over the full graph.

        Mandatory = ``container_count > 0`` and priority in
        ``config.include``; zero-container edges stay as transit only.
        Uses ``config.start_node_id`` as the Eulerian source when provided;
        raises ``ImpossibleRoute`` if it is not accessible from the chosen
        route. Also raises when no destination remains or mandatory parts have
        no connection through the full graph.
        """
        ...
