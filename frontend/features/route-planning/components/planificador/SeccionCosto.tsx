/**
 * Sección de costo (nº 3): total y secuencia del circuito calculado.
 *
 * Presentacional sobre el store: sin estado propio ni gateway.
 */
import { ResumenRecorrido } from "../route-summary";
import { usePlanificador } from "./store";

export function SeccionCosto() {
  const v = usePlanificador();
  if (!v.cost) return null;
  return (
    <section
      aria-labelledby="result-title"
      className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6"
    >
      <h2 id="result-title" className="text-xl font-semibold text-zinc-900">
        3. Costo total y secuencia de tramos
      </h2>
      <ResumenRecorrido
        pasos={v.steps}
        costo={v.cost}
        pasoActual={v.pasoActual}
        onSelectPaso={v.elegirPaso}
      />
    </section>
  );
}
