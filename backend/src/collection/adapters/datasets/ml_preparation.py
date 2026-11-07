"""Read-only dataset validation, synthetic labels, and reproducible partitions."""
from __future__ import annotations

import random
from dataclasses import dataclass
from math import isfinite
from pathlib import Path
from typing import Any, cast

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.utils import check_random_state

from .synthetic_complaints import (
    COMPLAINT_MAX,
    COMPLAINT_MIN,
    COMPLAINT_WEIGHT,
    SCORE_LOW_MAX,
    SCORE_MEDIUM_MAX,
    ZONE_WEIGHTS,
    complaint_count_for_segment,
    label_priority,
)

FEATURE_COLUMNS = (
    "cantidad_contenedores",
    "dias_desde_ultima_recoleccion",
    "tipo_zona",
    "historico_quejas_vecinales",
)
NUMERIC_COLUMNS = (
    "cantidad_contenedores",
    "dias_desde_ultima_recoleccion",
    "historico_quejas_vecinales",
)
REQUIRED_COLUMNS = (
    "tramo_id",
    "tipo_zona",
    "cantidad_contenedores",
    "dias_desde_ultima_recoleccion",
    "prioridad_recoleccion",
)
ZONES = frozenset(ZONE_WEIGHTS)
CLASSES = ("baja", "media", "alta")


@dataclass(frozen=True)
class DataPartition:
    """One split, represented by positional row indices and audit metadata."""

    indices: tuple[int, ...]
    metadata: dict[str, Any]


@dataclass(frozen=True)
class MLPreparation:
    """Aligned ML inputs, audit identifiers, split metadata, and unfitted prep."""

    enriched: pd.DataFrame
    X: pd.DataFrame
    y: pd.Series
    tramo_ids: pd.Series
    partitions: dict[str, DataPartition]
    metadata: dict[str, Any]
    preprocessor: ColumnTransformer


def _load_frame(source: str | Path | pd.DataFrame) -> pd.DataFrame:
    if isinstance(source, pd.DataFrame):
        return source.copy(deep=True)
    try:
        return pd.read_csv(source)
    except (OSError, pd.errors.ParserError, UnicodeError) as exc:
        raise ValueError(f"unable to read dataset: {exc}") from exc


def _validate(frame: pd.DataFrame) -> None:
    if frame.empty:
        raise ValueError("dataset must contain at least one row")
    missing_columns = sorted(set(REQUIRED_COLUMNS) - set(frame.columns))
    if missing_columns:
        raise ValueError(f"missing required columns: {', '.join(missing_columns)}")
    columns_used = list(REQUIRED_COLUMNS)
    missing = [
        column
        for column in columns_used
        if frame[column].isna().to_numpy().any()
    ]
    if missing:
        raise ValueError(f"missing values in columns: {', '.join(missing)}")
    ids = frame["tramo_id"].astype(str)
    if ids.str.strip().eq("").any() or ids.duplicated().any():
        raise ValueError("tramo_id values must be non-empty and unique")
    bad_zones = sorted(set(frame["tipo_zona"].astype(str)) - ZONES)
    if bad_zones:
        raise ValueError(f"invalid tipo_zona categories: {bad_zones}")
    for column in ("cantidad_contenedores", "dias_desde_ultima_recoleccion"):
        raw_values = cast(pd.Series, frame[column]).tolist()
        try:
            numbers = [float(value) for value in raw_values]
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{column} must contain non-negative integers") from exc
        if any(
            not isfinite(value) or value < 0 or not value.is_integer()
            for value in numbers
        ):
            raise ValueError(f"{column} must contain non-negative integers")
    invalid_labels = sorted(set(frame["prioridad_recoleccion"].astype(str)) - set(CLASSES))
    if invalid_labels:
        raise ValueError(f"invalid prioridad_recoleccion values: {invalid_labels}")


def _coverage_split(y: pd.Series, seed: int) -> dict[str, tuple[int, ...]] | None:
    names = ("train", "validation", "test")
    n = len(y)
    train_size = int(n * 0.6)
    validation_size = int((n - train_size) * 0.5)
    sizes = (train_size, validation_size, n - train_size - validation_size)
    labels = list(dict.fromkeys(y.tolist()))
    if min(sizes) < len(labels) or any(
        int(y.eq(label).sum()) < len(names) for label in labels
    ):
        return None

    rng = random.Random(seed)
    allocations = {name: [] for name in names}
    used = {label: [0, 0, 0] for label in labels}
    # Reserve one row per class per partition, then allocate remaining rows to
    # the most underfilled class/split quota without changing the split sizes.
    groups = {}
    label_values = y.tolist()
    for label in labels:
        indices = [index for index, value in enumerate(label_values) if value == label]
        rng.shuffle(indices)
        groups[label] = indices
        for split in range(len(names)):
            index = indices.pop()
            allocations[names[split]].append(int(index))
            used[label][split] += 1

    class_counts = {label: int(y.eq(label).sum()) for label in labels}
    for label in labels:
        for index in groups[label]:
            candidates = [
                i for i, name in enumerate(names) if len(allocations[name]) < sizes[i]
            ]
            split = max(
                candidates,
                key=lambda i: (
                    class_counts[label] * sizes[i] / n - used[label][i],
                    sizes[i] - len(allocations[names[i]]),
                    -i,
                ),
            )
            allocations[names[split]].append(int(index))
            used[label][split] += 1
    if any(len(allocations[name]) != sizes[i] for i, name in enumerate(names)):
        return None
    return {name: tuple(indices) for name, indices in allocations.items()}


def _split_indices(y: pd.Series, seed: int) -> tuple[dict[str, tuple[int, ...]], bool]:
    check_random_state(seed)
    all_indices = list(range(len(y)))
    try:
        train_idx, remainder_idx = train_test_split(
            all_indices,
            test_size=0.4,
            random_state=seed,
            stratify=y.tolist(),
        )
        validation_idx, test_idx = train_test_split(
            remainder_idx,
            test_size=0.5,
            random_state=seed,
            stratify=y.iloc[remainder_idx].tolist(),
        )
        stratified = True
    except ValueError:
        coverage_split = _coverage_split(y.reset_index(drop=True), seed)
        if coverage_split is not None:
            return coverage_split, True
        train_idx, remainder_idx = train_test_split(
            all_indices, test_size=0.4, random_state=seed, shuffle=True
        )
        validation_idx, test_idx = train_test_split(
            remainder_idx, test_size=0.5, random_state=seed, shuffle=True
        )
        stratified = False
    return {
        "train": tuple(int(i) for i in train_idx),
        "validation": tuple(int(i) for i in validation_idx),
        "test": tuple(int(i) for i in test_idx),
    }, stratified


def _class_distribution(y: pd.Series) -> dict[str, int]:
    return {label: int(y.eq(label).sum()) for label in CLASSES if y.eq(label).any()}


def prepare_dataset(
    source: str | Path | pd.DataFrame, *, seed: int = 0
) -> MLPreparation:
    """Validate and prepare a source dataset without writing back to it.

    Complaint draws are anonymous per represented container (0..3 inclusive),
    seeded by preparation seed and tramo_id, then summed per segment. Labels use
    score=2*dias+contenedores+zona_w+2*quejas; baja <=0, media <=2, alta >2.
    """
    frame = _load_frame(source)
    _validate(frame)
    frame = frame.reset_index(drop=True)
    for column in ("cantidad_contenedores", "dias_desde_ultima_recoleccion"):
        frame[column] = pd.to_numeric(frame[column])
    enriched = frame.copy(deep=True)
    enriched["prioridad_recoleccion_original"] = enriched["prioridad_recoleccion"]
    complaints = []
    for row in enriched.to_dict(orient="records"):
        count = int(row["cantidad_contenedores"])
        segment_id = str(row["tramo_id"])
        complaints.append(
            complaint_count_for_segment(count, seed=seed, segment_id=segment_id)
        )
    enriched["historico_quejas_vecinales"] = complaints
    enriched["prioridad_recoleccion"] = [
        label_priority(
            days=int(row["dias_desde_ultima_recoleccion"]),
            containers=int(row["cantidad_contenedores"]),
            zone=str(row["tipo_zona"]),
            complaints=int(complaint),
        )
        for row, complaint in zip(
            enriched.to_dict(orient="records"), complaints, strict=True
        )
    ]
    X = cast(pd.DataFrame, enriched.loc[:, list(FEATURE_COLUMNS)].copy())
    y = cast(pd.Series, enriched["prioridad_recoleccion"].copy())
    tramo_ids = cast(pd.Series, enriched["tramo_id"].copy())
    split_indices, stratified = _split_indices(y, seed)
    partitions = {}
    for name, indices in split_indices.items():
        split_y = y.iloc[list(indices)]
        partitions[name] = DataPartition(
            indices=indices,
            metadata={
                "size": len(indices),
                "tramo_ids": tramo_ids.iloc[list(indices)].tolist(),
                "class_distribution": _class_distribution(split_y),
            },
        )
    preprocessor = ColumnTransformer(
        transformers=[
            ("zona", OneHotEncoder(handle_unknown="ignore"), ["tipo_zona"]),
            ("numericas", "passthrough", list(NUMERIC_COLUMNS)),
        ],
        remainder="drop",
    )
    metadata = {
        "seed": seed,
        "stratified": stratified,
        "stratification_limitation": (
            None
            if stratified
            else "class coverage in all three splits is infeasible; using an unstratified split"
        ),
        "sizes": {name: part.metadata["size"] for name, part in partitions.items()},
        "class_distribution": _class_distribution(y),
        "label_status": "synthetic",
        "old_label_status": "synthetic, issue #9 rule without complaints",
        "complaints": {
            "seed": seed,
            "range_per_container_inclusive": [COMPLAINT_MIN, COMPLAINT_MAX],
            "aggregate": "sum of anonymous per-container draws; zero if no containers",
        },
        "label_rule": {
            "score": "2*dias + 1*contenedores + 1*zona_w + 2*quejas",
            "zone_weights": dict(ZONE_WEIGHTS),
            "complaint_weight": COMPLAINT_WEIGHT,
            "thresholds": {
                "baja_max": SCORE_LOW_MAX,
                "media_max": SCORE_MEDIUM_MAX,
                "alta_min_exclusive": SCORE_MEDIUM_MAX,
            },
        },
        "split_rounding": "train_test_split: 60% train, remainder split equally; sizes rounded by sklearn. If standard stratification fails but every class can fit in all three splits, deterministic class-aware allocation preserves those sizes and class coverage; otherwise an unstratified split is used and stratification_limitation explains the infeasibility.",
        "split_ids": {name: part.metadata["tramo_ids"] for name, part in partitions.items()},
    }
    return MLPreparation(enriched, X, y, tramo_ids, partitions, metadata, preprocessor)
