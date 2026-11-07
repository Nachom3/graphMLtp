"""Reproducible 60/20/20 splitting with a small deterministic fallback.

Role (Clean Architecture): adapter mechanics. The policy (ratios, sizes)
lives in ``split_sizes``; this module only executes it with sklearn when
possible and falls back deterministically otherwise.

Strategy, in order:
1. Standard two-stage ``train_test_split`` stratified (60% train, then
   remainder split equally). Preferred: exactly what the course teaches.
2. Deterministic coverage fallback: same sizes, guarantees one row per
   class per split when feasible (each class has >= 3 rows and each split
   fits every class). Proportional fill, seeded, row-order independent.
3. Unstratified shuffle with the same seed and sizes, flagged as such.

Only (1) and (2) report ``stratified=True``. (3) reports ``False`` with
an explicit limitation string built by the caller.
"""

from __future__ import annotations

import random

from sklearn.model_selection import train_test_split
from sklearn.utils import check_random_state

from .split_sizes import SPLIT_NAMES, TEST_FRACTION_OF_ALL, compute_split_sizes


def split_indices(
    labels: list[str], seed: int
) -> tuple[dict[str, tuple[int, ...]], bool]:
    """Split row positions into train/validation/test.

    Raises ValueError for a negative seed (via sklearn validation) so the
    public ``prepare_dataset`` contract stays unchanged.
    """
    check_random_state(seed)
    n = len(labels)
    all_indices = list(range(n))
    try:
        train_idx, remainder_idx = train_test_split(
            all_indices,
            test_size=TEST_FRACTION_OF_ALL,
            random_state=seed,
            stratify=labels,
        )
        remainder_labels = [labels[i] for i in remainder_idx]
        validation_idx, test_idx = train_test_split(
            remainder_idx,
            test_size=0.5,
            random_state=seed,
            stratify=remainder_labels,
        )
        return (
            {
                "train": tuple(int(i) for i in train_idx),
                "validation": tuple(int(i) for i in validation_idx),
                "test": tuple(int(i) for i in test_idx),
            },
            True,
        )
    except ValueError:
        pass
    coverage = coverage_split(labels, seed)
    if coverage is not None:
        return coverage, True
    train_idx, remainder_idx = train_test_split(
        all_indices, test_size=TEST_FRACTION_OF_ALL, random_state=seed, shuffle=True
    )
    validation_idx, test_idx = train_test_split(
        remainder_idx, test_size=0.5, random_state=seed, shuffle=True
    )
    return (
        {
            "train": tuple(int(i) for i in train_idx),
            "validation": tuple(int(i) for i in validation_idx),
            "test": tuple(int(i) for i in test_idx),
        },
        False,
    )


def coverage_split(labels: list[str], seed: int) -> dict[str, tuple[int, ...]] | None:
    """Deterministic fallback preserving sizes and class coverage.

    Returns None when coverage is infeasible: a split is smaller than the
    number of classes, or some class has fewer than 3 rows.
    """
    n = len(labels)
    sizes = compute_split_sizes(n)
    unique = list(dict.fromkeys(labels))
    if min(sizes) < len(unique):
        return None
    counts = {label: labels.count(label) for label in unique}
    if any(count < len(SPLIT_NAMES) for count in counts.values()):
        return None

    rng = random.Random(seed)
    groups: dict[str, list[int]] = {}
    for label in unique:
        indices = [i for i, value in enumerate(labels) if value == label]
        rng.shuffle(indices)
        groups[label] = indices

    alloc: dict[str, list[int]] = {name: [] for name in SPLIT_NAMES}
    used: dict[str, list[int]] = {label: [0, 0, 0] for label in unique}
    _reserve_one_per_split(groups, unique, alloc, used)
    _fill_proportionally(groups, unique, counts, sizes, n, alloc, used)

    if any(len(alloc[name]) != size for name, size in zip(SPLIT_NAMES, sizes, strict=True)):
        return None
    return {name: tuple(alloc[name]) for name in SPLIT_NAMES}


def _reserve_one_per_split(
    groups: dict[str, list[int]],
    unique: list[str],
    alloc: dict[str, list[int]],
    used: dict[str, list[int]],
) -> None:
    """Guarantee coverage: one shuffled row per class per split."""
    for label in unique:
        for split_pos, name in enumerate(SPLIT_NAMES):
            alloc[name].append(int(groups[label].pop()))
            used[label][split_pos] += 1


def _fill_proportionally(
    groups: dict[str, list[int]],
    unique: list[str],
    counts: dict[str, int],
    sizes: tuple[int, int, int],
    n: int,
    alloc: dict[str, list[int]],
    used: dict[str, list[int]],
) -> None:
    """Fill remaining rows toward each label's proportional target."""
    for label in unique:
        for index in groups[label]:
            eligible = [
                pos
                for pos, name in enumerate(SPLIT_NAMES)
                if len(alloc[name]) < sizes[pos]
            ]
            best = max(
                eligible,
                key=lambda pos: (
                    counts[label] * sizes[pos] / n - used[label][pos],
                    sizes[pos] - len(alloc[SPLIT_NAMES[pos]]),
                    -pos,
                ),
            )
            alloc[SPLIT_NAMES[best]].append(int(index))
            used[label][best] += 1
