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
- Scope: this is an exact matching over odd vertices on the selected
  network, not a city-scale vehicle-routing solver. Its complete odd
  graph grows quadratically and matching can take cubic time; select a
  bounded service area before invoking it on a city-wide dataset.
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
    aux: nx.Graph = nx.Graph()
    for index in range(len(components)):
        aux.add_node(index)
    best_path_for_pair: dict[tuple[int, int], list[str]] = {}
    for i in range(len(components) - 1):
        # The nearest path between components is a multi-source shortest
        # path: one search per component rather than one per mandatory node.
        # Sorting makes tie handling reproducible for a fixed NetworkX version.
        distances, paths = nx.multi_source_dijkstra(
            full_graph, sorted(components[i]), weight="weight"
        )
        for j in range(i + 1, len(components)):
            reachable = [node for node in components[j] if node in distances]
            if reachable:
                target = min(reachable, key=lambda node: (distances[node], node))
                aux.add_edge(i, j, weight=distances[target])
                best_path_for_pair[(i, j)] = paths[target]
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
    complete: nx.Graph = nx.Graph()
    complete.add_nodes_from(odd)
    pair_path: dict[tuple[str, str], list[str]] = {}
    for index, first in enumerate(odd):
        # Compute distance and path together; retain only paths to odd nodes.
        distances, paths = nx.single_source_dijkstra(
            required_graph, first, weight="weight"
        )
        for second in odd[index + 1 :]:
            distance = distances.get(second)
            if distance is None:
                raise ImpossibleRoute(
                    f"red elegida desconexa entre {first!r} y {second!r}"
                )
            complete.add_edge(first, second, weight=distance)
            pair_path[(first, second)] = paths[second]
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
            if start not in full_graph:
                raise ImpossibleRoute(f"nodo de inicio {start!r} inexistente")
            try:
                # Connect the chosen start to the closest node in the selected
                # network. The connecting streets remain transit and will be
                # duplicated by the postman stage when needed for closure.
                _, node_path = nx.multi_source_dijkstra(
                    full_graph, sorted(required_graph.nodes), target=start, weight="weight"
                )
            except nx.NetworkXNoPath:
                raise ImpossibleRoute(
                    f"nodo de inicio {start!r} inaccesible desde la ruta elegida"
                ) from None
            for segment_id in _nodes_path_to_segments(full_graph, node_path):
                if segment_id in required_ids:
                    continue
                segment = segment_by_id[segment_id]
                required_ids.append(segment_id)
                required_graph.add_edge(
                    segment.origin_node,
                    segment.destination_node,
                    key=segment_id,
                    weight=float(segment.length_m),
                    segment_id=segment_id,
                    length_m=float(segment.length_m),
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
