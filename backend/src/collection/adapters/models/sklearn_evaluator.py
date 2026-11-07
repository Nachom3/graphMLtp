"""Sklearn evaluator (template)."""
from __future__ import annotations
from ...application.models.evaluation_protocol import EvaluationProtocol
from ...application.models.model_comparison import ModelComparison

class SklearnEvaluator:
    """Template. TODO: implement."""
    def evaluate(self, rows: list[dict], configs: list[str], protocol: EvaluationProtocol) -> ModelComparison:
        """Template. TODO: implement."""
        raise NotImplementedError
