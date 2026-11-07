"""Dominio: identificadores, prioridades, configuración del recorrido e invariantes.

Sin dependencias de FastAPI, pandas, sklearn ni networkx. Todo lo de acá
es Python puro para que dominio/aplicación no dependan del framework.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Prioridad = Literal["baja", "media", "alta"]
TipoZona = Literal["residencial", "comercial", "industrial"]

PRIORIDADES: tuple[str, ...] = ("baja", "media", "alta")
TIPOS_ZONA: tuple[str, ...] = ("residencial", "comercial", "industrial")

# Regla de etiqueta v1 (construida, pública). El modelo aprenderá esta regla:
# declararlo en el informe. Una buena métrica NO prueba utilidad operativa.
ZONA_W = {"residencial": 0, "comercial": 2, "industrial": 1}
UMBRAL_MEDIA = 11
UMBRAL_ALTA = 17


class ErrorDominio(ValueError):
    """Base de errores de dominio con código estable para la API."""


class DatasetInvalido(ErrorDominio):
    code = "DATASET_INVALIDO"


class PrediccionSinTramo(ErrorDominio):
    code = "PREDICCION_SIN_TRAMO"


class RecorridoImposible(ErrorDominio):
    code = "RECORRIDO_IMPOSIBLE"


@dataclass(frozen=True)
class Nodo:
    nodo_id: str
    lon: float  # WGS84 EPSG:4326
    lat: float  # WGS84 EPSG:4326


@dataclass(frozen=True)
class TramoFeatures:
    tramo_id: str
    nodo_origen: str
    nodo_destino: str
    longitud_m: float
    tipo_zona: TipoZona
    cantidad_contenedores: int
    dias_desde_ultima_recoleccion: int
    historico_quejas_vecinales: int


@dataclass(frozen=True)
class TramoPredicho:
    tramo_id: str
    prioridad: Prioridad


@dataclass(frozen=True)
class ConfigRecorrido:
    """Criterio de selección + versión del esquema que lo pidió."""

    incluir: tuple[str, ...] = ("media", "alta")
    schema_version: str = "v1"


@dataclass(frozen=True)
class Recorrido:
    orden: tuple[str, ...]  # tramo_ids en orden de visita (con repeticiones)
    repeticiones: tuple[str, ...]  # tramo_ids que se recorren más de una vez
    costo_total_m: float
    unidad: str = "metros"


def validar_tramo_features(t: TramoFeatures) -> list[str]:
    """Invariantes de dominio. Devuelve lista de errores (vacía = válido)."""
    errores: list[str] = []
    if not t.tramo_id:
        errores.append("tramo_id vacío")
    if not t.nodo_origen or not t.nodo_destino:
        errores.append(f"{t.tramo_id}: extremos vacíos")
    if t.nodo_origen == t.nodo_destino:
        errores.append(f"{t.tramo_id}: loop (origen == destino)")
    if not (t.longitud_m > 0):
        errores.append(f"{t.tramo_id}: longitud_m debe ser > 0")
    if t.tipo_zona not in TIPOS_ZONA:
        errores.append(f"{t.tramo_id}: tipo_zona inválido {t.tipo_zona!r}")
    for campo in ("cantidad_contenedores", "dias_desde_ultima_recoleccion",
                  "historico_quejas_vecinales"):
        if getattr(t, campo) < 0:
            errores.append(f"{t.tramo_id}: {campo} debe ser >= 0")
    return errores


def score_v1(dias: int, quejas: int, contenedores: int, zona: TipoZona) -> int:
    return 2 * dias + 3 * quejas + 1 * contenedores + ZONA_W[zona]


def etiqueta_v1(dias: int, quejas: int, contenedores: int, zona: TipoZona) -> Prioridad:
    s = score_v1(dias, quejas, contenedores, zona)
    if s >= UMBRAL_ALTA:
        return "alta"
    if s >= UMBRAL_MEDIA:
        return "media"
    return "baja"


def asociar_predicciones(tramo_ids: list[str], prioridades: list[str]) -> list[TramoPredicho]:
    """Asocia inequívocamente cada prioridad a su tramo.

    Precondición: mismos largos y prioridades válidas. Si no, error
    identificable (nada de alinear por posición en silencio).
    """
    if len(tramo_ids) != len(prioridades):
        raise PrediccionSinTramo(
            f"largos distintos: {len(tramo_ids)} ids vs {len(prioridades)} prioridades")
    out: list[TramoPredicho] = []
    for tid, pri in zip(tramo_ids, prioridades, strict=True):
        if pri not in PRIORIDADES:
            raise PrediccionSinTramo(f"{tid}: prioridad inválida {pri!r}")
        if not tid:
            raise PrediccionSinTramo("prioridad con tramo_id vacío")
        out.append(TramoPredicho(tramo_id=tid, prioridad=pri))  # type: ignore[arg-type]
    ids = [p.tramo_id for p in out]
    if len(set(ids)) != len(ids):
        raise PrediccionSinTramo("tramo_ids duplicados en predicción")
    return out
