"""Model comparison (template)."""
from __future__ import annotations
from dataclasses import dataclass
from .model_metrics import ModelMetrics

@dataclass(frozen=True)
class ModelComparison:
    metrics: tuple[ModelMetrics, ...]
    baseline_accuracy: float
    best_by_cv: str
    record: dict
