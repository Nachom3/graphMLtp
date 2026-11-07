"""Fitted-pipeline store (issue #27, adapter; sklearn/joblib live here).

Offline/inference split: comparing and fitting happen offline with the
#10 methodology (``prepare_dataset`` + ``build_pipeline`` + ``fit`` on
train only, chosen on validation, test used once). This module only
saves that fitted pipeline (offline) and loads it back for inference.
It never calls ``fit`` and never needs client training rows.

Identification: ``model_id`` is ``"arbol"`` (the #10 choice). The
default artifact path is ``backend/artifacts/arbol.joblib`` relative to
the repo root, created locally by the documented generation command and
NOT committed. ``joblib`` is the justified format: the sklearn-recommended
persistence for pipelines with numpy data, already in requirements.

Missing file -> ``FileNotFoundError`` (model unavailable). Unreadable or
``predict``-less object -> ``ValueError`` (model incompatible). Any duck
object with ``.predict(DataFrame)`` works, so tests can inject fakes
without files.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

DEFAULT_MODEL_ID = "arbol"
DEFAULT_PIPELINE_PATH = Path("backend") / "artifacts" / "arbol.joblib"


def load_pipeline(path: str | Path) -> Any:
    """Load a FITTED pipeline; raise a clear error when unavailable."""
    target = Path(path)
    try:
        import joblib  # type: ignore[import-not-found]

        pipeline = joblib.load(target)
    except FileNotFoundError:
        raise FileNotFoundError(
            f"modelo no disponible: no existe {target}; generarlo offline "
            "según backend/README.md (sección #27)"
        ) from None
    except Exception as exc:  # noqa: BLE001 - any load failure is incompatibility
        raise ValueError(f"modelo incompatible en {target}: {exc}") from exc
    if not hasattr(pipeline, "predict"):
        raise ValueError(f"modelo incompatible en {target}: sin método predict")
    return pipeline


def save_pipeline(pipeline: Any, path: str | Path) -> Path:
    """Persist a fitted pipeline for later inference (offline only)."""
    import joblib  # type: ignore[import-not-found]

    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, target)
    return target
