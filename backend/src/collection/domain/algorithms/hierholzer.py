"""Build an Euler circuit from keyed undirected edge incidences."""

from collections import deque
from collections.abc import Mapping, Sequence


def hierholzer(
    adjacency: Mapping[str, Sequence[tuple[str, str]]], start: str
) -> list[tuple[str, str, str]]:
    """Return a circuit from ``start`` without modifying the adjacency mapping.

    Each edge must appear once in each endpoint's incidence list; self-loops
    must appear twice. Keys must be unique per unordered endpoint pair, but
    equal keys on different pairs remain distinct edges.
    """
    if start not in adjacency:
        raise ValueError(f"start node {start!r} is absent")

    vertices = set(adjacency)
    vertices.update(neighbor for incidences in adjacency.values() for neighbor, _ in incidences)
    if any(len(adjacency.get(node, ())) % 2 for node in vertices):
        raise ValueError("Euler circuit requires even degree at every vertex")

    # Connectivity includes isolated vertices represented by adjacency keys.
    reached = {start}
    pending = [start]
    while pending:
        node = pending.pop()
        for neighbor, _ in adjacency.get(node, ()):
            if neighbor not in reached:
                reached.add(neighbor)
                pending.append(neighbor)
    if reached != vertices:
        raise ValueError("Euler circuit input must be connected")

    remaining = {node: deque(incidences) for node, incidences in adjacency.items()}
    used: set[tuple[frozenset[str], str]] = set()
    stack: list[tuple[str, tuple[str, str, str] | None]] = [(start, None)]
    circuit: list[tuple[str, str, str]] = []

    while stack:
        node, arrival = stack[-1]
        incidences = remaining.get(node)
        while incidences:
            neighbor, key = incidences.popleft()
            edge = (frozenset((node, neighbor)), key)
            if edge not in used:
                used.add(edge)
                stack.append((neighbor, (node, neighbor, key)))
                break
        else:
            stack.pop()
            if arrival is not None:
                previous, current, key = arrival
                circuit.append((current, previous, key))

    return circuit
