"""Centralized runtime configuration (S1).

Single source of truth for scenario-source and scenario-size knobs.
Reads environment with safe defaults so `GET /scenario` sin params keeps
returning the full dataset (S4). No FastAPI/pandas/sklearn here.

Env vars:
- `COLLECTION_SCENARIO_SOURCE`: alternate compatible dataset directory.
  Default: `dataset/salida-montevideo/` (full city).
- `COLLECTION_SCENARIO_DEFAULT_LIMIT`: default cap for `GET /scenario`
  when the client sends no `limit`. Empty/unset = no cap (full dataset).
- `COLLECTION_SCENARIO_MAX_LIMIT`: hard safety cap for a requested
  `limit`. Default 50000 (covers Montevideo ~46k + headroom).
"""
from __future__ import annotations

import os
from pathlib import Path

SCENARIO_SOURCE_ENV = "COLLECTION_SCENARIO_SOURCE"
SCENARIO_DEFAULT_LIMIT_ENV = "COLLECTION_SCENARIO_DEFAULT_LIMIT"
SCENARIO_MAX_LIMIT_ENV = "COLLECTION_SCENARIO_MAX_LIMIT"
REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SCENARIO_DIR = REPO_ROOT / "dataset" / "salida-montevideo"
DEFAULT_MAX_LIMIT = 50000


def scenario_source() -> Path:
    """Return the configured dataset directory (resolved)."""
    configured = os.environ.get(SCENARIO_SOURCE_ENV)
    if configured:
        return Path(configured).expanduser().resolve()
    return DEFAULT_SCENARIO_DIR


def scenario_source_is_custom() -> bool:
    """Whether an explicit alternate source is configured."""
    return bool(os.environ.get(SCENARIO_SOURCE_ENV))


def _parse_limit(raw: str | None, *, name: str) -> int | None:
    if raw is None or raw == "":
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} debe ser un entero >= 0") from exc
    if value < 0:
        raise ValueError(f"{name} debe ser >= 0")
    return value


def scenario_default_limit() -> int | None:
    """Default `limit` when the client sends none (None = sin tope)."""
    return _parse_limit(os.environ.get(SCENARIO_DEFAULT_LIMIT_ENV), name=SCENARIO_DEFAULT_LIMIT_ENV)


def scenario_max_limit() -> int:
    """Hard safety cap for a requested `limit`."""
    raw = os.environ.get(SCENARIO_MAX_LIMIT_ENV)
    if raw is None or raw == "":
        return DEFAULT_MAX_LIMIT
    parsed = _parse_limit(raw, name=SCENARIO_MAX_LIMIT_ENV)
    if parsed is None:
        return DEFAULT_MAX_LIMIT
    if parsed == 0:
        raise ValueError(f"{SCENARIO_MAX_LIMIT_ENV} debe ser > 0")
    return parsed


def resolve_limit(requested: int | None) -> int | None:
    """Apply default + max-cap validation to a `GET /scenario` limit.

    Returns the effective limit (None = sin tope). Raises ValueError on
    negative values or when exceeding the configured max.
    """
    effective = requested if requested is not None else scenario_default_limit()
    if effective is None:
        return None
    if effective < 0:
        raise ValueError("limit debe ser >= 0")
    maximum = scenario_max_limit()
    if effective > maximum:
        raise ValueError(f"limit debe ser <= {maximum}")
    return effective
