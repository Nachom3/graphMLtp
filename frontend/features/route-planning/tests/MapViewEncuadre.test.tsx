import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { MapViewCliente } from "../components/map-view-client/MapViewCliente";
import type { MapViewModel, TramoVisible } from "../components/map-view/mapViewModel";

// Leaflet usa layout real del navegador; el doble conserva explícitamente la
// vista para detectar cualquier fitBounds/setView inesperado al filtrar capas.
const leaflet = vi.hoisted(() => {
  let center: [number, number] = [0, 0];
  let zoom = 0;
  let onMoveEnd: (() => void) | undefined;
  const map = {
    setView: vi.fn((position: [number, number], level: number) => {
      center = [...position];
      zoom = level;
      return map;
    }),
    fitBounds: vi.fn(() => {
      center = [0, 0];
      zoom = 10;
      return map;
    }),
    on: vi.fn((event: string, handler: () => void) => {
      if (event === "moveend") onMoveEnd = handler;
      return map;
    }),
    getBounds: vi.fn(() => ({
      getSouth: () => center[0] - 0.001,
      getNorth: () => center[0] + 0.001,
      getWest: () => center[1] - 0.001,
      getEast: () => center[1] + 0.001,
    })),
    invalidateSize: vi.fn(),
    remove: vi.fn(),
  };
  const crearLinea = vi.fn(() => {
    const linea = {
      bindTooltip: vi.fn(() => linea),
      addTo: vi.fn(() => linea),
      setStyle: vi.fn(),
      setTooltipContent: vi.fn(),
      bringToBack: vi.fn(),
      on: vi.fn(() => linea),
      remove: vi.fn(() => linea),
    };
    return linea;
  });
  return {
    map,
    crearLinea,
    view: () => ({ center, zoom }),
    simularPanYZoom: (position: [number, number], level: number) => {
      center = [...position];
      zoom = level;
      onMoveEnd?.();
    },
  };
});

vi.mock("leaflet", () => ({
  DomEvent: { stopPropagation: vi.fn() },
  map: () => leaflet.map,
  tileLayer: () => ({ addTo: vi.fn() }),
  layerGroup: () => {
    const capa = { addTo: vi.fn(() => capa), clearLayers: vi.fn() };
    return capa;
  },
  polyline: leaflet.crearLinea,
  latLngBounds: () => {
    const limites = { extend: vi.fn(() => limites), isValid: () => true };
    return limites;
  },
  divIcon: () => ({}),
  marker: () => ({ addTo: vi.fn(), remove: vi.fn() }),
}));

function tramo(segmentId: string): TramoVisible {
  return {
    segmentId,
    puntos: [[-34.9, -56.16], [-34.901, -56.159]],
    prioridad: "high",
    patron: "gruesa sólida",
    esPasoActual: false,
    esDestino: false,
    esTransito: false,
    enRecorrido: false,
    esRepetido: false,
    ordenes: [],
    repeticiones: 0,
  };
}

function modelo(tramos: TramoVisible[], centro: [number, number] = [-34.9, -56.16]): MapViewModel {
  return { centro, tramos, nodos: [], resumen: "Sin recorrido.", hayRecorrido: false, tramosSinGeometria: 0 };
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => cleanup());

describe("MapViewCliente: conservar el encuadre del usuario", () => {
  it("no revierte pan/zoom al cambiar los IDs de calles visibles", async () => {
    const onLimitesChange = vi.fn();
    const { rerender } = render(
      <MapViewCliente modelo={modelo([tramo("A"), tramo("B")])} onLimitesChange={onLimitesChange} />,
    );
    await waitFor(() => expect(leaflet.map.fitBounds).toHaveBeenCalledTimes(1));

    leaflet.simularPanYZoom([-34.92, -56.18], 17);
    expect(onLimitesChange).toHaveBeenCalledTimes(1);
    const setViewInicial = leaflet.map.setView.mock.calls.length;

    // El culling reemplaza las calles representadas al mover la cámara.
    rerender(<MapViewCliente modelo={modelo([tramo("B"), tramo("C")], [-34.92, -56.18])} onLimitesChange={onLimitesChange} />);

    expect(leaflet.crearLinea).toHaveBeenCalledTimes(4);
    expect(leaflet.map.fitBounds).toHaveBeenCalledTimes(1);
    expect(leaflet.map.setView).toHaveBeenCalledTimes(setViewInicial);
    expect(leaflet.view()).toEqual({ center: [-34.92, -56.18], zoom: 17 });
  });

  it("no reencuadra tras pasar del escenario grande al subconjunto visible", async () => {
    const calles = Array.from({ length: 1001 }, (_, i) => tramo(`T${i}`));
    const { rerender } = render(<MapViewCliente modelo={modelo(calles)} />);
    await waitFor(() => expect(leaflet.map.setView).toHaveBeenCalledTimes(2));
    expect(leaflet.map.fitBounds).not.toHaveBeenCalled();

    leaflet.simularPanYZoom([-34.915, -56.155], 16);
    rerender(<MapViewCliente modelo={modelo(calles.slice(0, 5))} />);

    expect(leaflet.map.fitBounds).not.toHaveBeenCalled();
    expect(leaflet.map.setView).toHaveBeenCalledTimes(2);
    expect(leaflet.view()).toEqual({ center: [-34.915, -56.155], zoom: 16 });
  });
});
