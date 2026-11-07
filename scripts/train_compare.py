"""Reproducible comparison for issue #10 (thin entry point, no logic here).

Uses the #18 preparation as-is (``prepare_dataset(source, seed=0)``),
compares ``arbol`` vs ``logistica`` with the same methodology, contrasts
on reserved validation, and evaluates the winner a single time on test.
The CSV is only read. All science lives in
``collection.adapters.models``; this script only wires and prints.

Usage (from repo root)::

    python scripts/train_compare.py
    python scripts/train_compare.py --source dataset/salida/tramos.csv --seed 0
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "src"))

from collection.adapters.datasets.ml_preparation import prepare_dataset
from collection.adapters.models.sklearn_evaluator import SklearnEvaluator
from collection.application.models.evaluation_protocol import EvaluationProtocol

CONFIGS = ["arbol", "logistica"]


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare #10 classifiers (seed 0).")
    parser.add_argument("--source", default="dataset/salida/tramos.csv")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    prepared = prepare_dataset(args.source, seed=args.seed)
    protocol = EvaluationProtocol(seed=args.seed)
    evaluator = SklearnEvaluator()
    comparison, rows = evaluator.evaluate_preparation(prepared, CONFIGS, protocol)

    print(f"seed={args.seed} sizes={comparison.record['sizes']}")
    print(f"dist={comparison.record['class_distribution']}")
    print(
        f"cv: pedidos={comparison.record['cv_folds_pedidos']} "
        f"usados={comparison.record['cv_folds_usados']} (solo dentro de train)"
    )
    for metric in comparison.metrics:
        print(
            f"{metric.model_id}: "
            f"cv_acc={metric.cv_accuracy_mean:.4f} "
            f"cv_f1={metric.cv_f1_macro_mean:.4f} "
            f"val_acc={metric.validation_accuracy:.4f} "
            f"val_f1={metric.validation_f1_macro:.4f} "
            f"best={metric.best_params}"
        )
    print(
        f"baseline(mayoria): acc={comparison.baseline_accuracy:.4f} "
        f"f1={comparison.baseline_f1_macro:.4f}"
    )
    print(f"elegido por validacion: {comparison.chosen_model_id}")

    final = evaluator.evaluate_final_on_test(comparison, rows, protocol)
    chosen = next(m for m in final.metrics if m.model_id == final.chosen_model_id)
    print(
        f"test (un solo uso, {final.chosen_model_id}): "
        f"acc={chosen.test_accuracy:.4f} f1={chosen.test_f1_macro:.4f}"
    )
    print("NOTA: metricas = ajuste a la regla sintetica, no desempeno operativo.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
