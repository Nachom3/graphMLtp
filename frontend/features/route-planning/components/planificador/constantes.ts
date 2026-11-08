/**
 * Constantes y textos del planificador (sin React, sin gateway).
 *
 * Etiquetas visibles en español; prioridades y zonas en inglés del backend.
 */
import type { Priority, ZoneType } from "../../domain/types";
import type { LimitesMapa } from "../map-view/mapViewModel";

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

/**
 * Tope de tramos que pide el frontend al cargar el escenario (S3).
 * El backend aplica además su propio tope de seguridad (SCENARIO_MAX_LIMIT).
 */
export const LIMITE_TRAMOS_ESCENARIO = 2000;
export const TRAMOS_POR_PAGINA = 100;
/** Escenarios chicos: se predicen todos los tramos al cargar. */
export const UMBRAL_PREDICCION_GLOBAL = 2500;
/** Montevideo: se predice solo el área visible, por vista. */
export const MAX_TRAMOS_PREDICCION = 2000;

/**
 * Barrio demo al entrar (Cordón Sur / Parque Rodó): lo bastante chico para
 * predecir y simular sin que el usuario tenga que ampliar el mapa a mano.
 */
export const BARRIO_DEFAULT: LimitesMapa = {
  sur: -34.912,
  norte: -34.900,
  oeste: -56.172,
  este: -56.152,
};

/** Capas visuales del mapa: un encoding por modo. */
export type { ModoMapa } from "../map-view-client/mapStyles";

export const ZONA_ES: Record<ZoneType, string> = {
  residential: "Residencial",
  commercial: "Comercial",
  industrial: "Industrial",
};

export const PRIORIDAD_CLASE: Record<Priority, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-amber-600 text-white",
  low: "bg-blue-600 text-white",
};

export function errorText(error: { code: string; detail?: string }) {
  const labels: Record<string, string> = {
    network: "No se pudo conectar con la API.",
    "version-mismatch": "La versión de los datos no es compatible.",
    "prediction-without-segment": "La API devolvió una predicción sin tramo.",
    "impossible-route": "No se pudo construir un circuito con esta selección.",
    "invalid-dataset": "El escenario no es válido.",
    backend: "La API informó un error.",
  };
  return `${labels[error.code] ?? labels.backend}${error.detail ? ` ${error.detail}` : ""}`;
}
