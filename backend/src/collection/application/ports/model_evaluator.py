"""Model evaluator port (template)."""
from __future__ import annotations
from typing import Protocol
from ..models.evaluation_protocol import EvaluationProtocol
from ..models.model_comparison import ModelComparison

class ModelEvaluator(Protocol):
    def evaluate(self, rows: list[dict], configs: list[str], protocol: EvaluationProtocol) -> ModelComparison:
        """Template. TODO: implement."""
        ...
