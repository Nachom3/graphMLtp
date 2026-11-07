"""Sensibilidad de la regla sintetica (issue #10, solo documentacion).

Mide como cambia el balance baja/media/alta al mover umbrales y pesos de
la regla sobre el CSV real, con las mismas quejas sinteticas (seed 0).
No entrena nada: solo re-etiqueta. Sirve para la seccion "Por que la
regla es agresiva" de docs/modelo-comparacion.md.

Usage (from repo root)::

    python scripts/analyze_rule_sensitivity.py
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend" / "src"))

from collection.adapters.datasets.ml_preparation import prepare_dataset
from collection.adapters.datasets.synthetic_complaints import ZONE_WEIGHTS

LABELS = ("baja", "media", "alta")


def label_with(days, cont, zone, quejas, w_dias, w_cont, w_zona, w_quejas, low_max, med_max):
    s = w_dias * days + w_cont * cont + w_zona * ZONE_WEIGHTS[zone] + w_quejas * quejas
    if s <= low_max:
        return "baja"
    if s <= med_max:
        return "media"
    return "alta"


def balance(records, params):
    counts: Counter = Counter()
    for record in records:
        counts[
            label_with(
                int(record["dias_desde_ultima_recoleccion"]),
                int(record["cantidad_contenedores"]),
                str(record["tipo_zona"]),
                int(record["historico_quejas_vecinales"]),
                **params,
            )
        ] += 1
    total = sum(counts.values())
    return {k: (counts.get(k, 0), round(100 * counts.get(k, 0) / total, 1)) for k in LABELS}


def main() -> int:
    parser = argparse.ArgumentParser(description="Sensibilidad de la regla sintetica (seed 0).")
    parser.add_argument("--source", default="dataset/salida/tramos.csv")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    prepared = prepare_dataset(args.source, seed=args.seed)
    records = prepared.enriched.to_dict(orient="records")
    base = {"w_dias": 2, "w_cont": 1, "w_zona": 1, "w_quejas": 2, "low_max": 0, "med_max": 2}
    variants = {
        "BASE 2*d+1*c+1*zw+2*q baja<=0 media<=2": base,
        "baja_max 0->1": {**base, "low_max": 1},
        "media_max 2->3": {**base, "med_max": 3},
        "media_max 2->1": {**base, "med_max": 1},
        "peso dias 2->1": {**base, "w_dias": 1},
        "peso quejas 2->1": {**base, "w_quejas": 1},
        "peso quejas 2->3": {**base, "w_quejas": 3},
    }
    for name, params in variants.items():
        print(f"{name}: {balance(records, params)}")
    print("dias:", prepared.enriched["dias_desde_ultima_recoleccion"].value_counts().to_dict())
    print("contenedores:", prepared.enriched["cantidad_contenedores"].value_counts().to_dict())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
