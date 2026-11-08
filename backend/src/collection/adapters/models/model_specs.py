"""Model spec for the backend: ``arbol`` only.

The backend serves a single model — ``arbol`` (``DecisionTreeClassifier``,
chosen offline in the notebooks). Model comparison (``logistica``, ``knn``,
``svc``, dummy baseline) lives in the notebooks with their own sklearn
code: the backend never compares, never grid-searches and never trains on
request. Inference wraps an already-FITTED pipeline (see
``pipeline_store``).
"""
from __future__ import annotations

from typing import Any

from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import make_pipeline
from sklearn.tree import DecisionTreeClassifier

CATEGORICAL_COLUMN = "tipo_zona"
NUMERIC_COLUMNS = [
    "cantidad_contenedores",
    "dias_desde_ultima_recoleccion",
    "historico_quejas_vecinales",
]

# Small grid for the offline arbol fit (kept here so the artifact
# generation script and the notebooks share the same search space).
PARAM_GRIDS: dict[str, dict[str, list[Any]]] = {
    "arbol": {
        "decisiontreeclassifier__max_depth": [None, 3, 5],
        "decisiontreeclassifier__min_samples_split": [2, 5],
    },
}


def _build_arbol(preprocessor: ColumnTransformer, seed: int):
    return make_pipeline(
        clone(preprocessor),
        DecisionTreeClassifier(random_state=seed),
    )


# Registry: the backend only knows ``arbol``.
_BUILDERS = {
    "arbol": _build_arbol,
}

MODEL_IDS = tuple(_BUILDERS)


def build_pipeline(model_id: str, preprocessor: ColumnTransformer, *, seed: int = 0):
    """Build the UNFITTED full pipeline for ``model_id``.

    Only ``"arbol"`` is supported; anything else raises ``ValueError``
    (the API maps it to ``MODELO_DESCONOCIDO``).
    """
    try:
        build = _BUILDERS[model_id]
    except KeyError:
        raise ValueError(f"unknown model_id: {model_id!r}") from None
    return build(preprocessor, seed)


def param_grid_for(model_id: str) -> dict[str, list[Any]]:
    """Return the small grid for ``model_id`` (a copy)."""
    try:
        grid = PARAM_GRIDS[model_id]
    except KeyError:
        raise ValueError(f"unknown model_id: {model_id!r}") from None
    return {key: list(values) for key, values in grid.items()}
