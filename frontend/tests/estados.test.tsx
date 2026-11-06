import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstadoVista, LeyendaPrioridades, ResumenRecorrido } from "../src/presentation/estados";
import { costoFixture } from "./fixtures";
import { conRepeticiones } from "../src/domain/types";

describe("presentación: estados con datos controlados", () => {
  it("carga, vacío, parámetros inválidos, fallo de red y recorrido imposible", () => {
    const { rerender } = render(<EstadoVista estado={{ estado: "carga", requestId: 1 }} />);
    expect(screen.getByRole("status").textContent).toMatch(/Cargando/);
    rerender(<EstadoVista estado={{ estado: "vacio", motivo: "selección vacía" }} />);
    expect(screen.getByRole("status").textContent).toContain("selección vacía");
    rerender(
      <EstadoVista estado={{ estado: "error", requestId: 1, error: { codigo: "red" } }} />,
    );
    expect(screen.getByRole("status").textContent).toContain("red");
    rerender(
      <EstadoVista
        estado={{ estado: "error", requestId: 1, error: { codigo: "recorrido-imposible" } }}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("recorrido-imposible");
  });

  it("leyenda con etiqueta y patrón (no solo color)", () => {
    render(<LeyendaPrioridades />);
    expect(screen.getByText(/Alta —/)).toBeDefined();
    expect(screen.getByText(/Media —/)).toBeDefined();
    expect(screen.getByText(/Baja —/)).toBeDefined();
  });

  it("resumen muestra pasos, repetidos y costo del backend", () => {
    const pasos = conRepeticiones(["R-101", "R-102", "R-101"]);
    render(<ResumenRecorrido pasos={pasos} costo={costoFixture} />);
    expect(screen.getByText(/3 pasos/)).toBeDefined();
    expect(screen.getByText(/repetido/)).toBeDefined();
    expect(screen.getByText(new RegExp(String(costoFixture.valor)))).toBeDefined();
  });
});
