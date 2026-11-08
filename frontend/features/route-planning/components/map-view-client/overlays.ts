/**
 * Overlays del mapa (vehículo + contenedores; sin estado React).
 *
 * Reciben Leaflet y los marcadores por parámetro: el componente conserva
 * los refs y estas funciones solo dibujan. Imports de leaflet solo de tipos.
 */
import type {
  DivIcon,
  LayerGroup,
  Map as MapaLeaflet,
  Marker,
} from "leaflet";
import { puntoMedioEnLinea, type MapViewModel } from "../map-view/mapViewModel";

/** Punto de contenedor de levante para la capa opcional del mapa. */
export interface PuntoContenedor {
  lon: number;
  lat: number;
  days?: number;
}

type Leaflet = typeof import("leaflet");
type MarcadorRef = { current: Marker | null };

/** Un solo marcador de vehículo que sigue el paso actual (sin parpadeo). */
export function actualizarVehiculo(
  L: Leaflet,
  mapa: MapaLeaflet,
  m: MapViewModel,
  refVehiculo: MarcadorRef,
  refFlecha: MarcadorRef,
): void {
  const actual = m.tramos.find((t) => t.esPasoActual);
  const puntos = actual?.puntosOrientados ?? actual?.puntos;
  if (!actual || !puntos || puntos.length < 2) {
    refVehiculo.current?.remove();
    refVehiculo.current = null;
    refFlecha.current?.remove();
    refFlecha.current = null;
    return;
  }
  const posicion = puntoMedioEnLinea(puntos);
  if (!posicion) return;
  const { punto: medio, angulo } = posicion;

  if (!refVehiculo.current) {
    const icono: DivIcon = L.divIcon({
      html: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'/><path d='M15 18H9'/><path d='M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14'/><circle cx='17' cy='18' r='2'/><circle cx='7' cy='18' r='2'/></svg>",
      className: "marcador-vehiculo",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    refVehiculo.current = L.marker(medio, {
      icon: icono,
      title: "Vehículo recolector",
      zIndexOffset: 1000,
      keyboard: false,
    }).addTo(mapa);
  } else {
    refVehiculo.current.setLatLng(medio);
  }
  refVehiculo.current.bindTooltip(`Vehículo recolector: tramo ${actual.segmentId}`);

  const iconoFlecha: DivIcon = L.divIcon({
    className: "marcador-flecha",
    html: `<span style="display:inline-block;transform:rotate(${angulo}deg)">➤</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
  if (!refFlecha.current) {
    refFlecha.current = L.marker(medio, {
      icon: iconoFlecha,
      interactive: false,
      keyboard: false,
      zIndexOffset: 900,
    }).addTo(mapa);
  } else {
    refFlecha.current.setLatLng(medio);
    refFlecha.current.setIcon(iconoFlecha);
  }
}

/** Capa opcional de contenedores: devuelve la capa nueva (o null). */
export function dibujarContenedores(
  L: Leaflet,
  mapa: MapaLeaflet,
  capaActual: LayerGroup | null,
  contenedores: PuntoContenedor[] | undefined,
  mostrarContenedores: boolean | undefined,
): LayerGroup | null {
  capaActual?.remove();
  if (!mostrarContenedores || !contenedores || contenedores.length === 0) return null;
  const grupo = L.layerGroup();
  for (const p of contenedores.slice(0, 2000)) {
    L.circleMarker([p.lat, p.lon], {
      radius: 3,
      color: "#0ea5e9",
      weight: 1,
      opacity: 0.9,
      fillOpacity: 0.7,
      interactive: true,
    })
      .bindTooltip(
        `Contenedor${p.days !== undefined ? ` · ${p.days} días sin recolección` : ""}`,
      )
      .addTo(grupo);
  }
  grupo.addTo(mapa);
  return grupo;
}
