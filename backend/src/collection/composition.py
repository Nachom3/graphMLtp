"""Composition root (issues #12/#27).

Explicit wiring with no business logic. Domain/application never import
pandas, sklearn or FastAPI; every scientific object is built here.

Issue #27 scope: only the dataset and prediction paths are wired. The
compare-models and plan-route factories stay templates on purpose — the
former keeps its #10 wiring outside this root and the latter belongs to
the parallel issue #28, so this file does not touch them.

Inference never trains: ``create_predict_priorities_use_case`` wraps an
already-FITTED pipeline (injected directly in tests, or loaded from the
offline artifact documented in ``backend/README.md``). It takes no
training rows and no seed. The old template signature
``(model_id, rows, seed)`` implied fitting during a request and is
replaced; callers pass ``pipeline`` or ``pipeline_path`` instead.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .adapters.datasets.csv_dataset_reader import CsvDatasetReader
from .adapters.models.pipeline_store import (
    DEFAULT_MODEL_ID,
    DEFAULT_PIPELINE_PATH,
    load_pipeline,
)
from .adapters.models.sklearn_predictor import SklearnPredictor
from .application.use_cases.predict_priorities.use_case import PredictPriorities
from .application.use_cases.validate_load_dataset.use_case import ValidateLoadDataset


def create_validate_load_dataset_use_case(
    reader: CsvDatasetReader | None = None,
) -> ValidateLoadDataset:
    """Wire validation/loading with the CSV reader (seed 0, as #18)."""
    return ValidateLoadDataset(reader or CsvDatasetReader())


def create_compare_models_use_case():
    """Template. TODO: implement."""
    raise NotImplementedError


def create_predict_priorities_use_case(
    model_id: str = DEFAULT_MODEL_ID,
    pipeline: Any | None = None,
    pipeline_path: str | Path | None = None,
) -> PredictPriorities:
    """Wire prediction around a FITTED ``arbol`` pipeline (no ``fit``).

    Pass ``pipeline`` directly (tests/fakes) or ``pipeline_path`` to an
    offline-saved artifact (default ``backend/artifacts/arbol.joblib``).
    Unknown ``model_id`` raises ``ValueError`` (API maps it to
    ``MODELO_DESCONOCIDO``); a missing file raises ``FileNotFoundError``
    (model unavailable) and a bad payload raises ``ValueError``
    (model incompatible).
    """
    if model_id != DEFAULT_MODEL_ID:
        raise ValueError(
            f"modelo desconocido: {model_id!r}; disponible: {DEFAULT_MODEL_ID!r}"
        )
    fitted = pipeline if pipeline is not None else load_pipeline(
        Path(pipeline_path) if pipeline_path is not None else DEFAULT_PIPELINE_PATH
    )
    return PredictPriorities(SklearnPredictor(model_id, fitted))


def create_plan_route_use_case():
    """Template. TODO: implement."""
    raise NotImplementedError
