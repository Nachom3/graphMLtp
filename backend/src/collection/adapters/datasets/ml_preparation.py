"""Read-only dataset validation, synthetic labels, and reproducible partitions.

Clean-architecture role: adapter. It orchestrates (service-style) but only
with adapter-safe tools (pandas/sklearn); domain rules (label/score) stay
in ``synthetic_complaints`` (pure functions) and the split policy/mechanics
in ``partitioning`` (sizes + sklearn execution). ``prepare_dataset`` is the
thin composition root: load → validate → enrich → split → preprocessor →
metadata. No CSV is ever written.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from pathlib import Path
from typing import Any, cast

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

from .partitioning.split_sizes import SPLIT_NAMES
from .partitioning.stratified_split import split_indices
from .synthetic_complaints import (
    COMPLAINT_MAX,
    COMPLAINT_MIN,
    COMPLAINT_WEIGHT,
    SCORE_FORMULA,
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
INTEGER_COLUMNS = ("cantidad_contenedores", "dias_desde_ultima_recoleccion")
ZONES = frozenset(ZONE_WEIGHTS)
CLASSES = ("baja", "media", "alta")
CATEGORICAL_COLUMN = "tipo_zona"


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
    missing = [
        column for column in REQUIRED_COLUMNS if frame[column].isna().to_numpy().any()
    ]
    if missing:
        raise ValueError(f"missing values in columns: {', '.join(missing)}")
    ids = frame["tramo_id"].astype(str)
    if ids.str.strip().eq("").any() or ids.duplicated().any():
        raise ValueError("tramo_id values must be non-empty and unique")
    bad_zones = sorted(set(frame["tipo_zona"].astype(str)) - ZONES)
    if bad_zones:
        raise ValueError(f"invalid tipo_zona categories: {bad_zones}")
    for column in INTEGER_COLUMNS:
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


def _class_distribution(y: pd.Series) -> dict[str, int]:
    return {label: int(y.eq(label).sum()) for label in CLASSES if y.eq(label).any()}


def _load_and_validate(source: str | Path | pd.DataFrame) -> pd.DataFrame:
    """Load a copy and validate required columns, IDs, categories, values."""
    frame = _load_frame(source)
    _validate(frame)
    frame = frame.reset_index(drop=True)
    for column in INTEGER_COLUMNS:
        frame[column] = pd.to_numeric(frame[column])
    return frame


def _enrich_frame(frame: pd.DataFrame, *, seed: int) -> pd.DataFrame:
    """Add synthetic complaints and rebuilt label in a single pass.

    Keeps ``prioridad_recoleccion_original`` (#9) for audit. Zero containers
    always give zero complaints. No input column is mutated in place beyond
    the validated numeric conversion done in ``_load_and_validate``.
    """
    enriched = frame.copy(deep=True)
    enriched["prioridad_recoleccion_original"] = enriched["prioridad_recoleccion"]
    complaints: list[int] = []
    new_labels: list[str] = []
    for record in enriched.to_dict(orient="records"):
        count = int(record["cantidad_contenedores"])
        segment_id = str(record["tramo_id"])
        days = int(record["dias_desde_ultima_recoleccion"])
        zone = str(record["tipo_zona"])
        total = complaint_count_for_segment(count, seed=seed, segment_id=segment_id)
        complaints.append(total)
        new_labels.append(
            label_priority(days=days, containers=count, zone=zone, complaints=total)
        )
    enriched["historico_quejas_vecinales"] = complaints
    enriched["prioridad_recoleccion"] = new_labels
    return enriched


def _build_preprocessor() -> ColumnTransformer:
    """Unfitted transformer: OneHot (ignore unknown) + numeric passthrough."""
    return ColumnTransformer(
        transformers=[
            ("zona", OneHotEncoder(handle_unknown="ignore"), [CATEGORICAL_COLUMN]),
            ("numericas", "passthrough", list(NUMERIC_COLUMNS)),
        ],
        remainder="drop",
    )


def _build_partitions(
    y: pd.Series, tramo_ids: pd.Series, seed: int
) -> tuple[dict[str, DataPartition], dict[str, tuple[int, ...]], bool]:
    """Split positions reproducibly; attach size/IDs/distribution metadata."""
    split_map, stratified = split_indices(y.tolist(), seed)
    partitions = {}
    for name in SPLIT_NAMES:
        indices = split_map[name]
        split_y = y.iloc[list(indices)]
        partitions[name] = DataPartition(
            indices=indices,
            metadata={
                "size": len(indices),
                "tramo_ids": tramo_ids.iloc[list(indices)].tolist(),
                "class_distribution": _class_distribution(split_y),
            },
        )
    return partitions, split_map, stratified


def _build_metadata(
    *,
    seed: int,
    stratified: bool,
    partitions: dict[str, DataPartition],
    y: pd.Series,
    split_map: dict[str, tuple[int, ...]],
) -> dict[str, Any]:
    """Audit record: seed, sizes, rule, complaints, rounding, split IDs."""
    _ = split_map  # IDs already stored per partition; kept for explicitness.
    return {
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
            "score": SCORE_FORMULA,
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


def prepare_dataset(
    source: str | Path | pd.DataFrame, *, seed: int = 0
) -> MLPreparation:
    """Validate and prepare a source dataset without writing back to it.

    Complaint draws are anonymous per represented container (0..3 inclusive),
    seeded by preparation seed and tramo_id, then summed per segment. Labels use
    score=2*dias+contenedores+zona_w+2*quejas; baja <=0, media <=2, alta >2.
    """
    frame = _load_and_validate(source)
    enriched = _enrich_frame(frame, seed=seed)
    X = cast(pd.DataFrame, enriched.loc[:, list(FEATURE_COLUMNS)].copy())
    y = cast(pd.Series, enriched["prioridad_recoleccion"].copy())
    tramo_ids = cast(pd.Series, enriched["tramo_id"].copy())
    partitions, split_map, stratified = _build_partitions(y, tramo_ids, seed)
    preprocessor = _build_preprocessor()
    metadata = _build_metadata(
        seed=seed,
        stratified=stratified,
        partitions=partitions,
        y=y,
        split_map=split_map,
    )
    return MLPreparation(enriched, X, y, tramo_ids, partitions, metadata, preprocessor)
