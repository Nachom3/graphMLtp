"""Model metrics for issue #10 (pure; no pandas/sklearn here).

Each entry covers ONE classifier evaluated with the SAME methodology:
stratified CV strictly inside the 60% train split from #18, then contrast
on the reserved 20% validation. The final 20% test is evaluated at most
once and only for the chosen model (``test_*`` is ``None`` otherwise).

Legacy aliases (``accuracy``, ``precision_macro``, ``recall_macro``,
``f1_macro``, ``confusion_matrix``, ``n_test``) mirror the validation
scores so old consumers keep working; new code must read the explicit
``validation_*`` / ``test_*`` fields.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ModelMetrics:
    model_id: str
    # Cross-validation inside train.
    cv_accuracy_mean: float
    cv_accuracy_std: float
    cv_f1_macro_mean: float
    cv_f1_macro_std: float
    cv_folds_requested: int
    cv_folds_used: int
    best_params: dict[str, Any] = field(default_factory=dict)
    # Reserved-validation contrast (same methodology for every model).
    validation_accuracy: float = 0.0
    validation_precision_macro: float = 0.0
    validation_recall_macro: float = 0.0
    validation_f1_macro: float = 0.0
    validation_confusion_matrix: tuple[tuple[int, ...], ...] = ()
    n_train: int = 0
    n_validation: int = 0
    # Final test: set only for the chosen model, evaluated a single time.
    test_accuracy: float | None = None
    test_precision_macro: float | None = None
    test_recall_macro: float | None = None
    test_f1_macro: float | None = None
    test_confusion_matrix: tuple[tuple[int, ...], ...] | None = None
    n_test: int = 0
    # Legacy aliases mirroring the validation scores.
    accuracy: float = 0.0
    precision_macro: float = 0.0
    recall_macro: float = 0.0
    f1_macro: float = 0.0
    confusion_matrix: tuple[tuple[int, ...], ...] = ()

    def with_legacy_aliases(self) -> ModelMetrics:
        """Return a copy with legacy fields mirroring validation scores."""
        import dataclasses

        return dataclasses.replace(
            self,
            accuracy=self.validation_accuracy,
            precision_macro=self.validation_precision_macro,
            recall_macro=self.validation_recall_macro,
            f1_macro=self.validation_f1_macro,
            confusion_matrix=self.validation_confusion_matrix,
        )
