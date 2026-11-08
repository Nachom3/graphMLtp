import type {
  Priority,
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Scenario,
  Segment,
} from "../../domain/types";
import { orientarPasos } from "../map-view/mapViewModel";
import { MapaInteractivoRecorrido } from "./MapaInteractivoRecorrido";
import { ALTO, ANCHO, proyectarGeometrias } from "./proyeccion";

export { proyectarGeometrias } from "./proyeccion";

export interface RecorridoSSRProps {
  scenario: Scenario;
  priorities: PriorityForSegment[];
  steps: RouteStep[];
  cost: RouteCost;
  startNodeId: string;
}

const COLOR: Record<Priority, string> = {
  high: "#b91c1c",
  medium: "#b45309",
  low: "#1d4ed8",
};

function formatDistance(value: number, unit: string): string {
  return `${value.toLocaleString("es", { maximumFractionDigits: 1 })} ${unit === "meters" ? "m" : unit}`;
}

/**
 * El SVG, el costo y la secuencia son HTML generado en servidor.
 * La mejora interactiva se hidrata aparte y no es requisito para ver la ruta.
 */
export function RecorridoSSR({ scenario, priorities, steps, cost, startNodeId }: RecorridoSSRProps) {
  const geometryById = proyectarGeometrias(scenario.segments);
  const priorityById = new Map(priorities.map((row) => [row.segmentId, row.priority]));
  const counts = new Map<string, number>();
  for (const step of steps) counts.set(step.segmentId, (counts.get(step.segmentId) ?? 0) + 1);
  const recorridos = scenario.segments.filter((segment) => counts.has(segment.segmentId));
  const sinGeometria = recorridos.filter((segment) => !geometryById.has(segment.segmentId));
  const ids = new Set(scenario.segments.map((segment) => segment.segmentId));
  const faltantes = new Set(steps.filter((step) => !ids.has(step.segmentId)).map((step) => step.segmentId));
  const nodos = new Map(scenario.nodes.map((node) => [node.nodeId, { lat: node.lat, lon: node.lon }]));
  const orientados = orientarPasos({
    pasos: steps,
    tramos: scenario.segments,
    nodos,
    startNodeId,
  });

  return (
    <section aria-labelledby="recorrido-ssr-title" className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 id="recorrido-ssr-title" className="text-xl font-semibold text-zinc-900">Recorrido calculado</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Vista del recorrido generada en el servidor a partir de los ejes viales IDE.
        El color es la prioridad; el contorno verde agua marca la misma calle recorrida
        más de una vez (no es otra calle).
      </p>
      <svg
        role="img"
        aria-label="Mapa del recorrido renderizado en el servidor"
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="mt-4 h-auto w-full rounded-lg border border-zinc-200 bg-zinc-50"
      >
        <title>Calles y circuito calculado</title>
        <desc>Las calles grises muestran el área seleccionada; el color es la prioridad y el contorno verde agua indica repetición sobre la misma calle.</desc>
        {scenario.segments.map((segment) => {
          const puntos = geometryById.get(segment.segmentId);
          return puntos ? (
            <polyline
              key={segment.segmentId}
              data-segment-id={segment.segmentId}
              points={puntos}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          ) : null;
        })}
        {recorridos.map((segment) => {
          const puntos = geometryById.get(segment.segmentId);
          const repeticiones = counts.get(segment.segmentId) ?? 0;
          if (!puntos) return null;
          const prioridad = priorityById.get(segment.segmentId);
          return (
            <g key={segment.segmentId}>
              {repeticiones > 1 && (
                <polyline
                  points={puntos}
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="8"
                  strokeOpacity="0.55"
                  vectorEffect="non-scaling-stroke"
                  aria-hidden="true"
                />
              )}
              <polyline
                data-segment-id={segment.segmentId}
                data-route-segment="true"
                data-repetitions={repeticiones}
                points={puntos}
                fill="none"
                stroke={prioridad ? COLOR[prioridad] : "#475569"}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              >
                <title>{`Tramo ${segment.segmentId}; ${repeticiones} pasada(s)`}</title>
              </polyline>
            </g>
          );
        })}
      </svg>
      {(sinGeometria.length > 0 || faltantes.size > 0) && (
        <p role="status" className="mt-2 text-sm text-amber-800">
          {sinGeometria.length + faltantes.size} tramo(s) del recorrido no tienen geometría disponible y no se dibujaron.
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        Prioridad: rojo alta · naranja media · azul baja · gris sin prioridad.
        Contorno verde agua: repetición sobre la misma calle.
      </p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <dt className="text-zinc-600">Distancia total</dt>
          <dd className="font-semibold">{formatDistance(cost.totalCostM, cost.unit)}</dd>
        </div>
        {cost.coverage !== undefined && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <dt className="text-zinc-600">Cobertura</dt>
            <dd className="font-semibold">{(cost.coverage * 100).toLocaleString("es", { maximumFractionDigits: 1 })}%</dd>
          </div>
        )}
      </dl>
      <h3 className="mt-4 font-semibold">Secuencia de tramos</h3>
      <ol className="mt-2 max-h-72 list-decimal space-y-1 overflow-y-auto pl-6 text-sm">
        {steps.map((step, index) => {
          const orientado = orientados.get(step.order);
          return (
            <li key={`${step.order}-${index}`}>
              {`Paso ${index + 1}: tramo ${step.segmentId}`}
              {step.repeated ? " (repetido)" : ""}
              {orientado ? ` · ${orientado.from} → ${orientado.to}` : ""}
            </li>
          );
        })}
      </ol>
      <MapaInteractivoRecorrido
        scenario={scenario}
        priorities={priorities}
        steps={steps}
        cost={cost}
        startNodeId={startNodeId}
      />
    </section>
  );
}
