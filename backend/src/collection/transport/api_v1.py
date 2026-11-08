"""FastAPI v1 transport DTOs and routes.

The transport validates request shapes, maps DTOs/errors and delegates to
application use cases. It does not implement collection or graph logic.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..adapters.datasets.segment_geometry import load_segment_geometries
from ..application.use_cases.plan_route.contract import PlanRouteContract
from ..application.use_cases.predict_priorities.contract import (
    PredictPrioritiesContract,
)
from ..application.use_cases.validate_load_dataset.contract import (
    ValidateLoadDatasetContract,
)
from ..composition import (
    create_plan_route_use_case,
    create_predict_priorities_use_case,
    create_validate_load_dataset_use_case,
    pilot_scenario_source,
)
from ..domain.entities.predicted_segment import PredictedSegment
from ..domain.entities.route_config import RouteConfig
from ..domain.entities.segment_features import SegmentFeatures
from ..domain.errors.impossible_route import ImpossibleRoute
from ..domain.errors.invalid_dataset import InvalidDataset
from ..domain.errors.prediction_without_segment import PredictionWithoutSegment

VERSION = "v1"

PriorityDTO = Literal["low", "medium", "high"]
ZoneTypeDTO = Literal["residential", "commercial", "industrial"]


class SegmentDTO(BaseModel):
    segment_id: str
    origin_node: str
    destination_node: str
    length_m: float = Field(gt=0)
    zone_type: ZoneTypeDTO
    container_count: int = Field(ge=0)
    days_since_last_collection: int = Field(ge=0)
    historic_neighbor_complaints: int = Field(ge=0)

    def to_entity(self) -> SegmentFeatures:
        return SegmentFeatures(**self.model_dump())


class NodeDTO(BaseModel):
    node_id: str
    lon: float
    lat: float


class PredictRequest(BaseModel):
    model_id: str
    segments: list[SegmentDTO]


class PriorityDTOIn(BaseModel):
    segment_id: str
    priority: PriorityDTO


class PlanRequest(BaseModel):
    nodes: list[NodeDTO]
    segments: list[SegmentDTO]
    priorities: dict[str, PriorityDTO]
    include: list[PriorityDTO] = ["medium", "high"]
    start_node_id: str | None = None


def _error(status_code: int, code: str, detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"detail": {"code": code, "detail": detail}},
    )


def create_router(
    *,
    validate_use_case: ValidateLoadDatasetContract | None = None,
    predict_use_case: PredictPrioritiesContract | None = None,
    plan_use_case: PlanRouteContract | None = None,
    scenario_source: str | None = None,
) -> APIRouter:
    router = APIRouter()
    validate = validate_use_case or create_validate_load_dataset_use_case()
    source = (
        scenario_source
        if scenario_source is not None
        else str(pilot_scenario_source())
    )

    @router.get("/scenario", response_model=None)
    def get_scenario() -> dict | JSONResponse:
        try:
            nodes, segments = validate.execute(source, "v1")
            geometries = load_segment_geometries(source, required=scenario_source is None)
            if (geometries or scenario_source is None) and set(geometries) != {segment.segment_id for segment in segments}:
                raise InvalidDataset("IDs de geometrías y tramos no coinciden")
        except InvalidDataset as exc:
            detail = str(exc)
            if scenario_source is None:
                detail += "; generá o revisá el escenario con python scripts/build_dataset.py --montevideo"
            return _error(503, "SCENARIO_UNAVAILABLE", detail)
        return {
            "scenario_id": (
                "pilot" if scenario_source is not None
                else Path(source).name if os.environ.get("COLLECTION_SCENARIO_SOURCE")
                else "montevideo"
            ),
            "version": "v1",
            "nodes": [
                {
                    "node_id": node["nodo_id"],
                    "lon": node["lon"],
                    "lat": node["lat"],
                }
                for node in nodes
            ],
            "segments": [
                {**segment.__dict__, "geometry": geometries.get(segment.segment_id)}
                for segment in segments
            ],
        }

    @router.post("/predictions:predict", response_model=None)
    def predict(body: PredictRequest) -> dict | JSONResponse:
        try:
            use_case = predict_use_case or create_predict_priorities_use_case(
                model_id=body.model_id
            )
            predictions = use_case.execute(
                body.model_id, [segment.to_entity() for segment in body.segments]
            )
        except FileNotFoundError as exc:
            return _error(503, "MODEL_UNAVAILABLE", str(exc))
        except PredictionWithoutSegment as exc:
            return _error(422, "PREDICTION_WITHOUT_SEGMENT", str(exc))
        except InvalidDataset as exc:
            return _error(422, "INVALID_DATASET", str(exc))
        except ValueError as exc:
            code = "MODEL_UNKNOWN" if "desconocido" in str(exc).lower() else "INVALID_DATASET"
            return _error(422, code, str(exc))
        return {
            "model_id": body.model_id,
            "predictions": [prediction.__dict__ for prediction in predictions],
        }

    @router.post("/routes:plan", response_model=None)
    def plan(body: PlanRequest) -> dict | JSONResponse:
        try:
            use_case = plan_use_case or create_plan_route_use_case()
            priorities = [
                PredictedSegment(segment_id=segment_id, priority=priority)
                for segment_id, priority in body.priorities.items()
            ]
            route = use_case.execute(
                [node.model_dump() for node in body.nodes],
                [segment.to_entity() for segment in body.segments],
                priorities,
                RouteConfig(
                    include=tuple(body.include),
                    start_node_id=body.start_node_id,
                ),
            )
        except ImpossibleRoute as exc:
            return _error(422, "IMPOSSIBLE_ROUTE", str(exc))
        except InvalidDataset as exc:
            return _error(422, "INVALID_DATASET", str(exc))
        except ValueError as exc:
            return _error(422, "INVALID_DATASET", str(exc))
        return {
            "order": list(route.order),
            "repetitions": list(route.repetitions),
            "total_cost_m": route.total_cost_m,
            "unit": route.unit,
            "mandatory": list(route.mandatory),
            "transit": list(route.transit),
            "repeated_distance_m": route.repeated_distance_m,
            "coverage": route.coverage,
        }

    return router
