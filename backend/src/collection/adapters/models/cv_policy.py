"""CV fold policy (adapter detail; no business logic).

Resolves how many cross-validation folds are viable inside train:
stratified folds are capped by the least-frequent class count,
plain folds by the train size. Below 2 folds is infeasible.
"""
from __future__ import annotations

from collections import Counter
from typing import Any


def resolve_cv_folds(y_train: Any, requested: int) -> tuple[int, int]:
    """Return (pedidos, usados) for the stratified CV inside train.

    ``usados`` is ``min(requested, least-frequent-class count)``. Raises
    ``ValueError`` when fewer than 2 stratified folds are viable.
    """
    counts = Counter(list(y_train))
    if not counts:
        raise ValueError("train split is empty; stratified CV is infeasible")
    least = min(counts.values())
    used = min(int(requested), int(least))
    if used < 2:
        raise ValueError(
            "stratified CV infeasible: the least-frequent train class has "
            f"{least} example(s); at least 2 stratified folds are required "
            f"(requested {requested})"
        )
    return int(requested), int(used)


def resolve_plain_folds(n_train: int, requested: int) -> tuple[int, int]:
    """Return (pedidos, usados) for non-stratified KFold inside train."""
    if n_train <= 0:
        raise ValueError("train split is empty; CV is infeasible")
    used = min(int(requested), int(n_train))
    if used < 2:
        raise ValueError(
            "CV infeasible: train has "
            f"{n_train} example(s); at least 2 folds are required "
            f"(requested {requested})"
        )
    return int(requested), int(used)
