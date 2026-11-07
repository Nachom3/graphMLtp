"""Evaluation protocol (template)."""
from __future__ import annotations
from dataclasses import dataclass

@dataclass(frozen=True)
class EvaluationProtocol:
    test_size: float = 0.25
    seed: int = 0
    cv_folds: int = 5
    stratified: bool = True
