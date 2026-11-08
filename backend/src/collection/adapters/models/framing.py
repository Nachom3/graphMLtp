"""Row framing (adapter detail; pandas lives here, never in app).

Validates plain port rows into a frame and splits features/labels per
#18 partition. No sklearn, no model choice, no record building.
"""
from __future__ import annotations

import pandas as pd

from .metrics import CLASS_LABELS

FEATURE_COLUMNS = (
    "cantidad_contenedores",
    "dias_desde_ultima_recoleccion",
    "tipo_zona",
    "historico_quejas_vecinales",
)
LABEL_COLUMN = "prioridad_recoleccion"
PARTITIONS = ("train", "validation", "test")


def frame_from_rows(rows: list[dict]) -> pd.DataFrame:
    """Validate port rows into a frame with known columns/partitions."""
    frame = pd.DataFrame(rows)
    required = {*FEATURE_COLUMNS, LABEL_COLUMN, "_partition", "tramo_id"}
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"rows are missing columns: {', '.join(missing)}")
    bad = sorted(set(frame["_partition"].astype(str)) - set(PARTITIONS))
    if bad:
        raise ValueError(f"invalid _partition values: {bad}")
    unknown_models_note = sorted(set(frame[LABEL_COLUMN].astype(str)) - set(CLASS_LABELS))
    if unknown_models_note:
        raise ValueError(f"invalid {LABEL_COLUMN} values: {unknown_models_note}")
    return frame


def split_xy(frame: pd.DataFrame, partition: str) -> tuple[pd.DataFrame, pd.Series]:
    """Split one #18 partition into features and labels."""
    part = frame.loc[frame["_partition"] == partition]
    X = part.loc[:, list(FEATURE_COLUMNS)].copy()
    y = part[LABEL_COLUMN].copy()
    return X, y
