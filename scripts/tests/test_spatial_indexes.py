"""Regression checks for indexed builder operations against the legacy scans."""
from collections import Counter

from shapely.geometry import LineString, Point

from scripts.dataset_builder import containers, graph
from scripts.dataset_builder.config import _INV


def _brute_split(fragments):
    result = []
    for i, frag in enumerate(fragments):
        line = frag["utm"]
        distances = set()
        for j, other in enumerate(fragments):
            if i == j or not line.intersects(other["utm"]):
                continue
            for point in graph._extract_points(line.intersection(other["utm"])):
                distance = line.project(point)
                if graph.SNAP_TOL_M < distance < line.length - graph.SNAP_TOL_M:
                    distances.add(round(distance, 6))
        for k, piece in enumerate(graph._split_line(line, sorted(distances))):
            result.append((frag["reftramo"], k, piece.wkb_hex))
    return result


def test_indexed_intersections_equal_brute_force():
    lines = [
        [(0, 0), (20, 0)], [(4, -5), (4, 5)], [(12, 0), (12, 10)],
        [(0, 4), (20, 4)], [(40, 40), (50, 40)], [(15, 0), (18, 0)],
    ]
    fragments = [
        {"reftramo": i, "nombre": str(i), "utm": LineString(coords)}
        for i, coords in enumerate(lines)
    ]
    indexed = graph.node_and_split(fragments)
    assert [(x["reftramo"], x["frag_idx"], x["utm"].wkb_hex) for x in indexed] == _brute_split(fragments)


def test_node_snap_uses_first_representative_not_nearest():
    # The third start is closer to the second representative (0.6) but must
    # map to the first (0.0), matching the original first-match scan.
    subs = [
        {"reftramo": 1, "nombre": "", "utm": LineString([(0, 0), (10, 0)]), "frag_idx": 0},
        {"reftramo": 2, "nombre": "", "utm": LineString([(0.6, 0), (10, 0)]), "frag_idx": 0},
        {"reftramo": 3, "nombre": "", "utm": LineString([(0.4, 0), (10, 0)]), "frag_idx": 0},
    ]
    _, edges = graph.build_graph(subs, keep_all_components=True)
    origins = {edge["tramo_id"]: edge["nodo_origen"] for edge in edges}
    assert origins["1"] == origins["3"]
    assert origins["1"] != origins["2"]


def test_city_mode_preserves_disconnected_components():
    subs = [
        {"reftramo": 1, "nombre": "", "utm": LineString([(0, 0), (10, 0)]), "frag_idx": 0},
        {"reftramo": 2, "nombre": "", "utm": LineString([(100, 0), (110, 0)]), "frag_idx": 0},
    ]
    assert len(graph.build_graph(subs)[1]) == 1
    assert len(graph.build_graph(subs, keep_all_components=True)[1]) == 2


def test_closed_road_is_preserved_as_two_connected_edges():
    line = LineString([(0, 0), (3, 0), (3, 4), (0, 0)])
    subs = [{"reftramo": 1, "nombre": "rotonda", "utm": line, "frag_idx": 0}]
    nodes, edges = graph.build_graph(subs, keep_all_components=True)
    assert len(nodes) == len(edges) == 2
    assert all(edge["nodo_origen"] != edge["nodo_destino"] for edge in edges)
    assert edges[0]["nodo_origen"] == edges[1]["nodo_destino"]
    assert edges[0]["nodo_destino"] == edges[1]["nodo_origen"]
    assert abs(sum(edge["utm"].length for edge in edges) - line.length) < 1e-8
    assert list(edges[0]["utm"].coords)[0] == list(line.coords)[0]
    assert list(edges[1]["utm"].coords)[-1] == list(line.coords)[-1]


def test_small_closed_road_does_not_collapse_at_midpoint():
    line = LineString([(0, 0), (0.2, 0.2), (0.4, 0), (0.2, -0.2), (0, 0)])
    subs = [{"reftramo": 1, "nombre": "", "utm": line, "frag_idx": 0}]
    _, edges = graph.build_graph(subs, keep_all_components=True)
    assert len(edges) == 2
    assert all(edge["nodo_origen"] != edge["nodo_destino"] for edge in edges)


def test_city_mode_preserves_centimeter_road_and_audits_threshold_policy():
    short = LineString([(0, 0), (0.02, 0)])
    artifact = LineString([(2, 0), (2.001, 0)])
    fragments = graph.all_ejes([(1, "short", short), (2, "artifact", artifact)])
    assert [fragment["reftramo"] for fragment in fragments] == [1]
    pieces = graph.node_and_split(fragments, min_segment_length=0)
    nodes, edges = graph.build_graph(
        pieces, keep_all_components=True, length_decimals=8, coordinate_decimals=12
    )
    assert len(nodes) == len(edges) == 2
    assert all(edge["longitud_m"] > 0 for edge in edges)
    assert sum(edge["utm"].length for edge in edges) == short.length


def test_nearest_matches_brute_force_including_rounded_ties():
    lon, lat = -56.16, -34.91
    x, y = _INV.transform(lon, lat)
    # z is infinitesimally nearer than a; legacy rounds both to 1.000 m,
    # and therefore selects a, even though STRtree.nearest() selects z.
    lines = [
        {"tramo_id": "z", "utm": LineString([(x + 1.0001, y - 5), (x + 1.0001, y + 5)])},
        {"tramo_id": "a", "utm": LineString([(x + 1.0004, y - 5), (x + 1.0004, y + 5)])},
        {"tramo_id": "far", "utm": LineString([(x + 8, y - 5), (x + 8, y + 5)])},
    ]
    point = Point(x, y)
    expected = min((round(t["utm"].distance(point), 3), t["tramo_id"]) for t in lines)
    result = containers._nearest_tramo(lines, lon, lat)
    assert result == (expected[1], expected[0]) == ("a", 1.0)
    rows = [{"long": lon, "lat": lat}]
    assigned, unassigned, _ = containers.snap_containers(lines, rows)
    assert Counter(tid for tid, _ in assigned) == {"a": 1}
    assert not unassigned
