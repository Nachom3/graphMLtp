"""Use case compare_models (issue #10).

Thin delegation: the application layer never imports pandas/sklearn. All
scientific work happens behind the ``ModelEvaluator`` port (adapter). The
``rows`` carry the #18 split explicitly (``_partition`` in
train/validation/test) so no preparation logic is duplicated here.
"""
from __future__ import annotations

from ...models.evaluation_protocol import EvaluationProtocol
from ...models.model_comparison import ModelComparison
from ...ports.model_evaluator import ModelEvaluator
from .contract import CompareModelsContract


class CompareModels(CompareModelsContract):
    def __init__(self, evaluator: ModelEvaluator):
        self._evaluator = evaluator

    def execute(
        self,
        rows: list[dict],
        configs: list[str],
        protocol: EvaluationProtocol,
    ) -> ModelComparison:
        """Delegate the comparison to the injected evaluator."""
        return self._evaluator.evaluate(rows, configs, protocol)
