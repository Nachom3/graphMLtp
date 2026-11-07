"""Model comparison for issue #10 (pure; no pandas/sklearn here).

``best_by_validation`` is the choice justified on the reserved 20%
validation. ``best_by_cv`` is kept as a legacy alias so old consumers
keep working. ``chosen_model_id`` is the single model evaluated once on
the reserved 20% test. ``record`` is the audit trail: seed, partitions,
sizes, class distributions, folds, configs, grids, validation scores,
final test scores, label-rule reference and synthetic-data limitations.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .model_metrics import ModelMetrics


@dataclass(frozen=True)
class ModelComparison:
    metrics: tuple[ModelMetrics, ...]
    baseline_accuracy: float
    baseline_f1_macro: float = 0.0
    best_by_cv: str = ""
    best_by_validation: str = ""
    chosen_model_id: str = ""
    record: dict[str, Any] = field(default_factory=dict)
