"""Issue #10: same-methodology comparison, no leakage, single test use.

Fast and deterministic (seed 0, real 297-row CSV for the choice test;
tiny synthetic lists for the folds fallback). The CSV on disk is never
rewritten: a sha256 guard covers the end-to-end test.
"""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from collection.adapters.datasets.ml_preparation import prepare_dataset  # noqa: E402
from collection.adapters.models.model_specs import (  # noqa: E402
    MODEL_IDS,
    build_pipeline,
    param_grid_for,
)
from collection.adapters.models.sklearn_evaluator import (  # noqa: E402
    SklearnEvaluator,
    resolve_cv_folds,
)
from collection.adapters.models.sklearn_predictor import SklearnPredictor  # noqa: E402
from collection.application.models.evaluation_protocol import (  # noqa: E402
    EvaluationProtocol,
)
from collection.application.use_cases.compare_models.use_case import (  # noqa: E402
    CompareModels,
)
from collection.domain.entities.segment_features import SegmentFeatures  # noqa: E402

SOURCE = Path(__file__).resolve().parents[2] / "dataset" / "salida" / "tramos.csv"
CONFIGS = ["arbol", "logistica"]


def test_catalog_covers_tree_and_another_course_model_with_small_grids():
    assert "arbol" in MODEL_IDS and len(MODEL_IDS) >= 2
    for model_id in CONFIGS:
        grid = param_grid_for(model_id)
        assert 1 <= len(grid) <= 3
        assert sum(len(values) for values in grid.values()) <= 6
    with pytest.raises(ValueError, match="unknown model_id"):
        build_pipeline("bosque-magico", prepare_dataset(SOURCE, seed=0).preprocessor)


def test_folds_fallback_is_recorded_and_infeasible_case_is_reported():
    pedidos, usados = resolve_cv_folds(["baja"] * 3 + ["media"] * 10 + ["alta"] * 10, 5)
    assert (pedidos, usados) == (5, 3)
    pedidos, usados = resolve_cv_folds(["baja"] * 45 + ["media"] * 56 + ["alta"] * 77, 5)
    assert (pedidos, usados) == (5, 5)
    with pytest.raises(ValueError, match="at least 2 stratified folds"):
        resolve_cv_folds(["baja"] * 1 + ["media"] * 10 + ["alta"] * 10, 5)


def test_same_methodology_both_models_choice_justified_and_csv_untouched():
    before = hashlib.sha256(SOURCE.read_bytes()).digest()
    prepared = prepare_dataset(SOURCE, seed=0)
    assert not hasattr(prepared.preprocessor, "transformers_")

    evaluator = SklearnEvaluator()
    comparison, rows = evaluator.evaluate_preparation(
        prepared, CONFIGS, EvaluationProtocol()
    )

    assert hashlib.sha256(SOURCE.read_bytes()).digest() == before
    # Shared #18 preprocessor is cloned, never fitted outside a fold.
    assert comparison.record["shared_preprocessor_fitted_after_compare"] is False
    assert not hasattr(prepared.preprocessor, "transformers_")

    # Folds: real train has min class 45, so 5 requested -> 5 used.
    assert comparison.record["cv_folds_pedidos"] == 5
    assert comparison.record["cv_folds_usados"] == 5
    assert comparison.record["seed"] == 0
    assert comparison.record["sizes"] == {"train": 178, "validation": 59, "test": 60}

    by_id = {metric.model_id: metric for metric in comparison.metrics}
    assert set(by_id) == set(CONFIGS)
    for metric in comparison.metrics:
        assert metric.cv_folds_requested == 5 and metric.cv_folds_used == 5
        assert metric.n_train == 178 and metric.n_validation == 59
        assert 0.0 <= metric.cv_accuracy_mean <= 1.0
        assert 0.0 <= metric.cv_f1_macro_mean <= 1.0
        assert 0.0 <= metric.validation_accuracy <= 1.0
        assert 0.0 <= metric.validation_f1_macro <= 1.0
        # Legacy aliases mirror validation.
        assert metric.accuracy == metric.validation_accuracy
        assert metric.f1_macro == metric.validation_f1_macro
        # Test is reserved: no test scores before the single final use.
        assert metric.test_accuracy is None and metric.test_f1_macro is None

    # Choice is justified on reserved validation (F1 macro), not on test.
    best_val = max(by_id.values(), key=lambda m: (m.validation_f1_macro, m.validation_accuracy))
    assert comparison.chosen_model_id == best_val.model_id
    assert comparison.best_by_validation == best_val.model_id
    assert comparison.record["choice_rule"].startswith("mayor F1 macro")
    # Baseline is reported and never chosen.
    assert 0.0 <= comparison.baseline_accuracy <= 1.0
    assert comparison.chosen_model_id in CONFIGS
    # Synthetic-data limitations travel with the record.
    assert "sinteticas" in comparison.record["limitations"]

    # Single final test use: only the chosen entry gains test_* scores.
    final = evaluator.evaluate_final_on_test(comparison, rows, EvaluationProtocol())
    for metric in final.metrics:
        if metric.model_id == final.chosen_model_id:
            assert metric.test_accuracy is not None
            assert metric.test_f1_macro is not None
        else:
            assert metric.test_accuracy is None
    assert final.record["test_single_use"]["model_id"] == final.chosen_model_id
    assert final.record["test_single_use"]["n_test"] == 60
    assert hashlib.sha256(SOURCE.read_bytes()).digest() == before


def test_unfitted_pipelines_handle_unseen_zones_without_global_prefit():
    prepared = prepare_dataset(SOURCE, seed=0)
    for model_id in CONFIGS:
        pipeline = build_pipeline(model_id, prepared.preprocessor, seed=0)
        assert not hasattr(pipeline, "classes_")
    evaluator = SklearnEvaluator()
    comparison, rows = evaluator.evaluate_preparation(
        prepared, CONFIGS, EvaluationProtocol()
    )
    assert comparison.record["shared_preprocessor_fitted_after_compare"] is False
    assert not hasattr(prepared.preprocessor, "transformers_")


def test_predictor_maps_english_domain_to_spanish_frame_and_back():
    prepared = prepare_dataset(SOURCE, seed=0)
    pipeline = build_pipeline("arbol", prepared.preprocessor, seed=0)
    train = list(prepared.partitions["train"].indices)
    pipeline.fit(prepared.X.iloc[train], prepared.y.iloc[train])
    predictor = SklearnPredictor("arbol", pipeline)
    segments = [
        SegmentFeatures("T1", "N1", "N2", 10.0, "residential", 0, 0, 0),
        SegmentFeatures("T2", "N1", "N2", 10.0, "commercial", 2, 1, 3),
        SegmentFeatures("T3", "N1", "N2", 10.0, "industrial", 1, 0, 1),
    ]
    predicted = predictor.predict(segments)
    assert [p.segment_id for p in predicted] == ["T1", "T2", "T3"]
    assert {p.priority for p in predicted} <= {"low", "medium", "high"}
    assert predictor.predict([]) == []


def test_use_case_delegates_without_sklearn_or_pandas_in_application():
    application_files = list(
        (Path(__file__).resolve().parents[1] / "src" / "collection" / "application").rglob("*.py")
    )
    assert application_files
    for path in application_files:
        text = path.read_text()
        assert "import pandas" not in text
        assert "import sklearn" not in text
        assert "from sklearn" not in text

    class FakeEvaluator:
        def __init__(self) -> None:
            self.calls = 0

        def evaluate(self, rows: list[dict], configs: list[str], protocol: EvaluationProtocol):  # type: ignore[no-untyped-def]
            self.calls += 1
            return ("comparison", list(rows), list(configs), protocol)

    fake = FakeEvaluator()
    use_case = CompareModels(fake)  # type: ignore[arg-type]
    input_rows = [{"a": 1}]
    result = use_case.execute(input_rows, ["arbol"], EvaluationProtocol())  # type: ignore[arg-type]
    assert fake.calls == 1
    assert result[0] == "comparison"  # type: ignore[index]

    evaluator = SklearnEvaluator()
    with pytest.raises(ValueError, match="at least one model_id"):
        evaluator.evaluate([], [], EvaluationProtocol())
    with pytest.raises(ValueError, match="unknown model_id"):
        evaluator.evaluate([{"_partition": "train"}], ["no-existe"], EvaluationProtocol())
