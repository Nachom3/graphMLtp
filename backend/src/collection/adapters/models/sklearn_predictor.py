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

import pandas as pd

from ...domain.entities.predicted_segment import PredictedSegment
from ...domain.entities.segment_features import SegmentFeatures

_ZONE_TO_ES = {
    "residential": "residencial",
    "commercial": "comercial",
    "industrial": "industrial",
}
_LABEL_TO_EN = {"baja": "low", "media": "medium", "alta": "high"}


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
