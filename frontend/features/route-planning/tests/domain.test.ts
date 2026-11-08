import { describe, expect, it } from "vitest";
import { conRepeticiones, type SegmentId } from "../domain/types";
import { LEYENDA_PRIORIDAD } from "../components/priority-legend/leyenda";
import { repeatedRouteIds } from "./fixtures";

describe("conRepeticiones: conserva orden y duplicados (no deduplica)", () => {
  it("marca el segundo paso por el mismo tramo como repetido", () => {
    const pasos = conRepeticiones(repeatedRouteIds as SegmentId[]);
    expect(pasos.map((p) => p.segmentId)).toEqual(repeatedRouteIds);
    expect(pasos.map((p) => p.order)).toEqual([0, 1, 2, 3]);
    expect(pasos[0].repeated).toBe(false);
    expect(pasos[1].repeated).toBe(false);
    expect(pasos[2].repeated).toBe(true); // T0001 segunda vez
    expect(pasos[2].segmentId).toBe("T0001");
    expect(pasos[3].repeated).toBe(false);
  });

  it("recorrido sin repeticiones: todo en false", () => {
    const pasos = conRepeticiones(["T0001", "T0002", "T0003"] as SegmentId[]);
    expect(pasos.every((p) => !p.repeated)).toBe(true);
  });
});

describe("leyenda: no depende exclusivamente del color", () => {
  it("cada prioridad tiene etiqueta y patrón textual", () => {
    for (const p of ["low", "medium", "high"] as const) {
      expect(LEYENDA_PRIORIDAD[p].etiqueta.length).toBeGreaterThan(0);
      expect(LEYENDA_PRIORIDAD[p].patron.length).toBeGreaterThan(0);
    }
  });
});
