"""Model metrics (template)."""
from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class ModelMetrics:
    model_id: str
    accuracy: float
    precision_macro: float
    recall_macro: float
    f1_macro: float
    confusion_matrix: tuple[tuple[int, ...], ...]
    n_train: int
    n_test: int
