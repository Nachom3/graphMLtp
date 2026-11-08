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
from pathlib import Path
from typing import Any, cast

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder

from .dataset_loader import CLASSES, load_validated_frame
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
# Load/validate constants live in dataset_loader.py (single source of truth).
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


def _class_distribution(y: pd.Series) -> dict[str, int]:
    return {label: int(y.eq(label).sum()) for label in CLASSES if y.eq(label).any()}


# Loading + validation live in dataset_loader.load_validated_frame.


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
    frame = load_validated_frame(source)
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
