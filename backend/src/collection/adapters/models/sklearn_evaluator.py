"""Sklearn comparison for issue #10 (adapter; sklearn lives here).

Methodology (ticket #10 + course sesion 5):

- Consume the #18 partitions (60% train / 20% validation / 20% test,
  seed 0). Never re-split, never fit on validation or test.
- Stratified CV strictly inside train. Request ``protocol`` folds (5);
  when the least-frequent train class has fewer examples, reduce to that
  count and record ``cv_folds_pedidos`` / ``cv_folds_usados``. Below 2
  stratified folds is infeasible: raise ``ValueError`` informing it.
- ``GridSearchCV`` with the small catalog grid, always inside train.
  Contrast the refit winners on reserved validation, choose by F1 macro
  (tie-break: accuracy, then config order). The dummy-majority baseline
  is reported, never chosen.
- Test is touched exactly once, at the end, only for the chosen model.

Anti-leakage: every ``cross_validate`` / ``GridSearchCV`` receives the
complete UNFITTED pipeline from ``make_pipeline`` (preprocessing +
classifier), so each fold fits its transformations only on its train
fold. The shared #18 ``preprocessor`` object is always cloned and is
never fitted outside a fold (a test asserts ``transformers_`` stays
absent afterwards).

Port bridging: ``evaluate(rows, configs, protocol)`` keeps the
application-port signature. Each row is an enriched record plus a
``_partition`` key in {"train", "validation", "test"} so the #18 split
travels across the app/adapter boundary without pandas in application.
``evaluate_preparation`` is the adapter-side convenience that serializes
an ``MLPreparation`` into those rows and delegates (no preparation
logic is duplicated: rule, seed, split and preprocessor all come from
#18).
"""
from __future__ import annotations

from typing import Any

import pandas as pd
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import GridSearchCV, KFold, StratifiedKFold, cross_validate
from sklearn.pipeline import make_pipeline

from ...application.models.evaluation_protocol import EvaluationProtocol
from ...application.models.model_comparison import ModelComparison
from ...application.models.model_metrics import ModelMetrics
from .cv_policy import resolve_cv_folds, resolve_plain_folds
from .framing import LABEL_COLUMN, PARTITIONS, frame_from_rows, split_xy
from .metrics import CLASS_LABELS, validation_scores
from .model_specs import MODEL_IDS, build_pipeline, param_grid_for

# Canonical impls live in framing.py / metrics.py; aliases keep call sites readable.
_frame_from_rows = frame_from_rows
_split_xy = split_xy
_validation_scores = validation_scores

_SYNTHETIC_LIMITATIONS = (
    "Variables y etiqueta sinteticas: historico_quejas_vecinales son sorteos "
    "anonimos [0,3] por contenedor sumados por tramo (cero si no hay "
    "contenedores); tipo_zona es simulada; prioridad_recoleccion se construye "
    "con score=2*dias+contenedores+zona_w+2*quejas (baja<=0, media 1..2, "
    "alta>2). Las metricas miden ajuste a esa regla, no desempeno operativo."
)


# resolve_cv_folds / resolve_plain_folds live in cv_policy.py (re-exported above).
# frame_from_rows / split_xy live in framing.py (aliased above).


class SklearnEvaluator:
    """Compare course classifiers on #18 partitions without leakage."""

    def evaluate(
        self,
        rows: list[dict],
        configs: list[str],
        protocol: EvaluationProtocol,
    ) -> ModelComparison:
        """Run CV + GridSearchCV inside train, contrast on validation.

        Test handling: this method never reads the ``test`` partition. Use
        :meth:`evaluate_final_on_test` once, afterwards, for the single
        final test evaluation of the chosen model.
        """
        if not configs:
            raise ValueError("configs must list at least one model_id")
        unknown = [model for model in configs if model not in MODEL_IDS]
        if unknown:
            raise ValueError(f"unknown model_id(s): {unknown}")
        if len(set(configs)) != len(configs):
            raise ValueError("configs must not repeat model_id values")

        frame = _frame_from_rows(rows)
        X_train, y_train = _split_xy(frame, "train")
        X_validation, y_validation = _split_xy(frame, "validation")
        if len(X_train) == 0 or len(X_validation) == 0:
            raise ValueError("train and validation partitions must be non-empty")

        requested = protocol.requested_folds()
        if protocol.stratified:
            pedidos, usados = resolve_cv_folds(y_train.tolist(), requested)
            cv_strategy = "StratifiedKFold(shuffle=True) dentro de train"
        else:
            pedidos, usados = resolve_plain_folds(len(X_train), requested)
            cv_strategy = (
                "KFold(shuffle=True) dentro de train "
                "(stratified=False pedido explicito)"
            )

        def _make_cv() -> Any:
            if protocol.stratified:
                return StratifiedKFold(
                    n_splits=usados, shuffle=True, random_state=protocol.seed
                )
            return KFold(n_splits=usados, shuffle=True, random_state=protocol.seed)

        cv = _make_cv()

        preprocessor = self._preprocessor_from_rows(frame)
        metrics: list[ModelMetrics] = []
        search_details: dict[str, Any] = {}
        for model_id in configs:
            pipeline = build_pipeline(model_id, preprocessor, seed=protocol.seed)  # type: ignore[arg-type]
            grid = param_grid_for(model_id)
            cv_scores = cross_validate(
                clone(pipeline),
                X_train,
                y_train,
                cv=cv,
                scoring=["accuracy", "f1_macro"],
            )
            search = GridSearchCV(
                clone(pipeline),
                grid,
                cv=_make_cv(),
                scoring="f1_macro",
                refit=True,
            )
            search.fit(X_train, y_train)
            best = search.best_estimator_
            val_pred = best.predict(X_validation)
            val = _validation_scores(y_validation, val_pred)
            entry = ModelMetrics(
                model_id=model_id,
                cv_accuracy_mean=float(cv_scores["test_accuracy"].mean()),
                cv_accuracy_std=float(cv_scores["test_accuracy"].std()),
                cv_f1_macro_mean=float(cv_scores["test_f1_macro"].mean()),
                cv_f1_macro_std=float(cv_scores["test_f1_macro"].std()),
                cv_folds_requested=pedidos,
                cv_folds_used=usados,
                best_params=dict(search.best_params_),
                validation_accuracy=val["accuracy"],
                validation_precision_macro=val["precision_macro"],
                validation_recall_macro=val["recall_macro"],
                validation_f1_macro=val["f1_macro"],
                validation_confusion_matrix=val["confusion_matrix"],
                n_train=int(len(X_train)),
                n_validation=int(len(X_validation)),
                n_test=int((frame["_partition"] == "test").sum()),
            ).with_legacy_aliases()
            metrics.append(entry)
            search_details[model_id] = {
                "best_params": dict(search.best_params_),
                "best_cv_f1_macro": float(search.best_score_),
                "cv_accuracy_mean": entry.cv_accuracy_mean,
                "cv_f1_macro_mean": entry.cv_f1_macro_mean,
            }

        baseline = self._baseline_scores(frame, preprocessor, cv)
        best_by_validation = self._choose(metrics)
        best_by_cv = max(
            metrics, key=lambda m: (m.cv_f1_macro_mean, m.cv_accuracy_mean)
        ).model_id
        record = self._record(
            frame=frame,
            protocol=protocol,
            pedidos=pedidos,
            usados=usados,
            configs=configs,
            search_details=search_details,
            metrics=metrics,
            baseline=baseline,
            best_by_validation=best_by_validation,
            best_by_cv=best_by_cv,
            preprocessor_fitted=self._preprocessor_was_fitted(preprocessor),
            cv_strategy=cv_strategy,
        )
        return ModelComparison(
            metrics=tuple(metrics),
            baseline_accuracy=baseline["accuracy"],
            baseline_f1_macro=baseline["f1_macro"],
            best_by_cv=best_by_cv,
            best_by_validation=best_by_validation,
            chosen_model_id=best_by_validation,
            record=record,
        )

    def evaluate_final_on_test(
        self,
        comparison: ModelComparison,
        rows: list[dict],
        protocol: EvaluationProtocol,
    ) -> ModelComparison:
        """Evaluate the chosen model a single time on reserved test.

        Rebuilds the winner pipeline with its validated ``best_params``,
        refits on train only (course cell 16: ``fit(X_train, y_train)``),
        and predicts test exactly once. Every other metric keeps its
        validation value; only the chosen entry gains ``test_*`` scores.
        """
        frame = _frame_from_rows(rows)
        X_train, y_train = _split_xy(frame, "train")
        X_test, y_test = _split_xy(frame, "test")
        if len(X_test) == 0:
            raise ValueError("test partition must be non-empty")
        chosen = comparison.chosen_model_id or comparison.best_by_validation
        params = next(m.best_params for m in comparison.metrics if m.model_id == chosen)
        preprocessor = self._preprocessor_from_rows(frame)
        pipeline = build_pipeline(chosen, preprocessor, seed=protocol.seed)  # type: ignore[arg-type]
        pipeline.set_params(**params)
        pipeline.fit(X_train, y_train)
        test_pred = pipeline.predict(X_test)
        test = _validation_scores(y_test, test_pred)

        updated: list[ModelMetrics] = []
        for entry in comparison.metrics:
            if entry.model_id != chosen:
                updated.append(entry)
                continue
            import dataclasses

            updated.append(
                dataclasses.replace(
                    entry,
                    test_accuracy=test["accuracy"],
                    test_precision_macro=test["precision_macro"],
                    test_recall_macro=test["recall_macro"],
                    test_f1_macro=test["f1_macro"],
                    test_confusion_matrix=test["confusion_matrix"],
                )
            )
        record = dict(comparison.record)
        record["test_single_use"] = {
            "model_id": chosen,
            "n_test": int(len(X_test)),
            "accuracy": test["accuracy"],
            "f1_macro": test["f1_macro"],
            "label_order": list(CLASS_LABELS),
            "note": "test usado una sola vez al final; no se volvio a ajustar ninguna decision con este resultado",
        }
        import dataclasses

        return dataclasses.replace(
            comparison, metrics=tuple(updated), record=record
        )

    def evaluate_preparation(
        self,
        prepared: Any,
        configs: list[str],
        protocol: EvaluationProtocol,
    ) -> tuple[ModelComparison, list[dict]]:
        """Serialize an #18 ``MLPreparation`` into port rows and compare.

        Returns (comparison_without_test, rows) so the caller can later
        invoke ``evaluate_final_on_test`` exactly once. ``prepared`` stays
        adapter-side; only plain rows cross toward the port signature.
        """
        partitions = prepared.partitions
        enriched = prepared.enriched
        rows: list[dict] = []
        for name in PARTITIONS:
            for position in partitions[name].indices:
                record = dict(enriched.iloc[int(position)].to_dict())
                record["_partition"] = name
                rows.append(record)
        comparison = self.evaluate(rows, configs, protocol)
        # Attach the shared preprocessor identity for the caller to reuse the
        # exact #18 object when rebuilding (cloned inside the evaluator).
        self._last_preprocessor = prepared.preprocessor
        return comparison, rows

    # -- internals -----------------------------------------------------

    def _preprocessor_from_rows(self, frame: pd.DataFrame):  # type: ignore[no-untyped-def]
        last = getattr(self, "_last_preprocessor", None)
        if last is not None:
            return clone(last)
        # Fallback when only raw rows arrive: rebuild the exact #18 spec
        # (OneHot ignore + numeric passthrough). Never fitted here.
        from sklearn.compose import ColumnTransformer
        from sklearn.preprocessing import OneHotEncoder

        return ColumnTransformer(
            transformers=[
                ("zona", OneHotEncoder(handle_unknown="ignore"), ["tipo_zona"]),
                (
                    "numericas",
                    "passthrough",
                    [
                        "cantidad_contenedores",
                        "dias_desde_ultima_recoleccion",
                        "historico_quejas_vecinales",
                    ],
                ),
            ],
            remainder="drop",
        )

    @staticmethod
    def _preprocessor_was_fitted(preprocessor: Any) -> bool:
        return hasattr(preprocessor, "transformers_")

    def _baseline_scores(self, frame: pd.DataFrame, preprocessor: Any, cv: Any) -> dict[str, Any]:
        X_train, y_train = _split_xy(frame, "train")
        X_validation, y_validation = _split_xy(frame, "validation")
        pipe = make_pipeline(clone(preprocessor), DummyClassifier(strategy="most_frequent"))
        scores = cross_validate(
            clone(pipe), X_train, y_train, cv=cv, scoring=["accuracy", "f1_macro"]
        )
        pipe.fit(X_train, y_train)
        val = _validation_scores(y_validation, pipe.predict(X_validation))
        return {
            "accuracy": val["accuracy"],
            "f1_macro": val["f1_macro"],
            "cv_accuracy_mean": float(scores["test_accuracy"].mean()),
            "cv_f1_macro_mean": float(scores["test_f1_macro"].mean()),
            "strategy": "most_frequent",
        }

    @staticmethod
    def _choose(metrics: list[ModelMetrics]) -> str:
        return max(
            metrics,
            key=lambda m: (
                m.validation_f1_macro,
                m.validation_accuracy,
                -MODEL_IDS.index(m.model_id),
            ),
        ).model_id

    def _record(
        self,
        *,
        frame: pd.DataFrame,
        protocol: EvaluationProtocol,
        pedidos: int,
        usados: int,
        configs: list[str],
        search_details: dict[str, Any],
        metrics: list[ModelMetrics],
        baseline: dict[str, Any],
        best_by_validation: str,
        best_by_cv: str,
        preprocessor_fitted: bool,
        cv_strategy: str,
    ) -> dict[str, Any]:
        sizes = {
            name: int((frame["_partition"] == name).sum()) for name in PARTITIONS
        }
        distributions = {
            name: {
                label: int(
                    ((frame["_partition"] == name) & (frame[LABEL_COLUMN] == label)).sum()
                )
                for label in CLASS_LABELS
            }
            for name in PARTITIONS
        }
        return {
            "seed": protocol.seed,
            "partitions": "60/20/20 de #18 (train/validation/test); CV solo dentro de train",
            "sizes": sizes,
            "class_distribution": {
                name: {k: v for k, v in dist.items() if v}
                for name, dist in distributions.items()
            },
            "cv_folds_pedidos": pedidos,
            "cv_folds_usados": usados,
            "cv_strategy": cv_strategy,
            "configs": list(configs),
            "grids": {model: dict(param_grid_for(model)) for model in configs},
            "search": search_details,
            "validation_scores": {
                m.model_id: {
                    "accuracy": m.validation_accuracy,
                    "f1_macro": m.validation_f1_macro,
                }
                for m in metrics
            },
            "baseline": baseline,
            "best_by_cv": best_by_cv,
            "best_by_validation": best_by_validation,
            "chosen_model_id": best_by_validation,
            "choice_rule": "mayor F1 macro en validacion; desempate por accuracy y orden de configs",
            "shared_preprocessor_fitted_after_compare": preprocessor_fitted,
            "label_rule": "score=2*dias+contenedores+zona_w+2*quejas; baja<=0, media 1..2, alta>2",
            "limitations": _SYNTHETIC_LIMITATIONS,
        }
