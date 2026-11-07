"""Assign deterministic zone and synthetic priority attributes."""
from __future__ import annotations

import numpy as np

from .config import SEED


def assign_tipo_zona(tramos: list[dict], seed: int = SEED) -> None:
    """Asigna tipo_zona con distribucion 60/25/15 (residencial/comercial/
    industrial) usando RNG con semilla fija. Orden determinista por tramo_id."""
    rng = np.random.default_rng(seed)
    zonas = ["residencial", "comercial", "industrial"]
    ordered = sorted(tramos, key=lambda t: t["tramo_id"])
    draw = rng.choice(zonas, size=len(ordered), p=[0.60, 0.25, 0.15]).tolist()
    for t, z in zip(ordered, draw, strict=True):
        t["tipo_zona"] = z


# Regla v1 (issue #8) RECALIBRADA sin quejas. La version original
# (baja<=10, media 11-16, alta>=17) daba 99.7% baja / 0.3% media / 0% alta.
# Sin el termino 3*quejas, umbrales recalibrados -> balance 43.4/42.1/14.5.
ZONA_W = {"residencial": 0, "industrial": 1, "comercial": 2}
PRIORIDAD_BAJA_MAX = 0
PRIORIDAD_MEDIA_MAX = 2


# --------------------------------------------------------------------------- #
# Etapa 5: prioridad_recoleccion (regla v1 recalibrada)
# --------------------------------------------------------------------------- #
def assign_prioridad(tramos: list[dict]) -> None:
    """Aplica la regla v1 sin quejas (score = 2*dias + 1*contenedores + zona_w)
    con umbrales recalibrados: baja si score <= 0, media si 1-2, alta si >= 3.

    La regla original (con 3*quejas, baja<=10, media 11-16, alta>=17) daba
    99.7% baja. Sin quejas el score real llega a 7: se recalibro y se registra
    el balance final (ver Log del feature doc).
    """
    for t in tramos:
        score = (
            2 * t["dias_desde_ultima_recoleccion"]
            + 1 * t["cantidad_contenedores"]
            + ZONA_W[t["tipo_zona"]]
        )
        if score <= PRIORIDAD_BAJA_MAX:
            t["prioridad_recoleccion"] = "baja"
        elif score <= PRIORIDAD_MEDIA_MAX:
            t["prioridad_recoleccion"] = "media"
        else:
            t["prioridad_recoleccion"] = "alta"


