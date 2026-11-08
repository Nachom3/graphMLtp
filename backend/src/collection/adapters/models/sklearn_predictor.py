"""Sklearn predictor for issue #10 (adapter; sklearn lives here).

Wraps a FITTED pipeline produced from the validated ``best_params``. It
translates the English domain entity (``residential/commercial/
industrial`` + ``low/medium/high``) to/from the Spanish training frame
(``residencial/comercial/industrial`` + ``baja/media/alta``). That
ES<->EN mapping is a known interface bug class in this repo (dataset and
contracts predate the English domain): it is handled explicitly here and
covered by a test, instead of leaking Spanish strings into the domain.

Inference never trains: the pipeline arrives already fitted on train.
"""
from __future__ import annotations

from collections.abc import Iterable

import pandas as pd

from ...domain.entities.predicted_segment import PredictedSegment
from ...domain.entities.segment_features import SegmentFeatures

_ZONE_TO_ES = {
    "residential": "residencial",
    "commercial": "comercial",
    "industrial": "industrial",
}
_LABEL_TO_EN = {"baja": "low", "media": "medium", "alta": "high"}

# Pesos de la regla sintética #18 (duplican synthetic_complaints sin
# importar el adapter de datasets desde el adapter de modelos).
_EXPLAIN_DAYS_WEIGHT = 2
_EXPLAIN_CONTAINERS_WEIGHT = 1
_EXPLAIN_ZONE_WEIGHTS = {"residential": 0, "industrial": 1, "commercial": 2}
_EXPLAIN_COMPLAINT_WEIGHT = 2


class SklearnPredictor:
    """Thin inference wrapper around a fitted #10 pipeline."""

    def __init__(self, model_id: str, pipeline: object) -> None:
        self._id = model_id
        self._pipeline = pipeline

    @property
    def model_id(self) -> str:
        return self._id

    @property
    def pipeline(self) -> object:
        return self._pipeline

    def predict(self, segments: list[SegmentFeatures]) -> list[PredictedSegment]:
        """Predict one English priority per segment, in input order."""
        if not segments:
            return []
        rows = [
            {
                "cantidad_contenedores": seg.container_count,
                "dias_desde_ultima_recoleccion": seg.days_since_last_collection,
                "tipo_zona": _ZONE_TO_ES[seg.zone_type],
                "historico_quejas_vecinales": seg.historic_neighbor_complaints,
            }
            for seg in segments
        ]
        frame = pd.DataFrame(
            rows,
            columns=[
                "cantidad_contenedores",
                "dias_desde_ultima_recoleccion",
                "tipo_zona",
                "historico_quejas_vecinales",
            ],
        )
        labels = self._pipeline.predict(frame)  # type: ignore[union-attr]
        return [
            PredictedSegment(
                segment_id=seg.segment_id,
                priority=_LABEL_TO_EN[str(label)],  # type: ignore[literal-required]
            )
            for seg, label in zip(segments, labels, strict=True)
        ]

    def explain(self, segment: SegmentFeatures) -> dict:
        """Explain one prediction: rule score + tree decision path.

        Returns ``{"segment_id", "priority", "score", "path"}`` where
        ``score`` mirrors the synthetic #18 breakdown and ``path`` lists
        the tree nodes traversed (feature, threshold, value, direction).
        Only decision trees are supported; other estimators raise
        ``ValueError`` (the transport maps it to ``EXPLAIN_UNSUPPORTED``).
        """
        predicted = self.predict([segment])[0]
        score = {
            "days_weighted": _EXPLAIN_DAYS_WEIGHT * segment.days_since_last_collection,
            "containers_weighted": _EXPLAIN_CONTAINERS_WEIGHT * segment.container_count,
            "zone_w": _EXPLAIN_ZONE_WEIGHTS[segment.zone_type],
            "complaints_weighted": _EXPLAIN_COMPLAINT_WEIGHT
            * segment.historic_neighbor_complaints,
        }
        total = (
            score["days_weighted"]
            + score["containers_weighted"]
            + score["zone_w"]
            + score["complaints_weighted"]
        )
        return {
            "segment_id": segment.segment_id,
            "priority": predicted.priority,
            "score": {**score, "total": total},
            "path": self._decision_path(segment),
        }

    def _decision_path(self, segment: SegmentFeatures) -> list[dict]:
        """Return the tree nodes traversed for ``segment``."""
        pipeline = self._pipeline
        steps = getattr(pipeline, "steps", None)
        if not steps:
            raise ValueError("explicación no disponible: el pipeline no es inspeccionable")
        preprocessor, estimator = steps[-2][1], steps[-1][1]
        tree = getattr(estimator, "tree_", None)
        if tree is None:
            raise ValueError(
                f"explicación no disponible: {type(estimator).__name__} no es un árbol"
            )
        frame = pd.DataFrame(
            [
                {
                    "cantidad_contenedores": segment.container_count,
                    "dias_desde_ultima_recoleccion": segment.days_since_last_collection,
                    "tipo_zona": _ZONE_TO_ES[segment.zone_type],
                    "historico_quejas_vecinales": segment.historic_neighbor_complaints,
                }
            ],
            columns=[
                "cantidad_contenedores",
                "dias_desde_ultima_recoleccion",
                "tipo_zona",
                "historico_quejas_vecinales",
            ],
        )
        matrix = preprocessor.transform(frame)
        feature_names = self._feature_names(preprocessor, matrix.shape[1])
        node_path = estimator.decision_path(matrix).indices
        path: list[dict] = []
        for node_id in node_path:
            feature_id = tree.feature[node_id]
            if feature_id < 0:
                path.append({"node": int(node_id), "leaf": True})
                continue
            threshold = float(tree.threshold[node_id])
            value = float(matrix[0, feature_id])
            path.append(
                {
                    "node": int(node_id),
                    "feature": feature_names[feature_id],
                    "threshold": threshold,
                    "value": value,
                    "direction": "izquierda (<=)" if value <= threshold else "derecha (>)",
                }
            )
        return path

    @staticmethod
    def _feature_names(preprocessor: object, n_features: int) -> list[str]:
        """Best-effort transformed feature names for the tree path."""
        get_names = getattr(preprocessor, "get_feature_names_out", None)
        if callable(get_names):
            names = get_names()
            if isinstance(names, Iterable):
                return [str(name) for name in names]
        return [f"feature_{i}" for i in range(n_features)]
