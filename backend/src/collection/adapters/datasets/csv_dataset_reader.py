"""CSV dataset reader (issue #27, adapter).

Reads a ``v1`` dataset directory (``nodos.csv`` + ``tramos.csv``) with
the stdlib ``csv`` module — no pandas here — and translates the Spanish
data schema into English domain entities. It reuses the #18 complaint
generation (``synthetic_complaints``) with the project seed so inference
uses exactly the same features as training; any
``historico_quejas_vecinales`` column present in the CSV is recomputed
and never trusted. ``prioridad_recoleccion`` in the CSV, when present,
is ignored: inference predicts it. The CSVs are only read, never
written.
"""
from __future__ import annotations

import csv
from math import isfinite
from pathlib import Path

from ...domain.entities.segment_features import SegmentFeatures
from ...domain.errors.invalid_dataset import InvalidDataset
from ...domain.rules.validate_segment import validate_segment_features
from .synthetic_complaints import COMPLAINT_SEED, complaint_count_for_segment

SCHEMA_VERSION = "v1"

_REQUIRED_NODES = ("nodo_id", "lon", "lat")
_REQUIRED_SEGMENTS = (
    "tramo_id",
    "nodo_origen",
    "nodo_destino",
    "longitud_m",
    "tipo_zona",
    "cantidad_contenedores",
    "dias_desde_ultima_recoleccion",
)
_VALID_ZONES_ES = ("residencial", "comercial", "industrial")
_ZONE_TO_EN = {
    "residencial": "residential",
    "comercial": "commercial",
    "industrial": "industrial",
}


class CsvDatasetReader:
    """Read-only ``v1`` directory (or single ``tramos.csv`` file) loader."""

    def __init__(self, seed: int = COMPLAINT_SEED) -> None:
        self._seed = seed

    @property
    def seed(self) -> int:
        return self._seed

    def load(
        self, source: str, schema_version: str
    ) -> tuple[list[dict], list[SegmentFeatures]]:
        """Return ``(nodes, segments)`` preserving CSV order.

        ``source`` is a directory with ``nodos.csv`` + ``tramos.csv`` (the
        documented ``POST /dataset/validar`` shape) or, for tests, a direct
        ``tramos.csv`` file (nodes return empty). Raises ``InvalidDataset``
        with a comprehensible message instead of inventing values.
        """
        if schema_version != SCHEMA_VERSION:
            raise InvalidDataset(
                f"versión de esquema incompatible: {schema_version!r}; "
                f"se esperaba {SCHEMA_VERSION!r}"
            )
        base = Path(source)
        if base.is_dir():
            nodes = self._read_nodes(base / "nodos.csv")
            segments = self._read_segments(base / "tramos.csv", node_ids={n["nodo_id"] for n in nodes})
        elif base.is_file():
            nodes = []
            segments = self._read_segments(base, node_ids=None)
        else:
            raise InvalidDataset(f"fuente ilegible: no existe {str(source)!r}")
        return nodes, segments

    def _read_nodes(self, path: Path) -> list[dict]:
        rows = self._read_csv(path, "nodos.csv")
        if not rows:
            raise InvalidDataset("nodos.csv no contiene filas")
        missing = [c for c in _REQUIRED_NODES if c not in rows[0]]
        if missing:
            raise InvalidDataset(f"nodos.csv sin columnas: {', '.join(missing)}")
        nodes: list[dict] = []
        seen: set[str] = set()
        for line, row in enumerate(rows, start=2):
            node_id = (row.get("nodo_id") or "").strip()
            if not node_id:
                raise InvalidDataset(f"nodos.csv línea {line}: nodo_id vacío")
            if node_id in seen:
                raise InvalidDataset(f"nodos.csv línea {line}: nodo_id duplicado {node_id!r}")
            seen.add(node_id)
            try:
                lon = float(str(row.get("lon")))
                lat = float(str(row.get("lat")))
            except (TypeError, ValueError):
                raise InvalidDataset(
                    f"nodos.csv línea {line}: lon/lat deben ser números"
                ) from None
            if not isfinite(lon) or not isfinite(lat):
                raise InvalidDataset(
                    f"nodos.csv línea {line}: lon/lat deben ser finitos"
                )
            nodes.append({"nodo_id": node_id, "lon": lon, "lat": lat})
        return nodes

    def _read_segments(self, path: Path, *, node_ids: set[str] | None) -> list[SegmentFeatures]:
        rows = self._read_csv(path, path.name)
        if not rows:
            raise InvalidDataset(f"{path.name} no contiene filas")
        missing = [c for c in _REQUIRED_SEGMENTS if c not in rows[0]]
        if missing:
            raise InvalidDataset(f"{path.name} sin columnas: {', '.join(missing)}")
        segments: list[SegmentFeatures] = []
        seen: set[str] = set()
        for line, row in enumerate(rows, start=2):
            segment_id = (row.get("tramo_id") or "").strip()
            if not segment_id:
                raise InvalidDataset(f"{path.name} línea {line}: tramo_id vacío")
            if segment_id in seen:
                raise InvalidDataset(
                    f"{path.name} línea {line}: tramo_id duplicado {segment_id!r}"
                )
            seen.add(segment_id)
            origin = (row.get("nodo_origen") or "").strip()
            destination = (row.get("nodo_destino") or "").strip()
            if not origin or not destination:
                raise InvalidDataset(
                    f"{path.name} línea {line}: nodo_origen/nodo_destino vacíos"
                )
            if node_ids is not None and (origin not in node_ids or destination not in node_ids):
                raise InvalidDataset(
                    f"{path.name} línea {line}: tramo {segment_id!r} referencia "
                    "a nodo inexistente en nodos.csv"
                )
            try:
                length = float(str(row.get("longitud_m")))
            except (TypeError, ValueError):
                raise InvalidDataset(
                    f"{path.name} línea {line}: longitud_m debe ser número"
                ) from None
            if not isfinite(length) or length <= 0:
                raise InvalidDataset(
                    f"{path.name} línea {line}: longitud_m debe ser > 0"
                )
            zone_es = (row.get("tipo_zona") or "").strip()
            if zone_es not in _VALID_ZONES_ES:
                raise InvalidDataset(
                    f"{path.name} línea {line}: tipo_zona {zone_es!r} inválida; "
                    f"esperaba una de {list(_VALID_ZONES_ES)}"
                )
            containers = self._parse_non_negative_int(
                row.get("cantidad_contenedores"), path.name, line,
                "cantidad_contenedores",
            )
            days = self._parse_non_negative_int(
                row.get("dias_desde_ultima_recoleccion"), path.name, line,
                "dias_desde_ultima_recoleccion",
            )
            complaints = complaint_count_for_segment(
                containers, seed=self._seed, segment_id=segment_id
            )
            segment = SegmentFeatures(
                segment_id=segment_id,
                origin_node=origin,
                destination_node=destination,
                length_m=length,
                zone_type=_ZONE_TO_EN[zone_es],  # type: ignore[typeddict-item]
                container_count=containers,
                days_since_last_collection=days,
                historic_neighbor_complaints=complaints,
            )
            issues = validate_segment_features(segment)
            if issues:
                raise InvalidDataset(f"{path.name} línea {line}: " + "; ".join(issues))
            segments.append(segment)
        return segments

    @staticmethod
    def _read_csv(path: Path, label: str) -> list[dict]:
        try:
            with open(path, newline="", encoding="utf-8") as handle:
                return list(csv.DictReader(handle))
        except (OSError, UnicodeError) as exc:
            raise InvalidDataset(f"fuente ilegible ({label}): {exc}") from exc

    @staticmethod
    def _parse_non_negative_int(value: object, filename: str, line: int, column: str) -> int:
        if value is None or (isinstance(value, str) and not value.strip()):
            raise InvalidDataset(
                f"{filename} línea {line}: {column} faltante (sin inventar valores)"
            )
        try:
            number = float(str(value))
        except (TypeError, ValueError):
            raise InvalidDataset(
                f"{filename} línea {line}: {column} debe ser entero >= 0"
            ) from None
        if not isfinite(number) or number < 0 or not number.is_integer():
            raise InvalidDataset(
                f"{filename} línea {line}: {column} debe ser entero >= 0"
            )
        return int(number)
