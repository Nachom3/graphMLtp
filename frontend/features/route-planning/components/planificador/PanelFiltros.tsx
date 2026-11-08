/**
 * Panel de filtros del planificador (sección 1): prioridades, inicio y plan.
 *
 * Presentacional: recibe valores y callbacks, no conoce el gateway.
 */
import { LeyendaPrioridades } from "../priority-legend";
import type { Node, Priority } from "../../domain/types";
import { MAX_TRAMOS_CALCULO, PRIORITIES } from "./constantes";

interface PanelFiltrosProps {
  include: Priority[];
  onTogglePriority: (priority: Priority) => void;
  deshabilitado: boolean;
  sinPrioridades: boolean;
  inicioVisible: string;
  iniciosDisponibles: Node[];
  onElegirInicio: (nodeId: string) => void;
  fijarInicio: boolean;
  onFijarInicioToggle: () => void;
  puedeFijar: boolean;
  areaTramos: number | null;
  planEnCurso: boolean;
  puedePlanificar: boolean;
  onPlan: () => void;
}

export function PanelFiltros({
  include,
  onTogglePriority,
  deshabilitado,
  sinPrioridades,
  inicioVisible,
  iniciosDisponibles,
  onElegirInicio,
  fijarInicio,
  onFijarInicioToggle,
  puedeFijar,
  areaTramos,
  planEnCurso,
  puedePlanificar,
  onPlan,
}: PanelFiltrosProps) {
  return (
    <section
      aria-labelledby="route-title"
      className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6"
    >
      <h2 id="route-title" className="text-xl font-semibold text-zinc-900">
        1. Prioridades a recorrer y nodo de inicio
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Cambiá la selección y volvé a pedir el circuito: el recorrido se adapta a las
        predicciones incluidas.
      </p>
      <p className="mt-2 text-sm text-zinc-700">
        El cálculo usa solo tramos que intersectan el área visible. Cada tramo se incluye
        completo y puede extenderse fuera de la vista; los demás no se usan. El recorte
        puede desconectar el grafo. Acercá o mové el mapa para elegir el área.
      </p>
      <p className="mt-1 text-sm text-zinc-700">
        {areaTramos !== null
          ? `${areaTramos} tramos visibles. ` +
            (areaTramos > MAX_TRAMOS_CALCULO
              ? `Acercá el mapa: el máximo para calcular es ${MAX_TRAMOS_CALCULO}.`
              : `Límite de cálculo: ${MAX_TRAMOS_CALCULO} tramos.`)
          : "Esperando el área visible del mapa."}
      </p>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">Prioridades a incluir</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {PRIORITIES.map(({ value, label }) => (
            <label key={value} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={include.includes(value)}
                onChange={() => onTogglePriority(value)}
                disabled={deshabilitado || sinPrioridades}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="mt-5 flex max-w-sm flex-col gap-2 text-sm font-medium">
        Nodo de inicio del área seleccionada
        <select
          aria-label="Selector de nodo de inicio"
          value={inicioVisible}
          onChange={(event) => onElegirInicio(event.target.value)}
          disabled={deshabilitado || iniciosDisponibles.length === 0}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2"
        >
          {iniciosDisponibles.map((node) => (
            <option key={node.nodeId} value={node.nodeId}>
              {node.nodeId}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex max-w-sm flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onFijarInicioToggle}
          disabled={deshabilitado || !puedeFijar}
          aria-pressed={fijarInicio}
          className={`rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${fijarInicio ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-zinc-300 bg-white text-zinc-700"}`}
        >
          {fijarInicio ? "Clic en el mapa para fijar… (tocá para cancelar)" : "Fijar inicio con clic en el mapa"}
        </button>
      </div>
      {fijarInicio && (
        <p className="mt-2 text-sm text-emerald-700">
          Tocá cualquier punto del mapa: se usa el nodo más cercano como inicio del circuito.
        </p>
      )}
      <button
        type="button"
        onClick={onPlan}
        disabled={!puedePlanificar}
        className="mt-5 rounded-md bg-emerald-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {planEnCurso ? "Solicitando circuito…" : "Solicitar circuito"}
      </button>
      <div className="mt-5 border-t border-zinc-100 pt-4">
        <LeyendaPrioridades />
      </div>
    </section>
  );
}
