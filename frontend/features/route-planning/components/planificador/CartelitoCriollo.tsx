/**
 * Resumen en criollo del circuito calculado (confianza del usuario).
 */
import type { RouteCost, RouteStep } from "../../domain/types";

export function CartelitoCriollo({
  steps,
  cost,
}: {
  steps: RouteStep[];
  cost: RouteCost;
}) {
  const obligatorias = cost.mandatory?.length ?? 0;
  const transito = cost.transit?.length ?? 0;
  const repetidos = steps.filter((s) => s.repeated).length;
  const km = (cost.totalCostM / 1000).toLocaleString("es", { maximumFractionDigits: 1 });
  const cobertura =
    cost.coverage !== undefined
      ? ` · cobertura ${(cost.coverage * 100).toLocaleString("es", { maximumFractionDigits: 0 })}%`
      : "";
  const distanciaRepetida =
    cost.repeatedDistanceM !== undefined && cost.repeatedDistanceM > 0
      ? ` · ${(cost.repeatedDistanceM / 1000).toLocaleString("es", { maximumFractionDigits: 1 })} km recorridos más de una vez`
      : "";

  return (
    <div
      role="status"
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
    >
      <p className="font-semibold">¿Qué calculó la API?</p>
      <p className="mt-1">
        Recorremos <strong>{obligatorias}</strong> calles obligatorias (con contenedores a
        recolectar), pasamos por <strong>{transito}</strong> de conexión
        {repetidos > 0 ? (
          <>
            {" "}
            y <strong>{repetidos}</strong> tramos se repiten
          </>
        ) : null}
        . Distancia total ≈ <strong>{km} km</strong>
        {cobertura}
        {distanciaRepetida}.
      </p>
      <p className="mt-1 text-xs text-emerald-900/70">
        {steps.length} pasos en secuencia. Usá el reproductor del mapa para ver el camión paso a
        paso.
      </p>
    </div>
  );
}
