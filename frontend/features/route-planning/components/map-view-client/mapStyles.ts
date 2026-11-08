/**
 * Estilos puros de tramos (sin Leaflet, sin React).
 *
 * Color/patrón por prioridad + marcas de recorrido según modoMapa:
 * un canal visual = un significado.
 */
import type { TramoVisible } from "../map-view/mapViewModel";

/** Capas visuales del mapa: un encoding por modo. */
export type ModoMapa = "prioridad" | "recorrido" | "contenedores";

export function estilo(
  t: TramoVisible,
  hayRecorrido: boolean,
  seleccionado = false,
  modo: ModoMapa = "prioridad",
) {
  if (modo === "contenedores") {
    return {
      color: "#94a3b8",
      weight: 2,
      dashArray: undefined as string | undefined,
      opacity: 0.2,
      className: "cursor-pointer",
    };
  }

  if (modo === "prioridad") {
    return {
      color: seleccionado ? "#7c3aed" : colorPrioridad(t),
      weight: seleccionado ? 8 : 5,
      dashArray: undefined as string | undefined,
      opacity: seleccionado ? 1 : 0.9,
      className: "cursor-pointer",
    };
  }

  // modo recorrido
  const fueraDeRuta = hayRecorrido && !t.enRecorrido;
  return {
    color: seleccionado && !t.esPasoActual ? "#7c3aed" : colorRol(t),
    weight: seleccionado ? 10 : t.esPasoActual ? 9 : t.yaRecorrido ? 7 : t.esRepetido ? 7 : t.esDestino ? 6 : 4,
    dashArray: t.esTransito
      ? "3 8"
      : undefined,
    opacity: t.esPasoActual ? 1 : fueraDeRuta ? 0.22 : t.yaRecorrido ? 0.95 : t.esRepetido ? 0.95 : 0.85,
    className: "cursor-pointer",
  };
}

export function colorPrioridad(t: TramoVisible): string {
  if (t.prioridad === "high") return "#dc2626";
  if (t.prioridad === "medium") return "#d97706";
  if (t.prioridad === "low") return "#2563eb";
  return "#a1a1aa";
}

/** Color por rol en el recorrido (modo recorrido). */
export function colorRol(t: TramoVisible): string {
  if (t.esPasoActual) return "#047857";
  if (t.yaRecorrido) return "#16a34a";
  if (t.esTransito) return "#52525b";
  return colorPrioridad(t);
}

/** @deprecated usar colorPrioridad / colorRol según modo */
export function colorTramo(t: TramoVisible): string {
  return colorRol(t);
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

export function mostrarHaloRepeticion(modo: ModoMapa, t: TramoVisible): boolean {
  return modo === "recorrido" && t.esRepetido;
}

export function mostrarVehiculo(modo: ModoMapa): boolean {
  return modo === "recorrido";
}
