/**
 * Proyección geográfica pura y determinista, sin APIs de navegador.
 *
 * Trabaja con WGS84 [lat, lon] ya adaptado por el gateway; conserva todos
 * los vértices de cada eje IDE. Una aproximación equirectangular mantiene
 * la proporción local de las calles sin depender de Leaflet.
 */
import type { Segment } from "../../domain/types";

export const ANCHO = 800;
export const ALTO = 480;
export const MARGEN = 24;

type Punto = [number, number];

export function proyectarGeometrias(tramos: Segment[]): Map<string, string> {
  const validos = tramos.filter((tramo) =>
    tramo.geometry && tramo.geometry.length >= 2 &&
    tramo.geometry.every(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon)),
  );
  const puntos = validos.flatMap((tramo) => tramo.geometry ?? []);
  if (puntos.length === 0) return new Map();
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of puntos) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  const correccionLon = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const ancho = Math.max((maxLon - minLon) * correccionLon, 1e-9);
  const alto = Math.max(maxLat - minLat, 1e-9);
  const escala = Math.min((ANCHO - 2 * MARGEN) / ancho, (ALTO - 2 * MARGEN) / alto);
  const desplazamientoX = (ANCHO - ancho * escala) / 2;
  const desplazamientoY = (ALTO - alto * escala) / 2;
  const convertir = ([lat, lon]: Punto) => {
    const x = desplazamientoX + (lon - minLon) * correccionLon * escala;
    const y = desplazamientoY + (maxLat - lat) * escala;
    return `${x.toFixed(3)},${y.toFixed(3)}`;
  };
  return new Map(validos.map((tramo) => [
    tramo.segmentId,
    tramo.geometry!.map(convertir).join(" "),
  ]));
}
