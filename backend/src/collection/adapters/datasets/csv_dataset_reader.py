"""CSV dataset reader (template)."""
from __future__ import annotations
from ...domain.entities.segment_features import SegmentFeatures

class CsvDatasetReader:
    """Template. TODO: implement."""
    def load(self, source: str, schema_version: str) -> tuple[list[dict], list[SegmentFeatures]]:
        """Template. TODO: implement."""
        raise NotImplementedError
