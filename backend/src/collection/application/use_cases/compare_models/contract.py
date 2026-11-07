"""Use case contract compare_models (template)."""
from __future__ import annotations
from abc import ABC, abstractmethod
from ...models.evaluation_protocol import EvaluationProtocol
from ...models.model_comparison import ModelComparison

class CompareModelsContract(ABC):
    """Abstract use case contract."""

    @abstractmethod
    def execute(self, rows: list[dict], configs: list[str], protocol: EvaluationProtocol) -> ModelComparison:
        """Abstract method. TODO: implement in use case."""
        raise NotImplementedError
