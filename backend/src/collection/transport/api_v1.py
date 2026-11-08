"""FastAPI v1 transport DTOs and routes.

The transport validates request shapes, maps DTOs/errors and delegates to
application use cases. It does not implement collection or graph logic.
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..application.ports.container_reader import ContainerReader
from ..application.ports.geometry_reader import GeometryReader
from ..application.use_cases.plan_route.contract import PlanRouteContract
from ..application.use_cases.predict_priorities.contract import (
    PredictPrioritiesContract,
)
from ..application.use_cases.validate_load_dataset.contract import (
    ValidateLoadDatasetContract,
)
from ..composition import (
    create_container_reader,
    create_geometry_reader,
    create_plan_route_use_case,
    create_predict_priorities_use_case,
    create_validate_load_dataset_use_case,
    pilot_scenario_source,
)
from ..config import resolve_limit, scenario_source_is_custom
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


class ExplainRequest(BaseModel):
    model_id: str
    segment: SegmentDTO


def _subsegment_intersects_bbox(
    x1: float, y1: float, x2: float, y2: float,
    *, sur: float, norte: float, oeste: float, este: float,
) -> bool:
    """Liang-Barsky: whether one [lon, lat] sub-segment touches the bbox."""
    dx, dy = x2 - x1, y2 - y1
    t0, t1 = 0.0, 1.0
    for p, q in (
        (-dx, x1 - oeste), (dx, este - x1), (-dy, y1 - sur), (dy, norte - y1)
    ):
        if p == 0:
            if q < 0:
                return False
        elif p < 0:
            t0 = max(t0, q / p)
        else:
            t1 = min(t1, q / p)
    return t0 <= t1


def _segment_in_bbox(
    coords: list[list[float]] | None,
    origin: tuple[float, float] | None,
    destination: tuple[float, float] | None,
    *, sur: float, norte: float, oeste: float, este: float,
) -> bool:
    """Mirror the frontend `lineaIntersecaLimites`: full line, crossings count."""
    points = [tuple(p) for p in coords if len(p) == 2] if coords else []
    if len(points) < 2:
        if origin is None or destination is None:
            return False
        points = [origin, destination]
    return any(
        _subsegment_intersects_bbox(
            a[0], a[1], b[0], b[1], sur=sur, norte=norte, oeste=oeste, este=este
        )
        for a, b in zip(points, points[1:])  # noqa: B905 - adjacent pairs, lengths differ by design
    )


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
    geometry_reader: GeometryReader | None = None,
    container_reader: ContainerReader | None = None,
    scenario_source: str | None = None,
) -> APIRouter:
    router = APIRouter()
    validate = validate_use_case or create_validate_load_dataset_use_case()
    geometries_source = geometry_reader or create_geometry_reader()
    containers_source = container_reader or create_container_reader()
    source = (
        scenario_source
        if scenario_source is not None
        else str(pilot_scenario_source())
    )

    @router.get("/scenario", response_model=None)
    def get_scenario(
        sur: float | None = None,
        norte: float | None = None,
        oeste: float | None = None,
        este: float | None = None,
        limit: int | None = None,
    ) -> dict | JSONResponse:
        bbox = [sur, norte, oeste, este]
        if any(v is not None for v in bbox) and not all(v is not None for v in bbox):
            return _error(
                422, "INVALID_REQUEST",
                "bbox incompleto: sur, norte, oeste y este son requeridos juntos",
            )
        if (
            sur is not None and norte is not None and oeste is not None and este is not None
            and (sur > norte or oeste > este)
        ):
            return _error(422, "INVALID_REQUEST", "bbox inválido: sur<=norte y oeste<=este")
        try:
            effective = resolve_limit(limit)
        except ValueError as exc:
            return _error(422, "INVALID_REQUEST", str(exc))
        try:
            load_scenario = validate.execute  # caso de uso; no es SQL (falso positivo del linter)
            nodes, segments = load_scenario(source, "v1")
            geometries = geometries_source.load(source, required=scenario_source is None)
            if (geometries or scenario_source is None) and set(geometries) != {segment.segment_id for segment in segments}:
                raise InvalidDataset("IDs de geometrías y tramos no coinciden")
        except InvalidDataset as exc:
            detail = str(exc)
            if scenario_source is None:
                detail += "; generá o revisá el escenario con python scripts/build_dataset.py --montevideo"
            return _error(503, "SCENARIO_UNAVAILABLE", detail)
        matched = segments
        if sur is not None and norte is not None and oeste is not None and este is not None:
            positions = {node["nodo_id"]: (node["lon"], node["lat"]) for node in nodes}
            matched = [
                segment
                for segment in segments
                if _segment_in_bbox(
                    (geometries.get(segment.segment_id) or {}).get("coordinates"),
                    positions.get(segment.origin_node),
                    positions.get(segment.destination_node),
                    sur=sur, norte=norte, oeste=oeste, este=este,
                )
            ]
        total = len(matched)
        page = matched[:effective] if effective is not None else matched
        used_nodes = {n for segment in page for n in (segment.origin_node, segment.destination_node)}
        return {
            "scenario_id": (
                "pilot" if scenario_source is not None
                else Path(source).name if scenario_source_is_custom()
                else "montevideo"
            ),
            "version": "v1",
            "total": total,
            "limit": effective,
            "truncated": total > len(page),
            "nodes": [
                {
                    "node_id": node["nodo_id"],
                    "lon": node["lon"],
                    "lat": node["lat"],
                }
                for node in nodes
                if node["nodo_id"] in used_nodes
            ],
            "segments": [
                {**segment.__dict__, "geometry": geometries.get(segment.segment_id)}
                for segment in page
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

    @router.post("/predictions:explain", response_model=None)
    def explain(body: ExplainRequest) -> dict | JSONResponse:
        try:
            use_case = predict_use_case or create_predict_priorities_use_case(
                model_id=body.model_id
            )
            return use_case.explain(body.model_id, body.segment.to_entity())
        except FileNotFoundError as exc:
            return _error(503, "MODEL_UNAVAILABLE", str(exc))
        except ValueError as exc:
            lowered = str(exc).lower()
            if "desconocido" in lowered:
                code = "MODEL_UNKNOWN"
            elif "explicación no disponible" in lowered or "no es un árbol" in lowered:
                code = "EXPLAIN_UNSUPPORTED"
            else:
                code = "INVALID_DATASET"
            return _error(422, code, str(exc))

    @router.get("/containers", response_model=None)
    def containers(
        sur: float, norte: float, oeste: float, este: float, limit: int = 2000
    ) -> dict | JSONResponse:
        if sur > norte or oeste > este:
            return _error(422, "INVALID_REQUEST", "bbox inválido: sur<=norte y oeste<=este")
        if limit < 0:
            return _error(422, "INVALID_REQUEST", "limit debe ser >= 0")
        try:
            recorte, total = containers_source.query(
                sur=sur, norte=norte, oeste=oeste, este=este, limit=limit
            )
        except FileNotFoundError as exc:
            return _error(503, "SCENARIO_UNAVAILABLE", str(exc))
        return {
            "points": recorte,
            "total": total,
            "truncated": total > len(recorte),
        }

    @router.post("/routes:plan", response_model=None)
    def plan(body: PlanRequest) -> dict | JSONResponse:
        try:
            use_case = plan_use_case or create_plan_route_use_case()
            priorities = [
                PredictedSegment(segment_id=segment_id, priority=priority)
                for segment_id, priority in body.priorities.items()
            ]
            run_planner = use_case.execute  # caso de uso; no es SQL (falso positivo del linter)
            route = run_planner(
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
