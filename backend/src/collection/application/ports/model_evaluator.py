"""Model evaluator port (issue #10).

``rows`` are enriched records (``cantidad_contenedores``,
``dias_desde_ultima_recoleccion``, ``tipo_zona``,
``historico_quejas_vecinales``, ``prioridad_recoleccion``, ``tramo_id``)
plus ``_partition`` in {"train", "validation", "test"} carrying the #18
60/20/20 split. ``configs`` lists model ids ("arbol", "logistica").
``evaluate`` runs CV + GridSearchCV inside train and contrasts on
reserved validation; it never reads the test partition.
"""
from __future__ import annotations

from typing import Protocol

from ..models.evaluation_protocol import EvaluationProtocol
from ..models.model_comparison import ModelComparison


class ModelEvaluator(Protocol):
    def evaluate(
        self,
        rows: list[dict],
        configs: list[str],
        protocol: EvaluationProtocol,
    ) -> ModelComparison:
        ...
