import { describe, expect, it } from "vitest";
import { estilo, mostrarHaloRepeticion, mostrarVehiculo } from "../components/map-view-client/mapStyles";
import type { TramoVisible } from "../components/map-view/mapViewModel";

function tramo(parcial: Partial<TramoVisible> = {}): TramoVisible {
  return {
    segmentId: "T1",
    puntos: [[-34.9, -56.16], [-34.901, -56.159]],
    prioridad: "high",
    patron: "gruesa sólida",
    esPasoActual: false,
    esDestino: false,
    esTransito: false,
    enRecorrido: true,
    esRepetido: true,
    ordenes: [0, 3],
    repeticiones: 2,
    ...parcial,
  };
}

describe("mapStyles por modo", () => {
  it("prioridad: solo color sólido, sin dash ni halo de repetición", () => {
    const s = estilo(tramo(), true, false, "prioridad");
    expect(s.color).toBe("#dc2626");
    expect(s.dashArray).toBeUndefined();
    expect(mostrarHaloRepeticion("prioridad", tramo())).toBe(false);
    expect(mostrarVehiculo("prioridad")).toBe(false);
  });

  it("recorrido: tránsito dashed, halo y vehículo activos", () => {
    const s = estilo(tramo({ esTransito: true, prioridad: "low" }), true, false, "recorrido");
    expect(s.dashArray).toBe("3 8");
    expect(s.color).toBe("#52525b");
    expect(mostrarHaloRepeticion("recorrido", tramo())).toBe(true);
    expect(mostrarVehiculo("recorrido")).toBe(true);
  });

  it("contenedores: tramos atenuados", () => {
    const s = estilo(tramo(), true, false, "contenedores");
    expect(s.opacity).toBe(0.2);
    expect(s.weight).toBe(2);
    expect(mostrarVehiculo("contenedores")).toBe(false);
  });
});
