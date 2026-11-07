import { describe, expect, it } from "vitest";
import {
  LEYENDA_PRIORIDAD,
  conRepeticiones,
  type TramoId,
} from "../domain/types";
import { recorridoRepetidoIds } from "./fixtures";

describe("conRepeticiones: conserva orden y duplicados (no deduplica)", () => {
  it("marca el segundo paso por el mismo tramo como repetido", () => {
    const pasos = conRepeticiones(recorridoRepetidoIds as TramoId[]);
    expect(pasos.map((p) => p.tramoId)).toEqual(recorridoRepetidoIds);
    expect(pasos.map((p) => p.orden)).toEqual([0, 1, 2, 3]);
    expect(pasos[0].repetido).toBe(false);
    expect(pasos[1].repetido).toBe(false);
    expect(pasos[2].repetido).toBe(true); // R-101 segunda vez
    expect(pasos[2].tramoId).toBe("R-101");
    expect(pasos[3].repetido).toBe(false);
  });

  it("recorrido sin repeticiones: todo en false", () => {
    const pasos = conRepeticiones(["R-101", "R-102", "R-103"] as TramoId[]);
    expect(pasos.every((p) => !p.repetido)).toBe(true);
  });
});

describe("leyenda: no depende exclusivamente del color", () => {
  it("cada prioridad tiene etiqueta y patrón textual", () => {
    for (const p of ["baja", "media", "alta"] as const) {
      expect(LEYENDA_PRIORIDAD[p].etiqueta.length).toBeGreaterThan(0);
      expect(LEYENDA_PRIORIDAD[p].patron.length).toBeGreaterThan(0);
    }
  });
});
