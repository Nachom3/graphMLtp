"""Reproducible comparison for issue #10 (thin entry point, no logic here).

Uses the #18 preparation as-is (``prepare_dataset(source, seed=0)``),
compares los 4 modelos del curso (``arbol``, ``logistica``, ``knn``,
``svc``) with the same methodology, contrasts
on reserved validation, and evaluates the winner a single time on test.
The CSV is only read. All science lives in
``collection.adapters.models``; this script only wires and prints.

Usage (from repo root)::

    python scripts/train_compare.py
    python scripts/train_compare.py --source dataset/salida/tramos.csv --seed 0
    python scripts/train_compare.py --figures docs/figs
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "src"))

from collection.adapters.datasets.ml_preparation import prepare_dataset
from collection.adapters.models.sklearn_evaluator import SklearnEvaluator
from collection.application.models.evaluation_protocol import EvaluationProtocol

CONFIGS = ["arbol", "logistica", "knn", "svc"]

CLASS_ORDER = ("baja", "media", "alta")


def per_class_ovr(matrix):
    """Desglose uno-vs-resto: por clase VP/VN/FP/FN desde la matriz."""
    total = sum(sum(row) for row in matrix)
    out = {}
    for i, label in enumerate(CLASS_ORDER):
        vp = int(matrix[i][i])
        fn = int(sum(matrix[i]) - vp)
        fp = int(sum(row[i] for row in matrix) - vp)
        vn = int(total - vp - fp - fn)
        out[label] = {"VP": vp, "FP": fp, "FN": fn, "VN": vn}
    return out


def save_figures(prepared, comparison, output_dir: Path, seed: int) -> list[Path]:
    """Save comparison, validation-confusion, and winning-tree figures."""
    import matplotlib.pyplot as plt
    import numpy as np
    from sklearn.metrics import ConfusionMatrixDisplay
    from sklearn.tree import plot_tree

    from collection.adapters.models.model_specs import build_pipeline

    output_dir.mkdir(parents=True, exist_ok=True)
    paths = []

    fig, ax = plt.subplots(figsize=(8, 5))
    models = comparison.metrics
    labels = [metric.model_id for metric in models]
    positions = np.arange(len(models))
    means = [metric.cv_f1_macro_mean for metric in models]
    deviations = [metric.cv_f1_macro_std for metric in models]
    validation = [metric.validation_f1_macro for metric in models]
    ax.bar(positions - 0.2, means, width=0.4, yerr=deviations, capsize=4, label="CV F1 macro ± std")
    ax.bar(positions + 0.2, validation, width=0.4, label="Validación F1 macro")
    ax.set_xticks(positions, labels)
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("F1 macro")
    ax.set_title("CV (solo train) vs validación")
    ax.legend()
    fig.tight_layout()
    path = output_dir / "f1_comparacion.png"
    fig.savefig(path, dpi=150)
    plt.close(fig)
    paths.append(path)

    fig, axes = plt.subplots(1, len(models), figsize=(4 * len(models), 4))
    for ax, metric in zip(axes, models, strict=True):
        ConfusionMatrixDisplay(
            confusion_matrix=np.asarray(metric.validation_confusion_matrix),
            display_labels=CLASS_ORDER,
        ).plot(ax=ax, colorbar=False, cmap="Blues", values_format="d")
        ax.set_title(metric.model_id)
    fig.tight_layout()
    path = output_dir / "matrices_confusion_validacion.png"
    fig.savefig(path, dpi=150)
    plt.close(fig)
    paths.append(path)

    train = prepared.partitions["train"].indices
    X_train = prepared.X.iloc[list(train)]
    y_train = prepared.y.iloc[list(train)]
    tree = build_pipeline("arbol", prepared.preprocessor, seed=seed)
    tree.fit(X_train, y_train)
    preprocessor_name = next(name for name in tree.named_steps if name != "decisiontreeclassifier")
    fig, ax = plt.subplots(figsize=(18, 9))
    plot_tree(
        tree.named_steps["decisiontreeclassifier"],
        feature_names=tree.named_steps[preprocessor_name].get_feature_names_out(),
        class_names=list(CLASS_ORDER),
        filled=True,
        rounded=True,
        max_depth=3,
        ax=ax,
    )
    ax.set_title("Árbol ganador (ajustado solo en train, profundidad máxima 3)")
    fig.tight_layout()
    path = output_dir / "arbol_ganador.png"
    fig.savefig(path, dpi=150)
    plt.close(fig)
    paths.append(path)
    return paths


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare #10 classifiers (seed 0).")
    parser.add_argument("--source", default="dataset/salida/tramos.csv")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--figures", type=Path, default=None, metavar="DIR")
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
            f"cv_acc={metric.cv_accuracy_mean:.4f}±{metric.cv_accuracy_std:.4f} "
            f"cv_f1={metric.cv_f1_macro_mean:.4f}±{metric.cv_f1_macro_std:.4f} "
            f"val_acc={metric.validation_accuracy:.4f} "
            f"val_f1={metric.validation_f1_macro:.4f} "
            f"best={metric.best_params}"
        )
        print(f"  matriz_val({metric.model_id})={[list(r) for r in metric.validation_confusion_matrix]}")
        for label, scores in per_class_ovr(metric.validation_confusion_matrix).items():
            print(f"    {label}: VP={scores['VP']} FP={scores['FP']} FN={scores['FN']} VN={scores['VN']}")
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
    if args.figures is not None:
        for path in save_figures(prepared, comparison, args.figures, args.seed):
            print(f"figura: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
