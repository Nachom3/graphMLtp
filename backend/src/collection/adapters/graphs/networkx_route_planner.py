"""NetworkX route planner (issue #28).

Rural + Chinese postman over an undirected graph with distances in
meters and a single truck doing a closed circuit.

- The full graph stays traversable; mandatory edges are those with
  ``container_count > 0`` and priority in ``config.include``.
- Disconnected mandatory components are joined with weighted shortest
  paths over the full graph through an auxiliary minimum spanning tree;
  those paths are transit, not destinations.
- The weighted Chinese postman runs on the chosen connected network:
  odd-degree pairing via shortest paths + ``min_weight_matching``,
  duplication, then ``eulerian_circuit`` over a ``MultiGraph``.
  ``eulerize`` is NOT used: it minimizes the number of added edges,
  not meters.
- Heuristic note: the circuit is optimal over the chosen network, but
  the component connection is a heuristic, so global rural-postman
  optimality is NOT promised. The network is bidirectional by
  simplification; it does not validate real senses, capacity,
  schedules or multiple vehicles.
"""

from __future__ import annotations

from typing import Any

import networkx as nx

from ...domain.entities.predicted_segment import PredictedSegment
from ...domain.entities.route import Route
from ...domain.entities.route_config import RouteConfig
from ...domain.entities.segment_features import SegmentFeatures
from ...domain.errors.impossible_route import ImpossibleRoute


def _node_id(node: dict | Any) -> str:
    if isinstance(node, dict):
        return str(node["node_id"])
    node_id = node.node_id  # type: ignore[union-attr]
    return str(node_id)


def _mandatory_ids(
    segments: list[SegmentFeatures],
    priority_by_id: dict[str, str],
    include: set[str],
) -> list[str]:
    mandatory: list[str] = []
    for segment in segments:
        if segment.container_count <= 0:
            continue
        if priority_by_id.get(segment.segment_id) not in include:
            continue
        if segment.segment_id not in mandatory:
            mandatory.append(segment.segment_id)
    return mandatory


def _build_full_multigraph(
    nodes: list[dict],
    segments: list[SegmentFeatures],
) -> nx.MultiGraph:
    graph: nx.MultiGraph = nx.MultiGraph()
    for node in nodes:
        graph.add_node(_node_id(node))
    seen: set[str] = set()
    for segment in segments:
        if segment.segment_id in seen:
            raise ValueError(f"segment_id duplicado: {segment.segment_id!r}")
        seen.add(segment.segment_id)
        if segment.length_m <= 0:
            raise ValueError(f"tramo {segment.segment_id!r}: length_m debe ser > 0")
        graph.add_node(segment.origin_node)
        graph.add_node(segment.destination_node)
        graph.add_edge(
            segment.origin_node,
            segment.destination_node,
            key=segment.segment_id,
            weight=float(segment.length_m),
            segment_id=segment.segment_id,
            length_m=float(segment.length_m),
        )
    return graph


def _shortest_segment_for_step(graph: nx.MultiGraph, first: str, second: str) -> str:
    candidates = graph.get_edge_data(first, second)
    if not candidates:
        raise ImpossibleRoute(f"sin conexión entre {first!r} y {second!r}")
    best_key = min(
        candidates.keys(),
        key=lambda key: (
            float(candidates[key].get("length_m", 1)),
            str(candidates[key].get("segment_id", key)),
        ),
    )
    return str(candidates[best_key]["segment_id"])


def _nodes_path_to_segments(graph: nx.MultiGraph, node_path: list[str]) -> list[str]:
    return [
        _shortest_segment_for_step(graph, node_path[i], node_path[i + 1])
        for i in range(len(node_path) - 1)
    ]


def _connect_components(
    full_graph: nx.MultiGraph,
    mandatory_ids: list[str],
    segment_by_id: dict[str, SegmentFeatures],
) -> tuple[list[str], list[str]]:
    """Join mandatory components via MST over shortest paths (heuristic)."""
    mandatory_set = set(mandatory_ids)
    mandatory_graph: nx.MultiGraph = nx.MultiGraph()
    for segment_id in mandatory_ids:
        segment = segment_by_id[segment_id]
        mandatory_graph.add_edge(
            segment.origin_node,
            segment.destination_node,
            key=segment_id,
            weight=float(segment.length_m),
            segment_id=segment_id,
            length_m=float(segment.length_m),
        )
    components = [
        set(component) for component in nx.connected_components(mandatory_graph)
    ]
    if len(components) <= 1:
        return list(mandatory_ids), []
    mandatory_nodes = set().union(*components)
    distances: dict[str, dict[str, float]] = {}
    paths: dict[str, dict[str, list[str]]] = {}
    for source in mandatory_nodes:
        dist = nx.single_source_dijkstra_path_length(
            full_graph, source, weight="weight"
        )
        path = nx.single_source_dijkstra_path(full_graph, source, weight="weight")
        distances[source] = dist
        paths[source] = path
    aux: nx.Graph = nx.Graph()
    for index in range(len(components)):
        aux.add_node(index)
    best_path_for_pair: dict[tuple[int, int], list[str]] = {}
    for i in range(len(components)):
        for j in range(i + 1, len(components)):
            best_dist = float("inf")
            best_path: list[str] | None = None
            for source in components[i]:
                dist = distances.get(source, {})
                path = paths.get(source, {})
                for target in components[j]:
                    candidate = dist.get(target)
                    if candidate is not None and candidate < best_dist:
                        best_dist = candidate
                        best_path = path[target]
            if best_path is not None:
                aux.add_edge(i, j, weight=best_dist)
                best_path_for_pair[(i, j)] = best_path
    try:
        tree = nx.minimum_spanning_tree(aux, weight="weight")
    except Exception as exc:
        raise ImpossibleRoute(f"componentes sin conexión: {exc}") from exc
    if tree.number_of_edges() < len(components) - 1:
        raise ImpossibleRoute(
            "componentes obligatorias sin conexión por el grafo completo"
        )
    transit: list[str] = []
    for i, j in tree.edges():
        key = (i, j) if (i, j) in best_path_for_pair else (j, i)
        node_path = best_path_for_pair.get(key)
        if node_path is None:
            raise ImpossibleRoute(
                "componentes obligatorias sin conexión por el grafo completo"
            )
        for segment_id in _nodes_path_to_segments(full_graph, node_path):
            if segment_id not in mandatory_set and segment_id not in transit:
                transit.append(segment_id)
    required = list(mandatory_ids) + transit
    return required, transit


def _pair_odd_vertices(
    required_graph: nx.MultiGraph, odd: list[str]
) -> list[list[str]]:
    """Shortest paths for each min-weight matched odd pair."""
    dist_all: dict[str, dict[str, float]] = {}
    path_all: dict[str, dict[str, list[str]]] = {}
    for source in odd:
        dist_all[source] = nx.single_source_dijkstra_path_length(
            required_graph, source, weight="weight"
        )
        path_all[source] = nx.single_source_dijkstra_path(
            required_graph, source, weight="weight"
        )
    complete: nx.Graph = nx.Graph()
    complete.add_nodes_from(odd)
    pair_path: dict[tuple[str, str], list[str]] = {}
    for index, first in enumerate(odd):
        for second in odd[index + 1 :]:
            distance = dist_all.get(first, {}).get(second)
            if distance is None:
                raise ImpossibleRoute(
                    f"red elegida desconexa entre {first!r} y {second!r}"
                )
            complete.add_edge(first, second, weight=distance)
            pair_path[(first, second)] = path_all[first][second]
    matching = nx.min_weight_matching(complete, weight="weight")
    matched: set[str] = set()
    for first, second in matching:
        matched.add(first)
        matched.add(second)
    if set(odd) != matched:
        raise ImpossibleRoute("emparejamiento de impares incompleto")
    result: list[list[str]] = []
    for first, second in matching:
        key = (first, second) if (first, second) in pair_path else (second, first)
        result.append(pair_path[key])
    return result


class NetworkxRoutePlanner:
    """NetworkX planner: rural heuristic + weighted Chinese postman."""

    def plan(
        self,
        nodes: list[dict],
        segments: list[SegmentFeatures],
        priorities: list[PredictedSegment],
        config: RouteConfig,
    ) -> Route:
        segment_by_id = {segment.segment_id: segment for segment in segments}
        length_by_id = {
            segment.segment_id: float(segment.length_m) for segment in segments
        }
        priority_by_id = {item.segment_id: item.priority for item in priorities}
        include = set(config.include)
        mandatory = _mandatory_ids(segments, priority_by_id, include)
        if not mandatory:
            raise ImpossibleRoute(
                "selección vacía: ningún tramo con contenedores en "
                f"prioridades incluidas {sorted(include)}"
            )
        full_graph = _build_full_multigraph(nodes, segments)
        required_ids, _ = _connect_components(full_graph, mandatory, segment_by_id)
        required_graph: nx.MultiGraph = nx.MultiGraph()
        for segment_id in required_ids:
            segment = segment_by_id[segment_id]
            required_graph.add_edge(
                segment.origin_node,
                segment.destination_node,
                key=segment_id,
                weight=float(segment.length_m),
                segment_id=segment_id,
                length_m=float(segment.length_m),
            )
        if not nx.is_connected(required_graph):
            raise ImpossibleRoute("red elegida desconexa")
        start = config.start_node_id
        if start is None:
            start = segment_by_id[mandatory[0]].origin_node
        elif start not in required_graph:
            raise ImpossibleRoute(
                f"nodo de inicio {start!r} inaccesible desde la ruta elegida"
            )
        odd = [node for node, degree in required_graph.degree() if degree % 2 == 1]
        euler_graph = required_graph.copy()
        if odd:
            for node_path in _pair_odd_vertices(required_graph, odd):
                for index in range(len(node_path) - 1):
                    first, second = node_path[index], node_path[index + 1]
                    segment_id = _shortest_segment_for_step(
                        required_graph, first, second
                    )
                    length = length_by_id[segment_id]
                    existing = [
                        key
                        for _, _, key in euler_graph.edges(keys=True)
                        if key == segment_id or str(key).startswith(f"{segment_id}#dup")
                    ]
                    dup_key = f"{segment_id}#dup{len(existing)}"
                    euler_graph.add_edge(
                        first,
                        second,
                        key=dup_key,
                        weight=length,
                        segment_id=segment_id,
                        length_m=length,
                    )
        if not nx.is_eulerian(euler_graph):
            raise ImpossibleRoute("red duplicada no euleriana")
        circuit = list(nx.eulerian_circuit(euler_graph, source=start, keys=True))
        order: list[str] = []
        for first, second, key in circuit:
            data = euler_graph.get_edge_data(first, second, key)
            order.append(str(data["segment_id"]))
        total = float(sum(length_by_id[segment_id] for segment_id in order))
        seen_count: dict[str, int] = {}
        repetitions: list[str] = []
        for segment_id in order:
            seen_count[segment_id] = seen_count.get(segment_id, 0) + 1
            if seen_count[segment_id] == 2:
                repetitions.append(segment_id)
        transit_unique = [sid for sid in required_ids if sid not in set(mandatory)]
        transit_in_order = [
            sid for sid in dict.fromkeys(order) if sid in set(transit_unique)
        ]
        distinct_length = sum(length_by_id[sid] for sid in set(order))
        repeated_distance = total - distinct_length
        coverage = (
            len(set(order) & set(mandatory)) / len(mandatory) if mandatory else 0.0
        )
        return Route(
            order=tuple(order),
            repetitions=tuple(repetitions),
            total_cost_m=total,
            unit="meters",
            mandatory=tuple(mandatory),
            transit=tuple(transit_in_order),
            repeated_distance_m=float(repeated_distance),
            coverage=float(coverage),
        )
