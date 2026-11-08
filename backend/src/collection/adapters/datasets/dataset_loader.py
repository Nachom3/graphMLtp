"""Dataset loading and validation (adapter detail; pandas lives here).

Reads a CSV (or copies a frame), validates required columns, IDs,
categories and values, and normalizes integer columns. No synthetic
labels, no splits, no preprocessor: those stay in ``ml_preparation``.
"""
from __future__ import annotations

from math import isfinite
from pathlib import Path
from typing import cast

import pandas as pd

from .synthetic_complaints import ZONE_WEIGHTS

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


def load_frame(source: str | Path | pd.DataFrame) -> pd.DataFrame:
    """Read a CSV into a frame, or deep-copy an in-memory frame."""
    if isinstance(source, pd.DataFrame):
        return source.copy(deep=True)
    try:
        return pd.read_csv(source)
    except (OSError, pd.errors.ParserError, UnicodeError) as exc:
        raise ValueError(f"unable to read dataset: {exc}") from exc


def validate_frame(frame: pd.DataFrame) -> None:
    """Validate required columns, IDs, categories and label values."""
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


def load_validated_frame(source: str | Path | pd.DataFrame) -> pd.DataFrame:
    """Load a copy, validate it, and normalize integer columns."""
    frame = load_frame(source)
    validate_frame(frame)
    frame = frame.reset_index(drop=True)
    for column in INTEGER_COLUMNS:
        frame[column] = pd.to_numeric(frame[column])
    return frame
