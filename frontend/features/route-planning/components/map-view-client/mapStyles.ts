/**
 * Estilos puros de tramos (sin Leaflet, sin React).
 *
 * Color/patrón por prioridad + marcas de recorrido: la única fuente para
 * pintar un TramoVisible. Nunca solo color (la leyenda suma patrón).
 */
import type { TramoVisible } from "../map-view/mapViewModel";

export function estilo(t: TramoVisible, hayRecorrido: boolean, seleccionado = false) {
  const fueraDeRuta = hayRecorrido && !t.enRecorrido;
  return {
    color: seleccionado && !t.esPasoActual ? "#7c3aed" : colorTramo(t),
    weight: seleccionado ? 10 : t.esPasoActual ? 9 : t.esRepetido ? 7 : t.esDestino ? 6 : 4,
    dashArray: t.esTransito
      ? "3 8"
      : t.prioridad === "medium"
        ? "10 6"
        : t.prioridad === "low"
          ? "2 7"
          : undefined,
    opacity: t.esPasoActual ? 1 : fueraDeRuta ? 0.25 : t.esRepetido ? 0.95 : 0.85,
    className: "cursor-pointer",
  };
}

export function colorTramo(t: TramoVisible): string {
  if (t.esPasoActual) return "#047857";
  if (t.esTransito) return "#52525b";
  if (t.prioridad === "high") return "#dc2626";
  if (t.prioridad === "medium") return "#d97706";
  if (t.prioridad === "low") return "#2563eb";
  return "#a1a1aa";
}

export function etiquetaTramo(t: TramoVisible): string {
  const paso = t.esDestino
    ? "Destino obligatorio"
    : t.esTransito
      ? "Conexión de tránsito"
      : "Tramo";
  const orden =
    t.ordenes.length > 0 ? ` · pasos ${t.ordenes.map((n) => n + 1).join(", ")}` : "";
  const repeticiones = t.esRepetido ? ` · repetido ×${t.repeticiones}` : "";
  return `${paso}: ${t.segmentId}${orden}${repeticiones}`;
}
