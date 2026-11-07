"""Predicted segment entity (template)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Priority = Literal["low", "medium", "high"]


@dataclass(frozen=True)
class PredictedSegment:
    segment_id: str
    priority: Priority
