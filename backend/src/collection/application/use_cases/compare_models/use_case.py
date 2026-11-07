"""Use case compare_models implementation stub (template)."""
from __future__ import annotations
from ...models.evaluation_protocol import EvaluationProtocol
from ...models.model_comparison import ModelComparison
from ...ports.model_evaluator import ModelEvaluator
from .contract import CompareModelsContract


class CompareModels(CompareModelsContract):
    def __init__(self, evaluator: ModelEvaluator):
        self._evaluator = evaluator

    def execute(self, rows: list[dict], configs: list[str], protocol: EvaluationProtocol) -> ModelComparison:
        """Template. TODO: implement."""
        raise NotImplementedError
