"""Model catalog for issue #10 (adapter; sklearn lives here, never in app).

Four course models, same methodology seed and partitions for all:

- ``arbol``: ``DecisionTreeClassifier`` (sesion 4, ``notebook-1``) without
  scaling. The tree can represent the synthetic rule directly, so it is
  the expected winner; the comparison still has to earn that on
  validation, never on test.
- ``logistica``: ``LogisticRegression`` multiclase (sesion 3,
  ``notebook-2``; sesion 5 ``notebook-1`` cell 9 and ``notebook-2``
  cell 28) with ``StandardScaler`` on the numeric columns only, inside
  the same ``make_pipeline`` object (sesion 4 ``notebook-2`` cells
  37-38; sesion 5 cells 26-27: everything that learns from data goes
  inside the pipeline so each fold fits only on its own train).
- ``knn``: ``KNeighborsClassifier`` (sesion 4, curso) with the same scaled
  preprocessor (distances need scaling). Small grid on ``n_neighbors``.
- ``svc``: ``SVC`` RBF (sesion 4, curso) with the same scaled preprocessor.
  Small grid on ``C`` (kernel fijo para mantener la grilla pequena).

All pipelines are built UNFITTED via ``make_pipeline`` and handed to
``cross_validate`` / ``GridSearchCV`` that way; each fold fits its own
transformations exclusively from its train fold (anti-leakage). The
categorical branch always uses ``OneHotEncoder(handle_unknown="ignore")``
so zones unseen in a fold map to zeros instead of raising.
"""
from __future__ import annotations

from typing import Any

from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

CATEGORICAL_COLUMN = "tipo_zona"
NUMERIC_COLUMNS = [
    "cantidad_contenedores",
    "dias_desde_ultima_recoleccion",
    "historico_quejas_vecinales",
]

MODEL_IDS = ("arbol", "logistica", "knn", "svc")

# Small grids (issue #10: "grilla pequena" inside train only).
PARAM_GRIDS: dict[str, dict[str, list[Any]]] = {
    "arbol": {
        "decisiontreeclassifier__max_depth": [None, 3, 5],
        "decisiontreeclassifier__min_samples_split": [2, 5],
    },
    "logistica": {
        "logisticregression__C": [0.5, 1.0, 2.0],
    },
    "knn": {
        "kneighborsclassifier__n_neighbors": [3, 5, 7],
    },
    "svc": {
        "svc__C": [0.5, 1.0],
    },
}


def _scaled_preprocessor() -> ColumnTransformer:
    """Preprocessor twin of #18 with StandardScaler on numerics only."""
    return ColumnTransformer(
        transformers=[
            (
                "zona",
                OneHotEncoder(handle_unknown="ignore"),
                [CATEGORICAL_COLUMN],
            ),
            ("numericas", StandardScaler(), list(NUMERIC_COLUMNS)),
        ],
        remainder="drop",
    )


def build_pipeline(model_id: str, preprocessor: ColumnTransformer, *, seed: int = 0):
    """Build the UNFITTED full pipeline for ``model_id``.

    ``preprocessor`` is the UNFITTED #18 transformer; it is cloned, never
    fitted here. Raises ``ValueError`` for unknown ids (API maps this to
    ``MODELO_DESCONOCIDO``).
    """
    if model_id == "arbol":
        return make_pipeline(
            clone(preprocessor),
            DecisionTreeClassifier(random_state=seed),
        )
    if model_id == "logistica":
        return make_pipeline(
            _scaled_preprocessor(),
            LogisticRegression(max_iter=2000, random_state=seed),
        )
    if model_id == "knn":
        return make_pipeline(
            _scaled_preprocessor(),
            KNeighborsClassifier(),
        )
    if model_id == "svc":
        return make_pipeline(
            _scaled_preprocessor(),
            SVC(kernel="rbf", random_state=seed),
        )
    raise ValueError(f"unknown model_id: {model_id!r}")


def build_baseline_pipeline(preprocessor: ColumnTransformer):
    """Dummy majority baseline with the plain #18 preprocessor (unfitted)."""
    return make_pipeline(
        clone(preprocessor),
        DummyClassifier(strategy="most_frequent"),
    )


def param_grid_for(model_id: str) -> dict[str, list[Any]]:
    """Return the small GridSearchCV grid for ``model_id`` (a copy)."""
    try:
        grid = PARAM_GRIDS[model_id]
    except KeyError:
        raise ValueError(f"unknown model_id: {model_id!r}") from None
    return {key: list(values) for key, values in grid.items()}
