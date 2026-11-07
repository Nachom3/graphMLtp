"""Use case contract validate_load_dataset (template)."""
from __future__ import annotations
from abc import ABC, abstractmethod
from ....domain.entities.segment_features import SegmentFeatures

class ValidateLoadDatasetContract(ABC):
    """Abstract use case contract."""

    @abstractmethod
    def execute(self, source: str, schema_version: str) -> tuple[list[dict], list[SegmentFeatures]]:
        """Abstract method. TODO: implement in use case."""
        raise NotImplementedError
