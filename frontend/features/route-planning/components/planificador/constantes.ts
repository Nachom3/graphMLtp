/**
 * Constantes y textos del planificador (sin React, sin gateway).
 *
 * Etiquetas visibles en español; prioridades y zonas en inglés del backend.
 */
import type { Priority, ZoneType } from "../../domain/types";

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

/** Límite conservador de trabajo interactivo; no promete un tiempo máximo. */
export const MAX_TRAMOS_CALCULO = 300;
export const TRAMOS_POR_PAGINA = 100;
/** Escenarios chicos: se predicen todos los tramos al cargar. */
export const UMBRAL_PREDICCION_GLOBAL = 2500;
/** Montevideo: se predice solo el área visible, por vista. */
export const MAX_TRAMOS_PREDICCION = 2000;

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
