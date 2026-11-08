"""GeoJSON geometry reader (adapter; thin wrapper, no business logic)."""
from __future__ import annotations

from typing import Any

from .segment_geometry import load_segment_geometries


class GeoJsonGeometryReader:
    """Implement the GeometryReader port via the builder's GeoJSON sidecar."""

    def load(self, source: str, *, required: bool) -> dict[str, dict[str, Any]]:
        """Delegate to the persisted GeoJSON loader."""
        return load_segment_geometries(source, required=required)
