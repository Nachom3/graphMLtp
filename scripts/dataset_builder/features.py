"""Assign deterministic zone and synthetic priority attributes.

Etapa 5 delega en el backend (unica autoridad de la regla #18): este modulo
solo adapta dicts del builder a esa regla. No hay dos formulas.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

from .config import SEED

# Bootstrap para importar la regla canonica del backend sin instalar nada.
_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_SRC = _ROOT / "backend" / "src"
if str(_BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SRC))

from collection.adapters.datasets.synthetic_complaints import (  # noqa: E402
    COMPLAINT_SEED,
    SCORE_LOW_MAX,
    SCORE_MEDIUM_MAX,
    ZONE_WEIGHTS,
    complaint_count_for_segment,
    label_priority,
)


def assign_tipo_zona(tramos: list[dict], seed: int = SEED) -> None:
    """Asigna tipo_zona con distribucion 60/25/15 (residencial/comercial/
    industrial) usando RNG con semilla fija. Orden determinista por tramo_id."""
    rng = np.random.default_rng(seed)
    zonas = ["residencial", "comercial", "industrial"]
    ordered = sorted(tramos, key=lambda t: t["tramo_id"])
    draw = rng.choice(zonas, size=len(ordered), p=[0.60, 0.25, 0.15]).tolist()
    for t, z in zip(ordered, draw, strict=True):
        t["tipo_zona"] = z


# Re-exports para compatibilidad (output.py y build_dataset.py importan de aqui).
# La autoridad es backend synthetic_complaints; no tocar estos valores aqui.
ZONA_W = dict(ZONE_WEIGHTS)
PRIORIDAD_BAJA_MAX = SCORE_LOW_MAX
PRIORIDAD_MEDIA_MAX = SCORE_MEDIUM_MAX


# --------------------------------------------------------------------------- #
# Etapa 5: prioridad_recoleccion (delega en backend, regla #18 con quejas)
# --------------------------------------------------------------------------- #
__all__ = ["assign_tipo_zona", "assign_prioridad", "complaint_count_for_segment"]


def assign_prioridad(tramos: list[dict], *, seed: int = COMPLAINT_SEED) -> None:
    """Aplica la regla #18 del backend sobre dicts del builder.

    El CSV ya trae el label final y ml_preparation lo recomputa identico
    (su sobrescritura pasa a ser no-op, conserva prioridad_original).
    """
    for t in tramos:
        q = complaint_count_for_segment(
            t["cantidad_contenedores"], seed=seed, segment_id=str(t["tramo_id"])
        )
        t["prioridad_recoleccion"] = label_priority(
            days=t["dias_desde_ultima_recoleccion"],
            containers=t["cantidad_contenedores"],
            zone=t["tipo_zona"],
            complaints=q,
        )


