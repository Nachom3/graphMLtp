"""Validation metrics (adapter detail; sklearn lives here, never in app).

Scores a fitted prediction against ground truth: accuracy, macro
precision/recall/F1 and the confusion matrix over the course labels.
"""
from __future__ import annotations

from typing import Any

from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

CLASS_LABELS = ("baja", "media", "alta")


def validation_scores(y_true: Any, y_pred: Any) -> dict[str, Any]:
    """Score predictions; label order follows the course labels."""
    labels = [label for label in CLASS_LABELS if label in set(y_true.tolist()) | set(y_pred)]
    ordered = [label for label in CLASS_LABELS if label in labels] or list(CLASS_LABELS)
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_macro": float(
            precision_score(y_true, y_pred, average="macro", zero_division=0)  # type: ignore[arg-type]
        ),
        "recall_macro": float(
            recall_score(y_true, y_pred, average="macro", zero_division=0)  # type: ignore[arg-type]
        ),
        "f1_macro": float(  # type: ignore[arg-type]
            f1_score(y_true, y_pred, average="macro", zero_division=0)  # type: ignore[arg-type]
        ),
        "confusion_matrix": tuple(
            tuple(int(value) for value in row)
            for row in confusion_matrix(y_true, y_pred, labels=list(CLASS_LABELS)).tolist()
        ),
        "label_order": tuple(ordered),
    }
