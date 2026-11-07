import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EstadoVista } from "../../../components/operation-status";
import { LeyendaPrioridades } from "../components/priority-legend";
import { ResumenRecorrido } from "../components/route-summary";
import { costoFixture } from "./fixtures";
import { conRepeticiones } from "../domain/types";

describe("presentación: estados con datos controlados", () => {
  it("preserva los estados visibles y sus mensajes accesibles", () => {
    const { rerender } = render(<EstadoVista estado={{ estado: "ociosa" }} />);
    expect(screen.getByRole("status").textContent).toContain("Sin solicitud todavía.");
    rerender(<EstadoVista estado={{ estado: "carga", requestId: 1 }} />);
    expect(screen.getByRole("status").textContent).toContain("Cargando…");
    rerender(<EstadoVista estado={{ estado: "vacio", motivo: "selección vacía" }} />);
    expect(screen.getByRole("status").textContent).toContain("selección vacía");
    rerender(<EstadoVista estado={{ estado: "exito", requestId: 1 }} />);
    expect(screen.getByRole("status").textContent).toContain("Listo.");
    rerender(
      <EstadoVista
        estado={{
          estado: "error",
          requestId: 1,
          error: { codigo: "red", detalle: "Servicio no disponible" },
        }}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Error (red): Servicio no disponible.",
    );
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
    const pasos = conRepeticiones(["T0001", "T0002", "T0001"]);
    render(<ResumenRecorrido pasos={pasos} costo={costoFixture} />);
    expect(screen.getByText(/3 pasos/)).toBeDefined();
    expect(screen.getByText(/repetido/)).toBeDefined();
    expect(screen.getByText(new RegExp(String(costoFixture.valor)))).toBeDefined();
  });
});
