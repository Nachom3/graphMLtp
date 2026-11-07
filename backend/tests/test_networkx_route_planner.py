"""Issue #28: NetworkX planner (rural heuristic + weighted Chinese postman).

Covers weighted distances, multigraph with parallel edges, continuity,
closure, ids, repetitions and cost. No global-optimality claim for the
heuristic component-join case.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from collection.adapters.graphs.networkx_route_planner import (  # noqa: E402
    NetworkxRoutePlanner,
)
from collection.domain.entities.predicted_segment import PredictedSegment  # noqa: E402
from collection.domain.entities.route_config import RouteConfig  # noqa: E402
from collection.domain.entities.segment_features import SegmentFeatures  # noqa: E402
from collection.domain.errors.impossible_route import ImpossibleRoute  # noqa: E402


def seg(
    sid: str,
    u: str,
    v: str,
    length: float,
    containers: int = 1,
    zone: str = "residential",
) -> SegmentFeatures:
    return SegmentFeatures(
        segment_id=sid,
        origin_node=u,
        destination_node=v,
        length_m=length,
        zone_type=zone,  # type: ignore[arg-type]
        container_count=containers,
        days_since_last_collection=1,
        historic_neighbor_complaints=0,
    )


def prio(sid: str, priority: str = "high") -> PredictedSegment:
    return PredictedSegment(segment_id=sid, priority=priority)  # type: ignore[arg-type]


def check_circuit(order: tuple[str, ...], segments: list[SegmentFeatures]) -> None:
    """Continuity + closure on an undirected graph (endpoints may flip)."""
    by_id = {s.segment_id: (s.origin_node, s.destination_node) for s in segments}
    assert order, "orden vacío"
    # Every step must be a known id (parallel keys preserve the segment id).
    for sid in order:
        assert sid in by_id, f"id desconocido {sid!r}"
    # Walk orienting each edge; consecutive edges must share a node.
    first_u, first_v = by_id[order[0]]
    # Two possible orientations for the first edge; try both.
    for start in (first_u, first_v):
        current = start
        ok = True
        for sid in order:
            u, v = by_id[sid]
            if current == u:
                current = v
            elif current == v:
                current = u
            else:
                ok = False
                break
        if ok and current == start:
            return
    raise AssertionError(f"circuito discontinuo o no cerrado: {order!r}")


def test_square_all_edges_cost_10_and_without_spur_cost_8():
    segments = [
        seg("AB", "A", "B", 2.0),
        seg("BC", "B", "C", 2.0),
        seg("CD", "C", "D", 2.0),
        seg("DA", "D", "A", 2.0),
        seg("BE", "B", "E", 1.0),
    ]
    planner = NetworkxRoutePlanner()
    full = planner.plan(
        [],
        segments,
        [prio(s) for s in ["AB", "BC", "CD", "DA", "BE"]],
        RouteConfig(include=("high",)),
    )
    assert full.total_cost_m == pytest.approx(10.0)
    assert set(full.order) == {"AB", "BC", "CD", "DA", "BE"}
    assert full.mandatory == ("AB", "BC", "CD", "DA", "BE")
    assert full.transit == ()
    assert full.coverage == pytest.approx(1.0)
    check_circuit(full.order, segments)

    # BE stops being mandatory (low priority): square alone costs 8.
    square = planner.plan(
        [],
        segments,
        [prio(s) for s in ["AB", "BC", "CD", "DA"]] + [prio("BE", "low")],
        RouteConfig(include=("high",)),
    )
    assert square.total_cost_m == pytest.approx(8.0)
    assert set(square.order) == {"AB", "BC", "CD", "DA"}
    assert "BE" not in square.order
    assert square.repetitions == ()
    assert square.repeated_distance_m == pytest.approx(0.0)
    check_circuit(square.order, segments)


def test_two_mandatory_components_use_zero_container_transit():
    segments = [
        seg("XY", "X", "Y", 5.0, containers=2),
        seg("ZW", "Z", "W", 5.0, containers=2),
        seg("YZ", "Y", "Z", 3.0, containers=0),
    ]
    priorities = [prio("XY"), prio("ZW"), prio("YZ")]
    route = NetworkxRoutePlanner().plan(
        [], segments, priorities, RouteConfig(include=("high",))
    )
    assert set(route.mandatory) == {"XY", "ZW"}
    assert "YZ" not in route.mandatory
    assert "YZ" in route.order and "YZ" in route.transit
    assert route.coverage == pytest.approx(1.0)
    # Transit is not counted as destination but its meters are in the total.
    assert route.total_cost_m == pytest.approx(26.0)
    assert route.repeated_distance_m == pytest.approx(
        route.total_cost_m - (5.0 + 5.0 + 3.0)
    )
    check_circuit(route.order, segments)


def test_disconnected_mandatory_components_raise_documented_error():
    segments = [seg("AB", "A", "B", 2.0), seg("CD", "C", "D", 2.0)]
    with pytest.raises(ImpossibleRoute, match="sin conexión"):
        NetworkxRoutePlanner().plan(
            [], segments, [prio("AB"), prio("CD")], RouteConfig(include=("high",))
        )


def test_parallel_edges_preserve_ids_and_cost_weighted():
    segments = [seg("P1", "A", "B", 10.0), seg("P2", "A", "B", 3.0)]
    route = NetworkxRoutePlanner().plan(
        [], segments, [prio("P1"), prio("P2")], RouteConfig(include=("high",))
    )
    assert route.total_cost_m == pytest.approx(13.0)
    assert set(route.order) == {"P1", "P2"}
    check_circuit(route.order, segments)


def test_zero_container_never_destination_but_usable_as_transit():
    segments = [seg("A1", "A", "B", 4.0, containers=0), seg("B1", "B", "C", 4.0)]
    route = NetworkxRoutePlanner().plan(
        [],
        segments,
        [prio("A1"), prio("B1")],
        RouteConfig(include=("high",)),
    )
    assert route.mandatory == ("B1",)
    assert "A1" not in route.mandatory


def test_repetitions_and_distances_are_consistent():
    segments = [
        seg("AB", "A", "B", 2.0),
        seg("BC", "B", "C", 2.0),
        seg("CD", "C", "D", 2.0),
        seg("DA", "D", "A", 2.0),
        seg("BE", "B", "E", 1.0),
    ]
    route = NetworkxRoutePlanner().plan(
        [],
        segments,
        [prio(s) for s in ["AB", "BC", "CD", "DA", "BE"]],
        RouteConfig(include=("high",)),
    )
    by_len = {s.segment_id: s.length_m for s in segments}
    assert route.total_cost_m == pytest.approx(sum(by_len[s] for s in route.order))
    distinct = sum(by_len[s] for s in set(route.order))
    assert route.repeated_distance_m == pytest.approx(route.total_cost_m - distinct)
    # Repetitions: unique ids seen more than once, in second-occurrence order.
    counts: dict[str, int] = {}
    expected: list[str] = []
    for sid in route.order:
        counts[sid] = counts.get(sid, 0) + 1
        if counts[sid] == 2:
            expected.append(sid)
    assert tuple(expected) == route.repetitions
    check_circuit(route.order, segments)
