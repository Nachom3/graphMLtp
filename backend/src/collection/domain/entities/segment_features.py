"""Segment features entity (template)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ZoneType = Literal["residential", "commercial", "industrial"]


@dataclass(frozen=True)
class SegmentFeatures:
    segment_id: str
    origin_node: str
    destination_node: str
    length_m: float
    zone_type: ZoneType
    container_count: int
    days_since_last_collection: int
    historic_neighbor_complaints: int
