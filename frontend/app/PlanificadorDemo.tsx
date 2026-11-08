"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cargarEscenario,
  obtenerEscenario,
  RequestStore,
  solicitarPrioridades,
  solicitarRecorrido,
  type RoutePlanInput,
} from "../features/route-planning/application/usecases";
import { crearHttpGateway } from "../features/route-planning/infrastructure/httpGateway";
import { MapView, toMapViewModel } from "../features/route-planning/components/map-view";
import { LeyendaPrioridades } from "../features/route-planning/components/priority-legend";
import { ResumenRecorrido } from "../features/route-planning/components/route-summary";
import type {
  OperationState,
  Priority,
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Scenario,
} from "../features/route-planning/domain/types";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

function errorText(error: { code: string; detail?: string }) {
  const labels: Record<string, string> = {
    network: "No se pudo conectar con la API.",
    "version-mismatch": "La versión de los datos no es compatible.",
    "prediction-without-segment": "La API devolvió una predicción sin tramo.",
    "impossible-route": "No se pudo construir un circuito con esta selección.",
    "invalid-dataset": "El escenario no es válido.",
    backend: "La API informó un error.",
  };
  return `${labels[error.code] ?? labels.backend}${error.detail ? ` ${error.detail}` : ""}`;
}

export default function PlanificadorDemo() {
  const [gateway] = useState(() =>
    crearHttpGateway(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"),
  );
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [priorities, setPriorities] = useState<PriorityForSegment[]>([]);
  const [include, setInclude] = useState<Priority[]>(["high", "medium"]);
  const [startNodeId, setStartNodeId] = useState("");
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [cost, setCost] = useState<RouteCost | null>(null);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [message, setMessage] = useState("Cargando el escenario y consultando el árbol…");

  useEffect(() => {
    let active = true;
    async function load() {
      const loaded = await obtenerEscenario(gateway, new RequestStore());
      if (!active) return;
      if (loaded.estado !== "exito") {
        setLoading(false);
        setMessage(loaded.estado === "error" ? errorText(loaded.error) : loaded.estado === "vacio" ? loaded.motivo : "No se pudo cargar el escenario.");
        return;
      }
      const valid = cargarEscenario(new RequestStore(), loaded.datos);
      if (valid.estado !== "exito") {
        setLoading(false);
        setMessage(valid.estado === "error" ? errorText(valid.error) : valid.estado === "vacio" ? valid.motivo : "No se pudo validar el escenario.");
        return;
      }
      setScenario(valid.datos);
      setStartNodeId(valid.datos.nodes[0]?.nodeId ?? "");
      const predicted = await solicitarPrioridades(gateway, new RequestStore(), "arbol", valid.datos.segments);
      if (!active) return;
      setLoading(false);
      if (predicted.estado !== "exito") {
        setMessage(predicted.estado === "error" ? errorText(predicted.error) : predicted.estado === "vacio" ? predicted.motivo : "No se pudieron obtener prioridades.");
        return;
      }
      setPriorities(predicted.datos);
      setMessage("Escenario cargado y prioridades calculadas por el árbol.");
    }
    void load();
    return () => {
      active = false;
    };
  }, [gateway]);

  const priorityBySegment = useMemo(
    () => new Map(priorities.map((prediction) => [prediction.segmentId, prediction.priority])),
    [priorities],
  );
  const mapModel = useMemo(() => {
    if (!scenario || !cost) return null;
    return toMapViewModel({
      tramos: scenario.segments,
      nodos: new Map(scenario.nodes.map((node) => [node.nodeId, { lat: node.lat, lon: node.lon }])),
      prioridades: priorities,
      pasos: steps,
      mandatory: cost.mandatory,
      transit: cost.transit,
    });
  }, [scenario, priorities, steps, cost]);

  function togglePriority(priority: Priority) {
    setInclude((current) =>
      current.includes(priority) ? current.filter((item) => item !== priority) : [...current, priority],
    );
    setSteps([]);
    setCost(null);
  }

  async function plan() {
    if (!scenario || !startNodeId || include.length === 0) return;
    setPlanning(true);
    setSteps([]);
    setCost(null);
    const input: RoutePlanInput = {
      nodes: scenario.nodes,
      segments: scenario.segments,
      priorities: Object.fromEntries(priorities.map(({ segmentId, priority }) => [segmentId, priority])),
      include,
      startNodeId,
    };
    const result: OperationState<{ steps: RouteStep[]; cost: RouteCost }> = await solicitarRecorrido(
      gateway,
      new RequestStore(),
      input,
    );
    setPlanning(false);
    if (result.estado === "exito") {
      setSteps(result.datos.steps);
      setCost(result.datos.cost);
      setMessage("Circuito recibido del planificador.");
    } else if (result.estado === "error") {
      setMessage(errorText(result.error));
    } else if (result.estado === "vacio") {
      setMessage(result.motivo);
    } else {
      setMessage("Esperando el resultado del planificador.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Demo de planificación</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Planificá un circuito de recolección</h1>
        <p className="mt-3 text-zinc-600">
          El árbol asigna prioridades y la API construye el circuito. La interfaz no entrena modelos ni recalcula el recorrido.
        </p>
      </header>

      <p role="status" aria-live="polite" className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        {message}
      </p>

      {scenario && (
        <>
          <section aria-labelledby="scenario-title" className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 id="scenario-title" className="text-xl font-semibold">1. Escenario piloto</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {scenario.segments.length} tramos · {scenario.nodes.length} nodos. Si la API local no está disponible, se usa el fixture de demo.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead><tr className="border-b text-zinc-500"><th className="py-2">Tramo</th><th>Zona</th><th>Contenedores</th><th>Prioridad del árbol</th></tr></thead>
                <tbody>
                  {scenario.segments.map((segment) => (
                    <tr key={segment.segmentId} className="border-b last:border-0">
                      <td className="py-3 font-medium">{segment.segmentId}</td>
                      <td>{segment.zoneType}</td>
                      <td>{segment.containerCount}</td>
                      <td>{PRIORITIES.find(({ value }) => value === priorityBySegment.get(segment.segmentId))?.label ?? "Pendiente"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="route-title" className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 id="route-title" className="text-xl font-semibold">2. Elegí prioridades y nodo de inicio</h2>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">Prioridades a incluir</legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {PRIORITIES.map(({ value, label }) => (
                  <label key={value} className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={include.includes(value)} onChange={() => togglePriority(value)} disabled={loading || priorities.length === 0} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="mt-5 flex max-w-sm flex-col gap-2 text-sm font-medium">
              Nodo de inicio
              <select value={startNodeId} onChange={(event) => { setStartNodeId(event.target.value); setSteps([]); setCost(null); }} disabled={loading} className="rounded-md border border-zinc-300 bg-white px-3 py-2">
                {scenario.nodes.map((node) => <option key={node.nodeId} value={node.nodeId}>{node.nodeId}</option>)}
              </select>
            </label>
            <button type="button" onClick={plan} disabled={loading || planning || priorities.length === 0 || include.length === 0 || !startNodeId} className="mt-5 rounded-md bg-emerald-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
              {planning ? "Solicitando circuito…" : "Solicitar circuito"}
            </button>
          </section>

          {cost && mapModel && (
            <section aria-labelledby="result-title" className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 id="result-title" className="text-xl font-semibold">3. Circuito devuelto por la API</h2>
              <ResumenRecorrido pasos={steps} costo={cost} />
              <LeyendaPrioridades />
              <p className="my-3 text-sm text-zinc-600">{mapModel.resumen}</p>
              <MapView modelo={mapModel} />
            </section>
          )}
        </>
      )}
    </main>
  );
}
