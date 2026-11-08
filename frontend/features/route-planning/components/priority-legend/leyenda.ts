/**
 * Leyenda accesible de prioridades (presentación, no dominio).
 *
 * Etiqueta + patrón textual: el mapa nunca depende solo del color.
 */
import type { Priority } from "../../domain/types";

export const LEYENDA_PRIORIDAD: Record<Priority, { etiqueta: string; patron: string }> = {
  high: { etiqueta: "Alta", patron: "línea gruesa sólida" },
  medium: { etiqueta: "Media", patron: "línea media rayada" },
  low: { etiqueta: "Baja", patron: "línea fina punteada" },
};
