"""HTTP contract tests for the v1 API transport."""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from collection.api import create_app  # noqa: E402
from collection.transport.api_v1 import create_router  # noqa: E402


FIXTURES = Path(__file__).resolve().parent / "fixtures"


def client_with(*, predict_use_case=None) -> TestClient:
    app = FastAPI()
    app.include_router(
        create_router(
            predict_use_case=predict_use_case,
            scenario_source=str(FIXTURES),
        )
    )
    return TestClient(app)


def segment(
    segment_id: str,
    origin: str,
    destination: str,
    *,
    containers: int = 1,
    length: float = 5.0,
) -> dict:
    return {
        "segment_id": segment_id,
        "origin_node": origin,
        "destination_node": destination,
        "length_m": length,
        "zone_type": "residential",
        "container_count": containers,
        "days_since_last_collection": 1,
        "historic_neighbor_complaints": 0,
    }


def test_health_and_pilot_scenario_http_contract():
    client = TestClient(create_app())

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "version": "v1", "schema": "v1"}

    response = client_with().get("/scenario")
    assert response.status_code == 200
    scenario = response.json()
    assert scenario["scenario_id"] == "pilot"
    assert scenario["version"] == "v1"
    assert len(scenario["nodes"]) == 6
    assert len(scenario["segments"]) == 12
    assert scenario["segments"][0]["segment_id"] == "T0001"


def test_default_city_model_path_is_anchored_to_backend():
    from collection.adapters.models.pipeline_store import DEFAULT_PIPELINE_PATH

    assert DEFAULT_PIPELINE_PATH == Path(__file__).resolve().parents[1] / "artifacts" / "arbol-montevideo.joblib"


def test_default_scenario_reports_missing_city_dataset_without_fallback(monkeypatch, tmp_path):
    monkeypatch.setenv("COLLECTION_SCENARIO_SOURCE", str(tmp_path / "missing"))
    response = TestClient(create_app()).get("/scenario")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "SCENARIO_UNAVAILABLE"


def test_scenario_exposes_geometry_by_segment_id_and_rejects_mismatch(tmp_path):
    for name in ("nodos.csv", "tramos.csv"):
        shutil.copy(FIXTURES / name, tmp_path / name)
    fixture_segments = client_with().get("/scenario").json()["segments"]
    coordinates = [[-56.15, -34.90], [-56.149, -34.901], [-56.148, -34.90]]
    features = [
        {"type": "Feature", "properties": {"tramo_id": segment["segment_id"]},
         "geometry": {"type": "LineString", "coordinates": coordinates}}
        for segment in reversed(fixture_segments)
    ]
    path = tmp_path / "geometrias.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    app = FastAPI()
    app.include_router(create_router(scenario_source=str(tmp_path)))
    client = TestClient(app)
    response = client.get("/scenario")
    assert response.status_code == 200
    for segment in response.json()["segments"]:
        assert segment["geometry"] == {"type": "LineString", "coordinates": coordinates}
    features.pop()
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    response = client.get("/scenario")
    assert response.status_code == 503
    assert "no coinciden" in response.json()["detail"]["detail"]


def test_prediction_returns_one_prediction_per_segment_without_training_rows():
    class Predictor:
        def execute(self, model_id, segments):
            from collection.domain.entities.predicted_segment import PredictedSegment

            return [
                PredictedSegment(segment_id=item.segment_id, priority="high")
                for item in segments
            ]

    response = client_with(predict_use_case=Predictor()).post(
        "/predictions:predict",
        json={
            "model_id": "arbol",
            "segments": [
                segment("T1", "N1", "N2"),
                segment("T2", "N2", "N3", containers=0),
            ],
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "model_id": "arbol",
        "predictions": [
            {"segment_id": "T1", "priority": "high"},
            {"segment_id": "T2", "priority": "high"},
        ],
    }


def test_prediction_maps_unavailable_model_to_documented_error():
    class MissingModel:
        def execute(self, model_id, segments):
            raise FileNotFoundError("model artifact unavailable")

    response = client_with(predict_use_case=MissingModel()).post(
        "/predictions:predict", json={"model_id": "arbol", "segments": []}
    )
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "MODEL_UNAVAILABLE"


def test_plan_http_uses_zero_container_segment_only_as_transit():
    response = TestClient(create_app()).post(
        "/routes:plan",
        json={
            "nodes": [],
            "segments": [
                segment("XY", "X", "Y", containers=2),
                segment("ZW", "Z", "W", containers=2),
                segment("YZ", "Y", "Z", containers=0, length=3.0),
            ],
            "priorities": {"XY": "high", "ZW": "high", "YZ": "high"},
            "include": ["high"],
        },
    )

    assert response.status_code == 200, response.text
    route = response.json()
    assert set(route["mandatory"]) == {"XY", "ZW"}
    assert "YZ" in route["transit"]
    assert "YZ" in route["order"]
    assert route["total_cost_m"] == 26.0
    assert route["unit"] == "meters"
    assert route["coverage"] == 1.0
    assert route["repeated_distance_m"] == route["total_cost_m"] - 13.0
    assert set(route["order"]) == {"XY", "ZW", "YZ"}


def test_plan_rejects_invalid_shape_and_no_destinations():
    client = TestClient(create_app())
    invalid = client.post(
        "/routes:plan",
        json={
            "nodes": [],
            "segments": [segment("T1", "A", "B", length=0)],
            "priorities": {"T1": "high"},
        },
    )
    assert invalid.status_code == 422
    assert invalid.json()["detail"]["code"] == "INVALID_REQUEST"

    no_destinations = client.post(
        "/routes:plan",
        json={
            "nodes": [],
            "segments": [segment("T0", "A", "B", containers=0)],
            "priorities": {"T0": "high"},
            "include": ["high"],
        },
    )
    assert no_destinations.status_code == 422
    assert no_destinations.json()["detail"]["code"] == "IMPOSSIBLE_ROUTE"


def test_plan_reports_disconnected_full_graph_as_impossible_route():
    response = TestClient(create_app()).post(
        "/routes:plan",
        json={
            "nodes": [],
            "segments": [
                segment("AB", "A", "B"),
                segment("CD", "C", "D"),
            ],
            "priorities": {"AB": "high", "CD": "high"},
            "include": ["high"],
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "IMPOSSIBLE_ROUTE"


def test_scenario_supports_limit_and_bbox_slice():
    client = client_with()
    full = client.get("/scenario")
    assert full.status_code == 200, full.text
    assert full.json()["total"] == 12
    assert full.json()["truncated"] is False
    assert len(full.json()["segments"]) == 12

    limited = client.get("/scenario", params={"limit": 2})
    assert limited.status_code == 200, limited.text
    body = limited.json()
    assert [s["segment_id"] for s in body["segments"]] == ["T0001", "T0002"]
    assert body["total"] == 12
    assert body["truncated"] is True

    west = client.get(
        "/scenario",
        params={"sur": -34.9105, "norte": -34.9095, "oeste": -56.1555, "este": -56.1545},
    )
    assert west.status_code == 200, west.text
    ids = [s["segment_id"] for s in west.json()["segments"]]
    assert 0 < len(ids) < 12
    assert "T0002" not in ids

    bad = client.get("/scenario", params={"sur": -34.90, "norte": -34.91, "oeste": -56.15, "este": -56.14})
    assert bad.status_code == 422
    assert bad.json()["detail"]["code"] == "INVALID_REQUEST"

    incomplete = client.get("/scenario", params={"sur": -34.91})
    assert incomplete.status_code == 422
    assert incomplete.json()["detail"]["code"] == "INVALID_REQUEST"


def test_scenario_rejects_limit_above_configured_max(monkeypatch):
    monkeypatch.setenv("COLLECTION_SCENARIO_MAX_LIMIT", "1")
    response = client_with().get("/scenario", params={"limit": 2})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_REQUEST"
