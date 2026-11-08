"""File-backed container store (adapter; owns containers.json I/O + bbox filter).

The transport never touches files: it calls ``query`` on the
``ContainerReader`` port. Points are cached once per process (10k rows).
"""
from __future__ import annotations

import json
from pathlib import Path


class FileContainerStore:
    """Read levante container coordinates from dataset/09_levantes."""

    def __init__(self, containers_path: str | Path | None = None) -> None:
        self._path = (
            Path(containers_path)
            if containers_path is not None
            else Path(__file__).resolve().parents[5]
            / "dataset"
            / "09_levantes"
            / "containers.json"
        )
        self._cache: list[dict] | None = None

    def _load_all(self) -> list[dict]:
        cached = self._cache
        if cached is None:
            try:
                cached = json.loads(self._path.read_text(encoding="utf-8"))
            except FileNotFoundError:
                raise FileNotFoundError(
                    "contenedores no disponibles: falta dataset/09_levantes/containers.json"
                ) from None
            self._cache = cached
        return cached

    def query(
        self,
        *,
        sur: float,
        norte: float,
        oeste: float,
        este: float,
        limit: int,
    ) -> tuple[list[dict], int]:
        """Filter cached points by bbox; return (page, total)."""
        points = self._load_all()
        dentro = [
            {"lon": p["long"], "lat": p["lat"], "days": p.get("daysWithoutLift", 0)}
            for p in points
            if isinstance(p.get("lat"), (int, float))
            and isinstance(p.get("long"), (int, float))
            and sur <= p["lat"] <= norte
            and oeste <= p["long"] <= este
        ]
        return dentro[:limit], len(dentro)
