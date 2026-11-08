import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecorridoSSR, proyectarGeometrias } from "../components/server-route/RecorridoSSR";
import { conRepeticiones, type Scenario, type Segment } from "../domain/types";

vi.mock("../components/server-route/MapaInteractivoRecorrido", () => ({
  MapaInteractivoRecorrido: () => null,
}));

const tramo: Segment = {
  segmentId: "calle-curva",
  originNode: "A",
  destinationNode: "B",
  lengthM: 125,
  zoneType: "residential",
  containerCount: 1,
  daysSinceLastCollection: 2,
  historicNeighborComplaints: 0,
  // Norte a sur; el vértice central se desvía al oeste.
  geometry: [[-34.9, -56.1], [-34.905, -56.102], [-34.91, -56.1]],
};
const scenario: Scenario = {
  scenarioId: "ejemplo",
  version: "v1",
  nodes: [
    { nodeId: "A", lat: -34.9, lon: -56.1 },
    { nodeId: "B", lat: -34.91, lon: -56.1 },
  ],
  segments: [tramo],
};
const steps = conRepeticiones([tramo.segmentId, tramo.segmentId]);

describe("Recorrido SSR", () => {
  it("proyecta todos los vértices y conserva orientación norte/sur y oeste/este", () => {
    const proyectada = proyectarGeometrias([tramo]).get(tramo.segmentId);
    const puntos = proyectada!.split(" ").map((punto) => punto.split(",").map(Number));
    expect(puntos).toHaveLength(3);
    expect(puntos[0][1]).toBeLessThan(puntos[2][1]);
    expect(puntos[1][0]).toBeLessThan(puntos[0][0]);
    expect(puntos[0][0]).toBe(puntos[2][0]);
  });

  it("renderiza SVG, costo, repeticiones y pasos orientados en el HTML", () => {
    const html = renderToStaticMarkup(
      <RecorridoSSR
        scenario={scenario}
        priorities={[{ segmentId: tramo.segmentId, priority: "high" }]}
        steps={steps}
        cost={{ totalCostM: 250, unit: "meters", coverage: 1 }}
        startNodeId="A"
      />,
    );
    expect(html).toContain('aria-label="Mapa del recorrido renderizado en el servidor"');
    expect(html).toContain('data-segment-id="calle-curva"');
    expect(html).toContain('data-route-segment="true"');
    expect(html).toContain('data-repetitions="2"');
    expect(html).toContain("#0f766e");
    expect(html).toContain("Distancia total");
    expect(html).toContain("250 m");
    expect(html).toContain("Paso 1: tramo calle-curva");
    expect(html).toContain("Paso 2: tramo calle-curva (repetido)");
    expect(html).toContain("A → B");
    expect(html).toContain("B → A");
  });

  it("no inventa líneas rectas si falta geometría del recorrido", () => {
    const sinGeometria = { ...tramo, geometry: undefined };
    const html = renderToStaticMarkup(
      <RecorridoSSR
        scenario={{ ...scenario, segments: [sinGeometria] }}
        priorities={[]}
        steps={steps}
        cost={{ totalCostM: 250, unit: "meters" }}
        startNodeId="A"
      />,
    );
    expect(html).not.toContain('data-route-segment="true"');
    expect(html).toContain("1 tramo(s) del recorrido no tienen geometría disponible");
  });
});
