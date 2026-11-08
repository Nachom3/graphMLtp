import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EstadoVista } from "../../../components/operation-status";
import { LeyendaPrioridades } from "../components/priority-legend";
import { ResumenRecorrido } from "../components/route-summary";
import { costFixture } from "./fixtures";
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
          error: { code: "network", detail: "Servicio no disponible" },
        }}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Error (network): Servicio no disponible.",
    );
    rerender(
      <EstadoVista
        estado={{ estado: "error", requestId: 1, error: { code: "impossible-route" } }}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("impossible-route");
  });

  it("leyenda con etiqueta, patrón, repetición y paso actual", () => {
    render(<LeyendaPrioridades />);
    expect(screen.getByText(/Cómo leer el mapa/i)).toBeDefined();
    expect(screen.getByText(/^Alta$/)).toBeDefined();
    expect(screen.getByText(/^Media$/)).toBeDefined();
    expect(screen.getByText(/^Baja$/)).toBeDefined();
    expect(screen.getAllByText(/contorno verde agua/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Paso actual/i)).toBeDefined();
    expect(screen.getByText(/Tránsito/i)).toBeDefined();
  });

  it("resumen muestra pasos, repetidos y costo del backend", () => {
    const onSelectPaso = vi.fn();
    const pasos = conRepeticiones(["T0001", "T0002", "T0001"]);
    render(
      <ResumenRecorrido
        pasos={pasos}
        costo={costFixture}
        pasoActual={2}
        onSelectPaso={onSelectPaso}
      />,
    );
    expect(screen.getByText(/3 pasos/)).toBeDefined();
    expect(screen.getAllByText(/repetido/).length).toBeGreaterThan(0);
    expect(screen.getByText(/301[,.]8 m/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Paso 1: tramo T0001/i }));
    expect(onSelectPaso).toHaveBeenCalledWith(0);
  });
});
