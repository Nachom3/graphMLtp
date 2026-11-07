"""Issue #28: PlanRoute selection with a fake planner.

The use case filters priorities to ids with ``container_count > 0``,
keeps the full graph for circulation and delegates without mutating
inputs, labels, CSVs or training.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from collection.application.use_cases.plan_route.use_case import PlanRoute  # noqa: E402
from collection.domain.entities.predicted_segment import PredictedSegment  # noqa: E402
from collection.domain.entities.route import Route  # noqa: E402
from collection.domain.entities.route_config import RouteConfig  # noqa: E402
from collection.domain.entities.segment_features import SegmentFeatures  # noqa: E402
from collection.domain.errors.impossible_route import ImpossibleRoute  # noqa: E402


def make_segment(
    segment_id: str,
    origin: str = "N1",
    destination: str = "N2",
    containers: int = 1,
) -> SegmentFeatures:
    return SegmentFeatures(
        segment_id=segment_id,
        origin_node=origin,
        destination_node=destination,
        length_m=10.0,
        zone_type="residential",
        container_count=containers,
        days_since_last_collection=1,
        historic_neighbor_complaints=0,
    )


class FakePlanner:
    """Records what the use case delegates (no NetworkX here)."""

    def __init__(self) -> None:
        self.calls: list[dict] = []

    def plan(self, nodes, segments, priorities, config) -> Route:
        self.calls.append(
            {
                "nodes": nodes,
                "segments": segments,
                "priorities": priorities,
                "config": config,
            }
        )
        return Route(order=("T1",), repetitions=(), total_cost_m=10.0)


def test_priority_and_config_preserved_for_container_segments_full_graph_kept():
    nodes = [{"node_id": "N1", "lon": 0.0, "lat": 0.0}]
    segments = [
        make_segment("T1", "N1", "N2", containers=2),
        make_segment("T2", "N2", "N3", containers=0),
        make_segment("T3", "N3", "N1", containers=1),
    ]
    priorities = [
        PredictedSegment(segment_id="T1", priority="high"),
        PredictedSegment(segment_id="T2", priority="high"),
        PredictedSegment(segment_id="T3", priority="medium"),
    ]
    config = RouteConfig(include=("medium", "high"))
    nodes_before = list(nodes)
    segments_before = list(segments)
    priorities_before = list(priorities)

    planner = FakePlanner()
    use_case = PlanRoute(planner=planner)  # nosec -- in-memory fake, no SQL
    route = use_case.execute(nodes, segments, priorities, config)

    assert route.order == ("T1",)
    assert len(planner.calls) == 1
    call = planner.calls[0]
    # Full graph delivered for circulation (T2 with zero containers kept).
    assert [s.segment_id for s in call["segments"]] == ["T1", "T2", "T3"]
    # Zero-container destinations filtered out, container ones preserved.
    assert [p.segment_id for p in call["priorities"]] == ["T1", "T3"]
    assert call["priorities"][0].priority == "high"
    assert call["priorities"][1].priority == "medium"
    assert call["config"] == config
    # No input list mutated (identity, length and order preserved).
    assert nodes == nodes_before and segments == segments_before
    assert priorities == priorities_before
    assert call["nodes"] is not nodes
    assert call["segments"] is not segments
    assert call["priorities"] is not priorities


def test_zero_container_never_destination_even_with_high_priority():
    segments = [
        make_segment("T1", "N1", "N2", containers=0),
        make_segment("T2", "N2", "N3", containers=2),
    ]
    priorities = [
        PredictedSegment(segment_id="T1", priority="high"),
        PredictedSegment(segment_id="T2", priority="low"),
    ]
    planner = FakePlanner()
    use_case = PlanRoute(planner=planner)  # nosec -- in-memory fake, no SQL
    with pytest.raises(ImpossibleRoute):
        use_case.execute([], segments, priorities, RouteConfig(include=("high",)))
    # Nothing delegated: T1 is not a destination, T2 is not included.
    assert planner.calls == []


def test_all_zero_containers_has_no_destinations():
    segments = [make_segment("T1", containers=0), make_segment("T2", containers=0)]
    priorities = [
        PredictedSegment(segment_id="T1", priority="high"),
        PredictedSegment(segment_id="T2", priority="medium"),
    ]
    planner = FakePlanner()
    use_case = PlanRoute(planner=planner)  # nosec -- in-memory fake, no SQL
    with pytest.raises(ImpossibleRoute, match="selección vacía"):
        use_case.execute(
            [], segments, priorities, RouteConfig(include=("medium", "high"))
        )
    assert planner.calls == []


def test_empty_selection_after_include_filter_raises():
    segments = [make_segment("T1", containers=2)]
    priorities = [PredictedSegment(segment_id="T1", priority="low")]
    planner = FakePlanner()
    with pytest.raises(ImpossibleRoute, match="selección vacía"):
        PlanRoute(planner=planner).execute(
            [], segments, priorities, RouteConfig(include=("high",))
        )
    assert planner.calls == []
