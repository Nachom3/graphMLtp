"""Generate the offline `arbol` artifact for the v1 API (backend README, #27).

Methodology #10: prepare_dataset(seed) -> build_pipeline("arbol", ...) with
max_depth=None, min_samples_split=2 -> fit on train only -> joblib dump to
backend/artifacts/arbol.joblib (not versioned). Inference never trains.

Usage (from repo root)::

    python scripts/generate_arbol_artifact.py
    python scripts/generate_arbol_artifact.py --source dataset/salida/tramos.csv --seed 0 --output backend/artifacts/arbol.joblib
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "src"))
# Nota: `collection` se resuelve en tiempo de ejecución vía sys.path (igual que
# scripts/train_compare.py); scripts/pyrightconfig.json declara ese extraPath
# para análisis estático con pyright.

from collection.adapters.datasets.ml_preparation import prepare_dataset
from collection.adapters.models.model_specs import build_pipeline
from collection.adapters.models.pipeline_store import save_pipeline


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate the fitted arbol artifact (offline).")
    parser.add_argument("--source", default="dataset/salida/tramos.csv")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--output", default="backend/artifacts/arbol.joblib")
    args = parser.parse_args()

    prepared = prepare_dataset(args.source, seed=args.seed)
    pipe = build_pipeline("arbol", prepared.preprocessor, seed=args.seed)
    pipe.set_params(
        decisiontreeclassifier__max_depth=None,
        decisiontreeclassifier__min_samples_split=2,
    )
    train = list(prepared.partitions["train"].indices)
    pipe.fit(prepared.X.iloc[train], prepared.y.iloc[train])
    target = save_pipeline(pipe, args.output)
    print(f"artifact saved: {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
