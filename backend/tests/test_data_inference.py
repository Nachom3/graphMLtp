"""Issue #27: carga de datos e inferencia del árbol (sin entrenar en requests).

Dominio y aplicación se prueban con fakes; la integración usa un
pipeline del árbol ajustado OFFLINE una sola vez en el setup (no es
selección ni evaluación: no hay CV, grillas ni test para elegir).
La comparación/selección de #10 no se duplica.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from collection.adapters.datasets.csv_dataset_reader import CsvDatasetReader  # noqa: E402
from collection.adapters.datasets.ml_preparation import prepare_dataset  # noqa: E402
from collection.adapters.datasets.synthetic_complaints import (  # noqa: E402
    complaint_count_for_segment,
)
from collection.adapters.models.model_specs import build_pipeline  # noqa: E402
from collection.adapters.models.pipeline_store import (  # noqa: E402
    DEFAULT_MODEL_ID,
    load_pipeline,
    save_pipeline,
)
from collection.adapters.models.sklearn_predictor import SklearnPredictor  # noqa: E402
from collection.application.use_cases.predict_priorities.use_case import (  # noqa: E402
    PredictPriorities,
)
from collection.application.use_cases.validate_load_dataset.use_case import (  # noqa: E402
    ValidateLoadDataset,
)
from collection import composition  # noqa: E402
from collection.domain.entities.predicted_segment import PredictedSegment  # noqa: E402
from collection.domain.entities.segment_features import SegmentFeatures  # noqa: E402
from collection.domain.errors.invalid_dataset import InvalidDataset  # noqa: E402
from collection.domain.errors.prediction_without_segment import (  # noqa: E402
    PredictionWithoutSegment,
)
from collection.domain.rules.associate_predictions import (  # noqa: E402
    associate_predictions,
)
from collection.domain.rules.validate_segment import (  # noqa: E402
    validate_segment_features,
)

FIXTURES = Path(__file__).resolve().parent / "fixtures"
TRAMOS_CSV = FIXTURES / "tramos.csv"
NODOS_CSV = FIXTURES / "nodos.csv"


def valid_segment(segment_id: str = "T0001") -> SegmentFeatures:
    return SegmentFeatures(
        segment_id=segment_id,
        origin_node="N0001",
        destination_node="N0002",
        length_m=85.5,
        zone_type="residential",
        container_count=1,
        days_since_last_collection=2,
        historic_neighbor_complaints=1,
    )


class FakeReader:
    def __init__(self, nodes: list[dict], segments: list[SegmentFeatures]):
        self.nodes = nodes
        self.segments = segments
        self.calls: list[tuple[str, str]] = []

    def load(self, source: str, schema_version: str):
        self.calls.append((source, schema_version))
        return self.nodes, self.segments


class FakePredictor:
    def __init__(self, model_id: str, priorities: list[str] | None = None):
        self._id = model_id
        self._priorities = priorities
        self.received: list[list[SegmentFeatures]] = []

    @property
    def model_id(self) -> str:
        return self._id

    def predict(self, segments: list[SegmentFeatures]) -> list[PredictedSegment]:
        self.received.append(list(segments))
        wanted = self._priorities if self._priorities is not None else ["low"] * len(segments)
        return [
            PredictedSegment(segment_id=seg.segment_id, priority=prio)  # type: ignore[arg-type]
            for seg, prio in zip(segments, wanted, strict=True)
        ]


def write_tramos(path: Path, rows: list[dict]) -> Path:
    import csv

    columns = [
        "tramo_id", "nodo_origen", "nodo_destino", "longitud_m",
        "tipo_zona", "cantidad_contenedores", "dias_desde_ultima_recoleccion",
    ]
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    return path


def base_row(**overrides: object) -> dict:
    row: dict = {
        "tramo_id": "T1", "nodo_origen": "N1", "nodo_destino": "N2",
        "longitud_m": "10.0", "tipo_zona": "residencial",
        "cantidad_contenedores": "1", "dias_desde_ultima_recoleccion": "2",
    }
    row.update(overrides)
    return row


def test_validate_segment_reports_comprehensible_issues():
    assert validate_segment_features(valid_segment()) == []
    bad = SegmentFeatures("", "N1", "N2", 10.0, "residential", 1, 1, 1)
    assert validate_segment_features(bad) != []
    assert any("tramo_id" in issue for issue in validate_segment_features(bad))
    import dataclasses

    assert validate_segment_features(dataclasses.replace(valid_segment(), length_m=0.0)) != []
    assert validate_segment_features(dataclasses.replace(valid_segment(), container_count=-1)) != []
    assert validate_segment_features(
        dataclasses.replace(valid_segment(), zone_type="rural")  # type: ignore[arg-type]
    ) != []


def test_associate_preserves_order_and_rejects_mismatches():
    out = associate_predictions(["A", "B"], ["low", "high"])
    assert [(p.segment_id, p.priority) for p in out] == [("A", "low"), ("B", "high")]
    with pytest.raises(PredictionWithoutSegment, match="1:1"):
        associate_predictions(["A"], ["low", "high"])
    with pytest.raises(PredictionWithoutSegment, match="duplicado"):
        associate_predictions(["A", "A"], ["low", "low"])
    with pytest.raises(PredictionWithoutSegment, match="inválida"):
        associate_predictions(["A"], ["urgente"])


def test_reader_loads_fixture_dir_with_translation_and_reproducible_complaints():
    before_tramos = hashlib.sha256(TRAMOS_CSV.read_bytes()).digest()
    before_nodos = hashlib.sha256(NODOS_CSV.read_bytes()).digest()
    nodes, segments = CsvDatasetReader().load(str(FIXTURES), "v1")
    assert hashlib.sha256(TRAMOS_CSV.read_bytes()).digest() == before_tramos
    assert hashlib.sha256(NODOS_CSV.read_bytes()).digest() == before_nodos
    assert len(nodes) == 6 and len(segments) == 12
    assert [s.segment_id for s in segments] == [f"T{i:04}" for i in range(1, 13)]
    assert {s.zone_type for s in segments} <= {"residential", "commercial", "industrial"}
    for segment in segments:
        expected = complaint_count_for_segment(
            segment.container_count, seed=0, segment_id=segment.segment_id
        )
        assert segment.historic_neighbor_complaints == expected
    zero = next(s for s in segments if s.segment_id == "T0004")
    assert zero.container_count == 0 and zero.historic_neighbor_complaints == 0
    assert zero.zone_type == "residential"


def test_reader_accepts_single_tramos_file_without_nodes():
    _, segments = CsvDatasetReader().load(str(TRAMOS_CSV), "v1")
    assert len(segments) == 12


def test_reader_rejects_invalid_inputs(tmp_path: Path):
    reader = CsvDatasetReader()
    with pytest.raises(InvalidDataset, match="esquema"):
        reader.load(str(FIXTURES), "v0")
    with pytest.raises(InvalidDataset, match="ilegible"):
        reader.load(str(tmp_path / "ausente"), "v1")
    lonely = tmp_path / "solo_tramos.csv"
    write_tramos(lonely, [base_row()])
    _, single = reader.load(str(lonely), "v1")
    assert len(single) == 1
    with pytest.raises(InvalidDataset, match="ilegible"):
        reader.load(str(tmp_path), "v1")
    bad = tmp_path / "tramos.csv"
    (tmp_path / "nodos.csv").write_text("nodo_id,lon,lat\nN1,0.0,0.0\nN2,1.0,1.0\n", encoding="utf-8")
    write_tramos(bad, [base_row(tramo_id="")])
    with pytest.raises(InvalidDataset, match="vacío"):
        reader.load(str(tmp_path), "v1")
    write_tramos(bad, [base_row(), base_row()])
    with pytest.raises(InvalidDataset, match="duplicado"):
        reader.load(str(tmp_path), "v1")
    write_tramos(bad, [base_row(tipo_zona="rural")])
    with pytest.raises(InvalidDataset, match="tipo_zona"):
        reader.load(str(tmp_path), "v1")
    write_tramos(bad, [base_row(cantidad_contenedores="-1")])
    with pytest.raises(InvalidDataset, match="entero >= 0"):
        reader.load(str(tmp_path), "v1")
    write_tramos(bad, [base_row(longitud_m="0")])
    with pytest.raises(InvalidDataset, match="longitud_m"):
        reader.load(str(tmp_path), "v1")
    write_tramos(bad, [base_row(nodo_origen="NX")])
    with pytest.raises(InvalidDataset, match="inexistente"):
        reader.load(str(tmp_path), "v1")


def test_validate_load_dataset_delegates_without_pandas():
    segments = [valid_segment("A"), valid_segment("B")]
    fake = FakeReader([{"nodo_id": "N1", "lon": 0.0, "lat": 0.0}], segments)
    nodes, out = ValidateLoadDataset(fake).execute("alguna/fuente", "v1")
    assert fake.calls == [("alguna/fuente", "v1")]
    assert out == segments and len(nodes) == 1


def test_predict_priorities_keeps_one_to_one_with_fake():
    segments = [valid_segment("A"), valid_segment("B"), valid_segment("C")]
    use_case = PredictPriorities(FakePredictor("arbol", ["low", "medium", "high"]))
    out = use_case.execute("arbol", segments)
    assert [(p.segment_id, p.priority) for p in out] == [
        ("A", "low"), ("B", "medium"), ("C", "high"),
    ]
    assert use_case.execute("arbol", []) == []


def test_predict_priorities_rejects_bad_model_bad_segments_and_mixed_output():
    segments = [valid_segment("A")]
    with pytest.raises(ValueError, match="desconocido"):
        PredictPriorities(FakePredictor("arbol")).execute("logistica", segments)
    import dataclasses

    bad = dataclasses.replace(valid_segment("A"), container_count=-2)
    with pytest.raises(ValueError, match="cantidad_contenedores"):
        PredictPriorities(FakePredictor("arbol")).execute("arbol", [bad])
    dup = [valid_segment("A"), valid_segment("A")]
    with pytest.raises(ValueError, match="duplicado"):
        PredictPriorities(FakePredictor("arbol")).execute("arbol", dup)

    class ShortPredictor(FakePredictor):
        def predict(self, segs: list[SegmentFeatures]):  # type: ignore[override]
            return super().predict(segs)[:0]

    with pytest.raises(PredictionWithoutSegment, match="1:1"):
        PredictPriorities(ShortPredictor("arbol")).execute("arbol", segments)

    class SwappedPredictor(FakePredictor):
        def predict(self, segs: list[SegmentFeatures]):  # type: ignore[override]
            return [PredictedSegment(segment_id="OTRO", priority="low")]

    with pytest.raises(PredictionWithoutSegment, match="mezclada"):
        PredictPriorities(SwappedPredictor("arbol")).execute("arbol", segments)


def test_sklearn_integration_predicts_without_fit_and_keeps_csvs_intact():
    before_tramos = hashlib.sha256(TRAMOS_CSV.read_bytes()).digest()
    prepared = prepare_dataset(TRAMOS_CSV, seed=0)
    pipeline = build_pipeline("arbol", prepared.preprocessor, seed=0)
    pipeline.fit(prepared.X, prepared.y)  # ajuste OFFLINE del setup, no del request

    def _forbidden_fit(*_args: object, **_kwargs: object):
        raise AssertionError("la inferencia no debe llamar a fit")

    pipeline.fit = _forbidden_fit  # type: ignore[method-assign]
    _, segments = CsvDatasetReader().load(str(FIXTURES), "v1")
    predicted = PredictPriorities(SklearnPredictor("arbol", pipeline)).execute("arbol", segments)
    assert [p.segment_id for p in predicted] == [s.segment_id for s in segments]
    assert {p.priority for p in predicted} <= {"low", "medium", "high"}
    assert hashlib.sha256(TRAMOS_CSV.read_bytes()).digest() == before_tramos


def test_pipeline_store_missing_incompatible_and_roundtrip(tmp_path: Path):
    assert DEFAULT_MODEL_ID == "arbol"
    with pytest.raises(FileNotFoundError, match="no disponible"):
        load_pipeline(tmp_path / "ausente.joblib")
    garbage = tmp_path / "roto.joblib"
    garbage.write_bytes(b"no-es-un-pipeline")
    with pytest.raises(ValueError, match="incompatible"):
        load_pipeline(garbage)
    no_predict = tmp_path / "sin_predict.joblib"
    import joblib

    joblib.dump({"nada": 1}, no_predict)
    with pytest.raises(ValueError, match="incompatible"):
        load_pipeline(no_predict)
    prepared = prepare_dataset(TRAMOS_CSV, seed=0)
    pipeline = build_pipeline("arbol", prepared.preprocessor, seed=0)
    pipeline.fit(prepared.X, prepared.y)
    artifact = save_pipeline(pipeline, tmp_path / "arbol.joblib")
    reloaded = load_pipeline(artifact)
    _, segments = CsvDatasetReader().load(str(FIXTURES), "v1")
    out = SklearnPredictor("arbol", reloaded).predict(segments[:3])
    assert [p.segment_id for p in out] == [s.segment_id for s in segments[:3]]


def test_composition_wires_prediction_without_training_rows():
    prepared = prepare_dataset(TRAMOS_CSV, seed=0)
    pipeline = build_pipeline("arbol", prepared.preprocessor, seed=0)
    pipeline.fit(prepared.X, prepared.y)
    use_case = composition.create_predict_priorities_use_case("arbol", pipeline=pipeline)
    assert isinstance(use_case, PredictPriorities)
    assert use_case.execute("arbol", []) == []
    with pytest.raises(ValueError, match="desconocido"):
        composition.create_predict_priorities_use_case("bosque-magico", pipeline=pipeline)
    with pytest.raises(FileNotFoundError, match="no disponible"):
        composition.create_predict_priorities_use_case(
            "arbol", pipeline_path="backend/artifacts/ausente.joblib"
        )
    assert isinstance(composition.create_validate_load_dataset_use_case(), ValidateLoadDataset)
    assert type(composition.create_plan_route_use_case()).__name__ == "PlanRoute"
