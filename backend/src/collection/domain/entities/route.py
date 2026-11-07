"""Route entity (issue #28).

``order`` lists segment ids in visit order including repetitions (closed
circuit: first and last edges meet at the start node). ``repetitions``
lists the ids visited more than once (unique, in order of second
occurrence). ``mandatory`` are the required ids (container_count > 0 and
priority in config) in input order; ``transit`` are non-mandatory ids
used only for connectivity, in order of first appearance in ``order``.
``total_cost_m`` sums every traversal; ``repeated_distance_m`` is the
repeated part (total minus distinct visited length); ``coverage`` is
``|order ∩ mandatory| / |mandatory|`` (1.0 on success).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Route:
    order: tuple[str, ...]
    repetitions: tuple[str, ...]
    total_cost_m: float
    unit: str = "meters"
    mandatory: tuple[str, ...] = ()
    transit: tuple[str, ...] = ()
    repeated_distance_m: float = 0.0
    coverage: float = 1.0
