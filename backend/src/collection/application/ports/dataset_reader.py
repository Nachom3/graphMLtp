"""Dataset reader port (template)."""
from __future__ import annotations
from typing import Protocol
from ...domain.entities.segment_features import SegmentFeatures

class DatasetReader(Protocol):
    def load(self, source: str, schema_version: str) -> tuple[list[dict], list[SegmentFeatures]]:
        """Template. TODO: implement."""
        ...
