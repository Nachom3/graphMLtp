"""Route config entity (template)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RouteConfig:
    include: tuple[str, ...] = ("medium", "high")
    schema_version: str = "v1"
    start_node_id: str | None = None
