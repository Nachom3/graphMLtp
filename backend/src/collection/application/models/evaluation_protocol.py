"""Evaluation protocol for issue #10 (pure; no pandas/sklearn here).

The 60/20/20 partitions come from issue #18
(``prepare_dataset(source, seed=0)``); this protocol does NOT re-split.
``test_size`` and ``cv_folds`` are legacy aliases kept so old imports and
positional constructors keep working. The canonical requested folds field
is ``cv_folds_requested``; when both are set explicitly they must agree.

Course reference: sesion 5 ``notebook-2-validacion-cruzada`` (cells 13-18:
separate test, choose hyperparams with CV inside train, GridSearchCV,
evaluate once on test) and ``notebook-1-metricas`` (accuracy can lie;
report precision/recall/F1 + confusion + dummy baseline).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EvaluationProtocol:
    seed: int = 0
    cv_folds_requested: int = 5
    stratified: bool = True
    # Legacy aliases (issue #12 contract). ``test_size`` does NOT drive the
    # #18 60/20/20 split; it is kept for backward compatibility only.
    test_size: float = 0.25
    cv_folds: int = 5

    def requested_folds(self) -> int:
        """Return the folds requested for the stratified CV inside train."""
        if self.cv_folds_requested != 5 and self.cv_folds != 5:
            if self.cv_folds_requested != self.cv_folds:
                raise ValueError(
                    "cv_folds_requested and legacy cv_folds disagree; "
                    "set only one of them"
                )
            return self.cv_folds_requested
        if self.cv_folds_requested != 5:
            return self.cv_folds_requested
        return self.cv_folds
