"""Use case validate_load_dataset (issue #27).

Thin delegation: validation and translation live in the injected
``DatasetReader`` (default ``CsvDatasetReader``); this layer carries no
pandas/sklearn and never writes the CSVs.
"""
from __future__ import annotations

from ....domain.entities.segment_features import SegmentFeatures
from ...ports.dataset_reader import DatasetReader
from .contract import ValidateLoadDatasetContract


class ValidateLoadDataset(ValidateLoadDatasetContract):
    def __init__(self, reader: DatasetReader):
        self._reader = reader

    def execute(self, source: str, schema_version: str) -> tuple[list[dict], list[SegmentFeatures]]:
        """Delegate loading/validation to the injected reader."""
        return self._reader.load(source, schema_version)
