"""Geometry reader port (P1: transport depends on this, never on adapters)."""
from __future__ import annotations

from typing import Any, Protocol


class GeometryReader(Protocol):
    """Read persisted WGS84 road geometry keyed by segment id."""

    def load(self, source: str, *, required: bool) -> dict[str, dict[str, Any]]:
        """Template. TODO: implement."""
        ...
