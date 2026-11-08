import { describe, expect, it } from "vitest";
import {
  filtrarContenedoresEnGrafo,
  RADIO_CONTENEDOR_GRAFO_M,
} from "../components/map-view/mapViewModel";
import { scenarioFixture } from "./fixtures";

describe("filtrarContenedoresEnGrafo: solo puntos dentro del grafo", () => {
  const nodos = new Map(
    scenarioFixture.nodes.map((n) => [n.nodeId, { lat: n.lat, lon: n.lon }]),
  );

  it("conserva el contenedor pegado al tramo y saca el lejano", () => {
    // T0001 va N0001 (-34.915,-56.16) -> N0002 (-34.91,-56.155).
    // Punto medio aproximado del segmento.
    const cerca = { lon: -56.1575, lat: -34.9125, days: 2 };
    const lejos = { lon: -56.14, lat: -34.9, days: 5 };
    const out = filtrarContenedoresEnGrafo({
      contenedores: [cerca, lejos],
      tramos: scenarioFixture.segments,
      nodos,
    });
    expect(out).toContain(cerca);
    expect(out).not.toContain(lejos);
  });

  it("sin grafo no muestra nada aunque haya puntos en el bbox", () => {
    const puntos = [{ lon: -56.1575, lat: -34.9125 }];
    expect(
      filtrarContenedoresEnGrafo({ contenedores: puntos, tramos: [], nodos }),
    ).toEqual([]);
    expect(
      filtrarContenedoresEnGrafo({
        contenedores: [],
        tramos: scenarioFixture.segments,
        nodos,
      }),
    ).toEqual([]);
  });

  it("usa la geometría real cuando existe, no la recta entre nodos", () => {
    const curva: [number, number][] = [
      [-34.915, -56.16],
      [-34.914, -56.157],
      [-34.91, -56.155],
    ];
    const tramo = { ...scenarioFixture.segments[0], geometry: curva };
    // Sobre la curva pero lejos de la recta directa.
    const sobreCurva = { lon: -56.157, lat: -34.914 };
    const out = filtrarContenedoresEnGrafo({
      contenedores: [sobreCurva],
      tramos: [tramo],
      nodos,
    });
    expect(out).toEqual([sobreCurva]);
  });

  it(`respeta el radio de ${RADIO_CONTENEDOR_GRAFO_M} m del builder`, () => {
    const tramo = scenarioFixture.segments[0];
    // ~100 m al norte del punto medio: fuera del radio.
    const fuera = { lon: -56.1575, lat: -34.9115 };
    const dentro = filtrarContenedoresEnGrafo({
      contenedores: [fuera],
      tramos: [tramo],
      nodos,
      radioM: 200,
    });
    const fueraReal = filtrarContenedoresEnGrafo({
      contenedores: [fuera],
      tramos: [tramo],
      nodos,
    });
    expect(dentro).toEqual([fuera]);
    expect(fueraReal).toEqual([]);
  });
});
