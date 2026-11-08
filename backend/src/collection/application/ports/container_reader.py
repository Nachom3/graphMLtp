"""Container reader port (P1: transport depends on this, never on adapters)."""
from __future__ import annotations

from typing import Protocol


class ContainerReader(Protocol):
    """Read levante container points filtered by bbox."""

    def query(
        self,
        *,
        sur: float,
        norte: float,
        oeste: float,
        este: float,
        limit: int,
    ) -> tuple[list[dict], int]:
        """Return (points_in_bbox[:limit], total_in_bbox)."""
        ...
