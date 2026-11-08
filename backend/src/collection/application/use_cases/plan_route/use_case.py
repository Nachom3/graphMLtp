"""Use case plan_route (issue #28).

Selection rule: a segment with ``container_count == 0`` is never a
destination, even with medium/high priority; it stays available as
transit. The use case filters ``priorities`` to ids with
``container_count > 0``, keeps every segment for circulation and
delegates to the injected planner without mutating inputs, labels,
CSVs or training.
"""

from __future__ import annotations

from ....domain.entities.predicted_segment import PredictedSegment
from ....domain.entities.route import Route
from ....domain.entities.route_config import RouteConfig
from ....domain.entities.segment_features import SegmentFeatures
from ....domain.errors.impossible_route import ImpossibleRoute
from ...ports.route_planner import RoutePlanner
from .contract import PlanRouteContract


class PlanRoute(PlanRouteContract):
    def __init__(self, planner: RoutePlanner):
        self._planner = planner

    def execute(
        self,
        nodes: list[dict],
        segments: list[SegmentFeatures],
        priorities: list[PredictedSegment],
        config: RouteConfig,
    ) -> Route:
        """Filter container==0 out of destinations, keep full graph, delegate.

        ``config.start_node_id`` is passed unchanged for the planner to use as
        the Eulerian circuit source when it belongs to the connected route.
        """
        segment_by_id = {segment.segment_id: segment for segment in segments}
        include = set(config.include)
        # Filtered priorities: only ids with containers; unknown ids ignored
        # (they cannot be routed). Preserve input order, dedupe by id.
        seen: set[str] = set()
        filtered: list[PredictedSegment] = []
        for prediction in priorities:
            segment = segment_by_id.get(prediction.segment_id)
            if segment is None:
                continue
            if segment.container_count <= 0:
                continue
            if prediction.segment_id in seen:
                continue
            seen.add(prediction.segment_id)
            filtered.append(prediction)
        if not filtered:
            raise ImpossibleRoute(
                "selección vacía: ningún tramo con contenedores para planificar"
            )
        has_mandatory = any(prediction.priority in include for prediction in filtered)
        if not has_mandatory:
            raise ImpossibleRoute(
                "selección vacía: ningún tramo con contenedores en "
                f"prioridades incluidas {sorted(include)}"
            )
        # New lists so the planner cannot mutate the caller's lists.
        return self._planner.plan(list(nodes), list(segments), list(filtered), config)
