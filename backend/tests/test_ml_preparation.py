from __future__ import annotations

import hashlib
import sys
from pathlib import Path
from typing import cast

import pandas as pd
import pytest
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import KFold, cross_validate
from sklearn.pipeline import make_pipeline

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from collection.adapters.datasets.ml_preparation import (  # noqa: E402
    FEATURE_COLUMNS,
    prepare_dataset,
)
from collection.adapters.datasets.synthetic_complaints import (  # noqa: E402
    draw_container_complaints,
)


def fixture_rows() -> pd.DataFrame:
    rows = []
    zones = ["residencial", "comercial", "industrial"]
    for index in range(30):
        rows.append(
            {
                "tramo_id": f"T{index:03}",
                "tipo_zona": zones[index % len(zones)],
                "cantidad_contenedores": index % 4,
                "dias_desde_ultima_recoleccion": (index // 4) % 4,
                "prioridad_recoleccion": "media",
            }
        )
    return pd.DataFrame(rows)


def test_preparation_has_aligned_identifiers_labels_and_excludes_identifier_and_label():
    prepared = prepare_dataset(fixture_rows(), seed=7)
    assert list(prepared.X.columns) == list(FEATURE_COLUMNS)
    assert "tramo_id" not in prepared.X
    assert "prioridad_recoleccion" not in prepared.X
    assert prepared.X.index.equals(prepared.y.index)
    assert prepared.tramo_ids.tolist() == fixture_rows()["tramo_id"].tolist()
    assert prepared.y.tolist() == prepared.enriched["prioridad_recoleccion"].tolist()
    for row in prepared.enriched.to_dict(orient="records"):
        expected = sum(
            draw_container_complaints(
                int(row["cantidad_contenedores"]),
                seed=7,
                segment_id=str(row["tramo_id"]),
            )
        )
        assert row["historico_quejas_vecinales"] == expected
    zero_container = prepared.enriched.loc[
        prepared.enriched["cantidad_contenedores"] == 0,
        "historico_quejas_vecinales",
    ]
    assert (zero_container == 0).all()


def test_numeric_strings_are_converted_to_numeric_features_without_mutating_input():
    data = fixture_rows()
    data["cantidad_contenedores"] = data["cantidad_contenedores"].map(
        lambda value: f"{value}.0"
    )
    data["dias_desde_ultima_recoleccion"] = data[
        "dias_desde_ultima_recoleccion"
    ].astype(str)
    original = data.copy(deep=True)

    prepared = prepare_dataset(data)

    for column in ("cantidad_contenedores", "dias_desde_ultima_recoleccion"):
        assert pd.api.types.is_numeric_dtype(prepared.X[column])
        assert prepared.X[column].tolist() == fixture_rows()[column].tolist()
    pd.testing.assert_frame_equal(data, original)


def test_splits_are_disjoint_exhaustive_stable_and_stratified_when_feasible():
    data = fixture_rows()
    data = pd.concat([data] * 4, ignore_index=True)
    data["tramo_id"] = [f"S{index:03}" for index in range(len(data))]
    data["cantidad_contenedores"] = [0] * 60 + [0] * 30 + [3] * 30
    data["dias_desde_ultima_recoleccion"] = [0] * 60 + [2] * 30 + [3] * 30
    data["tipo_zona"] = "residencial"
    one = prepare_dataset(data, seed=11)
    two = prepare_dataset(data, seed=11)
    assert one.enriched.equals(two.enriched)
    memberships = [set(part.indices) for part in one.partitions.values()]
    assert not memberships[0] & memberships[1]
    assert not memberships[0] & memberships[2]
    assert not memberships[1] & memberships[2]
    assert set.union(*memberships) == set(range(len(data)))
    assert {name: part.indices for name, part in one.partitions.items()} == {
        name: part.indices for name, part in two.partitions.items()
    }
    assert one.metadata["stratified"] is True
    assert [len(one.partitions[name].indices) for name in ("train", "validation", "test")] == [72, 24, 24]
    assert one.metadata["seed"] == 11
    assert all("class_distribution" in part.metadata for part in one.partitions.values())
    assert all("tramo_ids" in part.metadata for part in one.partitions.values())


def test_encoder_ignores_category_unknown_to_its_training_partition():
    prepared = prepare_dataset(fixture_rows(), seed=7)
    train = prepared.X.iloc[list(prepared.partitions["train"].indices)].copy()
    train["tipo_zona"] = "residencial"
    validation = prepared.X.iloc[list(prepared.partitions["validation"].indices)].copy()
    validation["tipo_zona"] = "comercial"
    transformer = cast(ColumnTransformer, clone(prepared.preprocessor))
    transformer.fit(train)
    transformed_unknown = transformer.transform(validation)
    assert len(transformer.named_transformers_["zona"].categories_[0]) == 1
    assert (transformed_unknown[:, :1] == 0).all()
    assert not hasattr(prepared.preprocessor, "transformers_")


def test_preprocessor_fits_only_on_training_rows_and_is_usable_inside_cv():
    data = fixture_rows()
    data["tipo_zona"] = ["industrial" if i == 29 else "residencial" for i in range(30)]
    prepared = prepare_dataset(data, seed=5)
    train_idx = [
        index for index in prepared.partitions["train"].indices if index != 29
    ]
    validation_idx = [29]
    pipeline = make_pipeline(clone(prepared.preprocessor))
    pipeline.fit(prepared.X.iloc[train_idx], prepared.y.iloc[train_idx])
    encoder = pipeline.named_steps["columntransformer"].named_transformers_["zona"]
    assert "industrial" not in encoder.categories_[0]
    assert (pipeline.named_steps["columntransformer"].transform(
        prepared.X.iloc[validation_idx]
    )[:, :1] == 0).all()
    assert not hasattr(prepared.preprocessor, "transformers_")

    # Example contract: clone the unfitted preprocessing-plus-placeholder pipeline
    # inside CV, on isolated fixture rows; no real model is selected or delivered.
    from sklearn.dummy import DummyClassifier

    cv_pipeline = make_pipeline(prepared.preprocessor, DummyClassifier())
    scores = cross_validate(
        cv_pipeline,
        prepared.X.iloc[train_idx],
        prepared.y.iloc[train_idx],
        cv=KFold(n_splits=2, shuffle=True, random_state=0),
        scoring="accuracy",
    )
    assert len(scores["test_score"]) == 2
    assert not hasattr(prepared.preprocessor, "transformers_")


def test_invalid_missing_duplicate_and_unknown_category_inputs_are_reported():
    with pytest.raises(ValueError, match="missing required columns"):
        prepare_dataset(pd.DataFrame({"tramo_id": ["a"]}))
    missing = fixture_rows()
    missing.loc[0, "dias_desde_ultima_recoleccion"] = None
    with pytest.raises(ValueError, match="missing values"):
        prepare_dataset(missing)
    duplicate = fixture_rows()
    duplicate.loc[1, "tramo_id"] = duplicate.loc[0, "tramo_id"]
    with pytest.raises(ValueError, match="unique"):
        prepare_dataset(duplicate)
    unknown = fixture_rows()
    unknown.loc[0, "tipo_zona"] = "suburbana"
    with pytest.raises(ValueError, match="tipo_zona"):
        prepare_dataset(unknown)
    negative = fixture_rows()
    negative.loc[0, "cantidad_contenedores"] = -1
    with pytest.raises(ValueError, match="non-negative"):
        prepare_dataset(negative)


def test_real_dataset_distribution_is_reported_and_source_bytes_are_unchanged():
    source = Path(__file__).resolve().parents[2] / "dataset" / "salida" / "tramos.csv"
    before = hashlib.sha256(source.read_bytes()).digest()
    prepared = prepare_dataset(source, seed=0)
    assert hashlib.sha256(source.read_bytes()).digest() == before
    assert len(prepared.enriched) == 297
    assert prepared.metadata["class_distribution"] == {
        "baja": 129,
        "media": 93,
        "alta": 75,
    }
    assert prepared.metadata["stratified"] is True
    assert prepared.metadata["sizes"] == {"train": 178, "validation": 59, "test": 60}


def test_source_csv_bytes_remain_unchanged_and_old_and_new_labels_are_distinguished(tmp_path):
    source = tmp_path / "tramos.csv"
    fixture_rows().to_csv(source, index=False)
    before = hashlib.sha256(source.read_bytes()).digest()
    prepared = prepare_dataset(source, seed=0)
    assert hashlib.sha256(source.read_bytes()).digest() == before
    assert "prioridad_recoleccion_original" in prepared.enriched
    assert "prioridad_recoleccion" in prepared.enriched
    assert prepared.metadata["label_status"] == "synthetic"
    assert prepared.metadata["class_distribution"] == prepared.enriched[
        "prioridad_recoleccion"
    ].value_counts().to_dict()
