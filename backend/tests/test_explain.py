"""Explain + containers endpoints (T2/T3): contract tests with fakes and a real tree."""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from collection.adapters.models.sklearn_predictor import SklearnPredictor  # noqa: E402
from collection.domain.entities.segment_features import SegmentFeatures  # noqa: E402
from collection.transport.api_v1 import create_router  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def segment_dict(segment_id: str = "T1") -> dict:
    return {
        "segment_id": segment_id,
        "origin_node": "N1",
        "destination_node": "N2",
        "length_m": 10.0,
        "zone_type": "residential",
        "container_count": 3,
        "days_since_last_collection": 0,
        "historic_neighbor_complaints": 0,
    }


def entity() -> SegmentFeatures:
    return SegmentFeatures(
        segment_id="T1",
        origin_node="N1",
        destination_node="N2",
        length_m=10.0,
        zone_type="residential",
        container_count=3,
        days_since_last_collection=0,
        historic_neighbor_complaints=0,
    )


def fitted_predictor() -> SklearnPredictor:
    import pandas as pd
    from sklearn.compose import ColumnTransformer
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import OneHotEncoder
    from sklearn.tree import DecisionTreeClassifier

    frame = pd.DataFrame(
        [
            {"cantidad_contenedores": 0, "dias_desde_ultima_recoleccion": 0, "tipo_zona": "residencial", "historico_quejas_vecinales": 0},
            {"cantidad_contenedores": 1, "dias_desde_ultima_recoleccion": 0, "tipo_zona": "residencial", "historico_quejas_vecinales": 0},
            {"cantidad_contenedores": 3, "dias_desde_ultima_recoleccion": 0, "tipo_zona": "residencial", "historico_quejas_vecinales": 0},
            {"cantidad_contenedores": 0, "dias_desde_ultima_recoleccion": 2, "tipo_zona": "comercial", "historico_quejas_vecinales": 1},
            {"cantidad_contenedores": 2, "dias_desde_ultima_recoleccion": 1, "tipo_zona": "industrial", "historico_quejas_vecinales": 0},
            {"cantidad_contenedores": 0, "dias_desde_ultima_recoleccion": 0, "tipo_zona": "comercial", "historico_quejas_vecinales": 0},
        ]
    )
    labels = ["baja", "media", "alta", "alta", "alta", "media"]
    preprocessor = ColumnTransformer(
        [("zona", OneHotEncoder(handle_unknown="ignore"), ["tipo_zona"])],
        remainder="passthrough",
    )
    pipe = make_pipeline(preprocessor, DecisionTreeClassifier(random_state=0))
    pipe.fit(frame, labels)
    return SklearnPredictor("arbol", pipe)


def test_explain_returns_score_and_tree_path():
    result = fitted_predictor().explain(entity())
    assert result["segment_id"] == "T1"
    assert result["priority"] == "high"
    assert result["score"]["total"] == 3
    assert result["score"]["containers_weighted"] == 3
    assert len(result["path"]) >= 2
    assert result["path"][-1] == {"node": result["path"][-1]["node"], "leaf": True}
    first = result["path"][0]
    assert {"feature", "threshold", "value", "direction"} <= set(first)


def test_explain_rejects_non_tree_estimators():
    from types import SimpleNamespace

    import numpy as np

    class FakePreprocessor:
        def transform(self, frame):
            return np.zeros((len(frame), 2))

    pipe = SimpleNamespace(
        steps=[("pre", FakePreprocessor()), ("est", SimpleNamespace())],
        predict=lambda frame: ["media"] * len(frame),
    )
    predictor = SklearnPredictor("logistica", pipe)
    try:
        predictor.explain(entity())
    except ValueError as exc:
        assert "no es un árbol" in str(exc)
    else:  # pragma: no cover - el estimador falso nunca tiene tree_
        raise AssertionError("se esperaba ValueError")


def client_with_explainer(explainer) -> TestClient:
    app = FastAPI()
    app.include_router(create_router(predict_use_case=explainer, scenario_source=str(FIXTURES)))
    return TestClient(app)


class Explainer:
    def explain(self, model_id, segment):
        if model_id != "arbol":
            raise ValueError(f"modelo desconocido: {model_id!r}")
        return {
            "segment_id": segment.segment_id,
            "priority": "high",
            "score": {"total": 3},
            "path": [{"node": 0, "feature": "x", "threshold": 1.5, "value": 3.0, "direction": "derecha (>)"}],
        }


def test_explain_endpoint_returns_path():
    response = client_with_explainer(Explainer()).post(
        "/predictions:explain", json={"model_id": "arbol", "segment": segment_dict()}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["segment_id"] == "T1"
    assert body["priority"] == "high"
    assert body["path"][0]["direction"] == "derecha (>)"


def test_explain_endpoint_maps_unknown_and_unsupported_models():
    unknown = client_with_explainer(Explainer()).post(
        "/predictions:explain", json={"model_id": "knn", "segment": segment_dict()}
    )
    assert unknown.status_code == 422
    assert unknown.json()["detail"]["code"] == "MODEL_UNKNOWN"

    class NoTree:
        def explain(self, model_id, segment):
            raise ValueError("explicación no disponible: LogisticRegression no es un árbol")

    unsupported = client_with_explainer(NoTree()).post(
        "/predictions:explain", json={"model_id": "arbol", "segment": segment_dict()}
    )
    assert unsupported.status_code == 422
    assert unsupported.json()["detail"]["code"] == "EXPLAIN_UNSUPPORTED"


def test_containers_endpoint_filters_by_bbox_and_validates_it():
    from collection.api import create_app

    client = TestClient(create_app())
    ok = client.get(
        "/containers",
        params={"sur": -34.86, "norte": -34.85, "oeste": -56.25, "este": -56.23, "limit": 2000},
    )
    assert ok.status_code == 200, ok.text
    body = ok.json()
    assert body["total"] >= len(body["points"])
    assert all(
        -34.86 <= p["lat"] <= -34.85 and -56.25 <= p["lon"] <= -56.23 for p in body["points"]
    )

    empty = client.get(
        "/containers",
        params={"sur": -34.86, "norte": -34.85, "oeste": -56.25, "este": -56.23, "limit": 0},
    )
    assert empty.json()["points"] == []
    assert empty.json()["truncated"] == (body["total"] > 0)

    bad = client.get(
        "/containers",
        params={"sur": -34.85, "norte": -34.86, "oeste": -56.23, "este": -56.25},
    )
    assert bad.status_code == 422
    assert bad.json()["detail"]["code"] == "INVALID_REQUEST"
