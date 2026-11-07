"""Route entity (template)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Route:
    order: tuple[str, ...]
    repetitions: tuple[str, ...]
    total_cost_m: float
    unit: str = "meters"
