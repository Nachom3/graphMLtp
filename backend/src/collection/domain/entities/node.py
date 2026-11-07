"""Node entity (template)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Node:
    node_id: str
    lon: float
    lat: float
