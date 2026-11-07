"""Use case validate_load_dataset implementation stub (template)."""
from __future__ import annotations
from ....domain.entities.segment_features import SegmentFeatures
from ...ports.dataset_reader import DatasetReader
from .contract import ValidateLoadDatasetContract


class ValidateLoadDataset(ValidateLoadDatasetContract):
    def __init__(self, reader: DatasetReader):
        self._reader = reader

    def execute(self, source: str, schema_version: str) -> tuple[list[dict], list[SegmentFeatures]]:
        """Template. TODO: implement."""
        raise NotImplementedError
