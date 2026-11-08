"""Composition root (issues #12/#27).

Explicit wiring with no business logic. Domain/application never import
pandas, sklearn or FastAPI; every scientific object is built here.

Arbol-only scope: the backend wires the dataset, prediction (fitted
``arbol`` artifact) and route-planning paths. Model comparison lives in
the notebooks with their own sklearn code, so this root wires no
comparison use case.

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

from .adapters.datasets.container_store import FileContainerStore
from .adapters.datasets.csv_dataset_reader import CsvDatasetReader
from .adapters.datasets.geojson_geometry_reader import GeoJsonGeometryReader
from .adapters.graphs.networkx_route_planner import NetworkxRoutePlanner
from .adapters.models.pipeline_store import (
    DEFAULT_MODEL_ID,
    DEFAULT_PIPELINE_PATH,
    load_pipeline,
)
from .adapters.models.sklearn_predictor import SklearnPredictor
from .application.use_cases.plan_route.use_case import PlanRoute
from .application.use_cases.predict_priorities.use_case import PredictPriorities
from .application.use_cases.validate_load_dataset.use_case import ValidateLoadDataset


def create_validate_load_dataset_use_case(
    reader: CsvDatasetReader | None = None,
) -> ValidateLoadDataset:
    """Wire validation/loading with the CSV reader (seed 0, as #18)."""
    return ValidateLoadDataset(reader or CsvDatasetReader())


def create_container_reader() -> FileContainerStore:
    """Wire container points to the file-backed store."""
    return FileContainerStore()


def create_geometry_reader() -> GeoJsonGeometryReader:
    """Wire road geometry to the GeoJSON sidecar reader."""
    return GeoJsonGeometryReader()


def create_predict_priorities_use_case(
    model_id: str = DEFAULT_MODEL_ID,
    pipeline: Any | None = None,
    pipeline_path: str | Path | None = None,
) -> PredictPriorities:
    """Wire prediction around a FITTED ``arbol`` pipeline (no ``fit``).

    Pass ``pipeline`` directly (tests/fakes) or ``pipeline_path`` to an
    offline-saved artifact (default ``backend/artifacts/arbol-montevideo.joblib``).
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


def create_plan_route_use_case() -> PlanRoute:
    """Wire route planning to the production NetworkX adapter."""
    return PlanRoute(NetworkxRoutePlanner())


def pilot_scenario_source() -> Path:
    """Return the full-city dataset, unless explicitly configured otherwise.

    Never fall back silently to the small test fixture or the pilot area.
    """
    import os

    configured = os.environ.get("COLLECTION_SCENARIO_SOURCE")
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parents[3] / "dataset" / "salida-montevideo"
