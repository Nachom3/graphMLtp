"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  cargarEscenario,
  obtenerEscenario,
  RequestStore,
  solicitarContenedores,
  solicitarExplicacion,
  solicitarPrioridades,
} from "../features/route-planning/application/usecases";
import { crearHttpGateway } from "../features/route-planning/infrastructure/httpGateway";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { MapView, seleccionarAreaVisible, toMapViewModel, type LimitesMapa } from "../features/route-planning/components/map-view";
import { desgloseScore } from "../features/route-planning/domain/explain";
import { ControlesRecorrido } from "../features/route-planning/components/playback";
import { LeyendaPrioridades } from "../features/route-planning/components/priority-legend";
import { ResumenRecorrido } from "../features/route-planning/components/route-summary";
import type {
  ContainerPoint,
  Priority,
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Scenario,
  SegmentExplanation,
  ZoneType,
} from "../features/route-planning/domain/types";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

// Límite conservador de trabajo interactivo; no promete un tiempo máximo.
const MAX_TRAMOS_CALCULO = 300;
const TRAMOS_POR_PAGINA = 100;

const ZONA_ES: Record<ZoneType, string> = {
  residential: "Residencial",
  commercial: "Comercial",
  industrial: "Industrial",
};

const PRIORIDAD_CLASE: Record<Priority, string> = {
  high: "bg-red-600 text-white",
  medium: "bg-amber-600 text-white",
  low: "bg-blue-600 text-white",
};

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
  const [prioridadesEditadas, setPrioridadesEditadas] = useState<Record<string, Priority>>({});
  const [include, setInclude] = useState<Priority[]>(["high", "medium"]);
  const [startNodeId, setStartNodeId] = useState("");
  const [fijarInicio, setFijarInicio] = useState(false);
  const [limites, setLimites] = useState<LimitesMapa | null>(null);
  const revisionArea = useRef(0);
  const [revisionVisible, setRevisionVisible] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [busquedaTramo, setBusquedaTramo] = useState("");
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [inicioRuta, setInicioRuta] = useState("");
  const [revisionRuta, setRevisionRuta] = useState<number | null>(null);
  const [cost, setCost] = useState<RouteCost | null>(null);
  const [pasoActual, setPasoActual] = useState(-1);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [message, setMessage] = useState("Cargando el escenario y consultando el árbol…");
  const [tramoSeleccionadoId, setTramoSeleccionadoId] = useState<string | null>(null);
  const [explicacion, setExplicacion] = useState<SegmentExplanation | null>(null);
  const [explicacionNota, setExplicacionNota] = useState<string | null>(null);
  const [soloTramosVisibles, setSoloTramosVisibles] = useState(true);
  const [mostrarContenedores, setMostrarContenedores] = useState(false);
  const [contenedores, setContenedores] = useState<ContainerPoint[]>([]);
  const [contenedoresTotal, setContenedoresTotal] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const loaded = await obtenerEscenario(gateway, new RequestStore());
      if (!active) return;
      if (loaded.estado !== "exito") {
        setLoading(false);
        setMessage(
          loaded.estado === "error"
            ? errorText(loaded.error)
            : loaded.estado === "vacio"
              ? loaded.motivo
              : "No se pudo cargar el escenario.",
        );
        return;
      }
      const valid = cargarEscenario(new RequestStore(), loaded.datos);
      if (valid.estado !== "exito") {
        setLoading(false);
        setMessage(
          valid.estado === "error"
            ? errorText(valid.error)
            : valid.estado === "vacio"
              ? valid.motivo
              : "No se pudo validar el escenario.",
        );
        return;
      }
      setScenario(valid.datos);
      setStartNodeId(valid.datos.nodes[0]?.nodeId ?? "");
      const predicted = await solicitarPrioridades(
        gateway,
        new RequestStore(),
        "arbol",
        valid.datos.segments,
      );
      if (!active) return;
      setLoading(false);
      if (predicted.estado !== "exito") {
        setMessage(
          predicted.estado === "error"
            ? errorText(predicted.error)
            : predicted.estado === "vacio"
              ? predicted.motivo
              : "No se pudieron obtener prioridades.",
        );
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
  const areaVisible = useMemo(
    () => scenario && limites ? seleccionarAreaVisible(scenario.nodes, scenario.segments, limites) : null,
    [scenario, limites],
  );
  // Evita decenas de miles de <option> mientras la vista es demasiado amplia.
  const iniciosDisponibles = areaVisible && areaVisible.tramos.length <= MAX_TRAMOS_CALCULO
    ? areaVisible.nodos : [];
  const inicioVisible = iniciosDisponibles.some((n) => n.nodeId === startNodeId)
    ? startNodeId : iniciosDisponibles[0]?.nodeId ?? "";
  const mapModel = useMemo(() => {
    if (!scenario) return null;
    // Escenarios chicos (piloto/e2e): dibujar todo para poder hacer fitBounds.
    // Montevideo (~46k): no pintar todo; esperar área visible del mapa.
    const MAX_DIBUJO_INICIAL = 2500;
    const tramosMapa = areaVisible
      ? areaVisible.tramos
      : scenario.segments.length <= MAX_DIBUJO_INICIAL
        ? scenario.segments
        : [];
    const nodosMapa = areaVisible
      ? areaVisible.nodos
      : scenario.segments.length <= MAX_DIBUJO_INICIAL
        ? scenario.nodes
        : scenario.nodes;
    return toMapViewModel({
      tramos: tramosMapa,
      nodos: new Map(nodosMapa.map((node) => [node.nodeId, { lat: node.lat, lon: node.lon }])),
      prioridades: priorities,
      pasos: steps,
      pasoActual: pasoActual >= 0 ? pasoActual : undefined,
      mandatory: cost?.mandatory,
      transit: cost?.transit,
      startNodeId: steps.length > 0 ? inicioRuta : inicioVisible,
    });
  }, [scenario, areaVisible, priorities, steps, pasoActual, cost, inicioVisible, inicioRuta]);

  const tramosTabla = useMemo(() => {
    if (!scenario) return [];
    if (soloTramosVisibles && areaVisible) return areaVisible.tramos;
    return scenario.segments;
  }, [scenario, soloTramosVisibles, areaVisible]);
  // Sin efecto: si el área se achica y la página deja de existir, se acota al renderizar.
  const tramosFiltrados = useMemo(() => {
    const q = busquedaTramo.trim().toLowerCase();
    if (!q) return tramosTabla;
    return tramosTabla.filter((t) => t.segmentId.toLowerCase().includes(q));
  }, [busquedaTramo, tramosTabla]);
  const totalPaginas = Math.max(1, Math.ceil(tramosFiltrados.length / TRAMOS_POR_PAGINA));
  const paginaVisible = Math.min(pagina, totalPaginas - 1);

  const tramoSeleccionado = useMemo(
    () => (scenario && tramoSeleccionadoId
      ? scenario.segments.find((t) => t.segmentId === tramoSeleccionadoId) ?? null
      : null),
    [scenario, tramoSeleccionadoId],
  );

  useEffect(() => {
    if (!tramoSeleccionado) return;
    let active = true;
    void solicitarExplicacion(gateway, new RequestStore(), "arbol", tramoSeleccionado).then(
      (resultado) => {
        if (!active) return;
        if (resultado.estado === "exito") {
          setExplicacion(resultado.datos);
          setExplicacionNota(null);
        } else if (resultado.estado === "error") {
          setExplicacion(null);
          setExplicacionNota("Camino del árbol no disponible para este tramo.");
        } else {
          setExplicacion(null);
          setExplicacionNota(null);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [gateway, tramoSeleccionado]);

  useEffect(() => {
    if (!mostrarContenedores || !limites) return;
    let active = true;
    void solicitarContenedores(gateway, new RequestStore(), limites, 2000).then((resultado) => {
      if (!active) return;
      if (resultado.estado === "exito") {
        setContenedores(resultado.datos.points);
        setContenedoresTotal(resultado.datos.total);
      }
    });
    return () => {
      active = false;
    };
  }, [gateway, mostrarContenedores, limites]);

  useEffect(() => {
    if (!reproduciendo || steps.length === 0 || pasoActual >= steps.length - 1) return;
    const id = setTimeout(() => setPasoActual((a) => Math.min(a + 1, steps.length - 1)), 1100);
    return () => clearTimeout(id);
  }, [reproduciendo, pasoActual, steps.length]);

  function resetRouteView() {
    setSteps([]);
    setCost(null);
    setInicioRuta("");
    setRevisionRuta(null);
    setPasoActual(-1);
    setReproduciendo(false);
  }

  function fijarInicioEn(nodo: { nodeId: string; lat: number; lon: number }) {
    setStartNodeId(nodo.nodeId);
    setFijarInicio(false);
    resetRouteView();
    setMessage(
      `Inicio fijado en ${nodo.nodeId}: el circuito empieza y termina acá. Tocá "Solicitar circuito" para recalcular.`,
    );
  }

  function togglePriority(priority: Priority) {
    setInclude((current) =>
      current.includes(priority) ? current.filter((item) => item !== priority) : [...current, priority],
    );
    resetRouteView();
  }

  function overridePriority(segmentId: string, priority: Priority) {
    setPriorities((current) =>
      current.map((row) => (row.segmentId === segmentId ? { ...row, priority } : row)),
    );
    setPrioridadesEditadas((current) => ({ ...current, [segmentId]: priority }));
    resetRouteView();
    setMessage(
      `Prioridad de ${segmentId} ajustada a ${PRIORITIES.find((p) => p.value === priority)?.label}. Volvé a solicitar el circuito.`,
    );
  }

  function plan() {
    if (!scenario || !areaVisible || !limites || !inicioVisible || include.length === 0 || areaVisible.tramos.length > MAX_TRAMOS_CALCULO) return;
    setPlanning(true);
    const params = new URLSearchParams({
      sur: String(limites.sur), norte: String(limites.norte),
      oeste: String(limites.oeste), este: String(limites.este),
      include: include.join(","), start: inicioVisible,
    });
    for (const tramo of areaVisible.tramos) {
      const prioridad = prioridadesEditadas[tramo.segmentId];
      if (prioridad) params.append("override", `${tramo.segmentId}:${prioridad}`);
    }
    // Navegación completa: el servidor genera el HTML del recorrido solicitado.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/recorrido?${params.toString()}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Demo de planificación
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          Planificá un circuito de recolección
        </h1>
        <p className="mt-3 text-zinc-600">
          El árbol colorea cada tramo por prioridad. La API arma el circuito; acá lo ves paso a
          paso, con los tramos que se recorren más de una vez marcados en el mapa.
        </p>
      </header>

      <Alert role="status" aria-live="polite" className="border-zinc-200">
        <AlertDescription>{message}</AlertDescription>
      </Alert>

      {scenario && (
        <>
        <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-6">
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
              {areaVisible
                ? `${areaVisible.tramos.length} tramos visibles. ` +
                  (areaVisible.tramos.length > MAX_TRAMOS_CALCULO
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
                      onChange={() => togglePriority(value)}
                      disabled={loading || planning || priorities.length === 0}
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
                onChange={(event) => {
                  setStartNodeId(event.target.value);
                  resetRouteView();
                }}
                disabled={loading || planning || iniciosDisponibles.length === 0}
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
                onClick={() => setFijarInicio((v) => !v)}
                disabled={loading || planning || !areaVisible || areaVisible.tramos.length === 0}
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
              onClick={plan}
              disabled={loading || planning || priorities.length === 0 || include.length === 0 || !inicioVisible || !areaVisible || areaVisible.tramos.length > MAX_TRAMOS_CALCULO}
              className="mt-5 rounded-md bg-emerald-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {planning ? "Solicitando circuito…" : "Solicitar circuito"}
            </button>
            <div className="mt-5 border-t border-zinc-100 pt-4">
              <LeyendaPrioridades />
            </div>
          </section>
          </div>
          <div className="flex min-w-0 flex-col gap-6">
          {mapModel && (
            <section
              aria-labelledby="map-title"
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
            >
              <div className="border-b border-zinc-100 p-5 pb-4 sm:p-6 sm:pb-4">
                <h2 id="map-title" className="text-xl font-semibold text-zinc-900">
                  2. Grafo de calles y recorrido
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {cost
                    ? mapModel.resumen
                    : areaVisible
                      ? `${areaVisible.tramos.length} tramos en el área visible (escenario: ${scenario.segments.length} tramos · ${scenario.nodes.length} nodos).`
                      : `Escenario: ${scenario.segments.length} tramos · ${scenario.nodes.length} nodos. Esperando el área del mapa.`}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {mapModel.tramosSinGeometria > 0
                    ? `${mapModel.tramosSinGeometria} tramos sin geometría vial se representan como rectas aproximadas.`
                    : "Geometría vial IDE (LineString WGS84) desde la API; el mapa dibuja solo el área visible."}
                </p>
                {revisionRuta !== null && revisionRuta !== revisionVisible && (
                  <p className="mt-2 text-xs text-amber-700">
                    El circuito mostrado se calculó sobre la vista anterior. Solicitá otro para el área visible actual.
                  </p>
                )}
              </div>
              <div className="p-4 sm:p-6">
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <MapView
                    modelo={mapModel}
                    tramoSeleccionadoId={tramoSeleccionadoId}
                    contenedores={contenedores}
                    mostrarContenedores={mostrarContenedores}
                    fijarInicioActivo={fijarInicio}
                    onFijarInicio={fijarInicioEn}
                    onSeleccionarTramo={(segmentId) => {
                      setTramoSeleccionadoId(segmentId);
                      setMessage(
                        `Tramo ${segmentId} seleccionado. Podés cambiar su prioridad abajo; eso no vuelve a consultar el modelo.`,
                      );
                    }}
                    onLimitesChange={(nuevos) => {
                    revisionArea.current += 1;
                    setRevisionVisible(revisionArea.current);
                    setLimites(nuevos);
                  }} />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Mapa: © OpenStreetMap contributors. Clic en un tramo para seleccionarlo.
                </p>
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={mostrarContenedores}
                    onChange={(event) => setMostrarContenedores(event.target.checked)}
                  />
                  Mostrar contenedores del área visible
                  {mostrarContenedores && contenedoresTotal > 0 && (
                    <span className="text-xs text-zinc-500">
                      ({contenedores.length} dibujados de {contenedoresTotal} en vista)
                    </span>
                  )}
                </label>
                {tramoSeleccionado && (
                  <div
                    className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4"
                    role="region"
                    aria-label="Tramo seleccionado en el mapa"
                  >
                    <h3 className="text-sm font-semibold text-violet-950">
                      Tramo seleccionado: {tramoSeleccionado.segmentId}
                    </h3>
                    <p className="mt-1 text-sm text-violet-900/80">
                      {ZONA_ES[tramoSeleccionado.zoneType]} · {tramoSeleccionado.containerCount} contenedores ·{" "}
                      {tramoSeleccionado.daysSinceLastCollection} días sin recolección ·{" "}
                      {tramoSeleccionado.historicNeighborComplaints} quejas.
                      Cambiar la prioridad simula otro resultado de planificación; no genera una
                      predicción nueva del árbol.
                    </p>
                    {(() => {
                      const d = desgloseScore(tramoSeleccionado);
                      const predicha = priorityBySegment.get(tramoSeleccionado.segmentId);
                      return (
                        <div className="mt-3 rounded-md border border-violet-200 bg-white p-3 text-sm text-violet-950">
                          <p className="font-semibold">¿Por qué esta prioridad?</p>
                          <p className="mt-1 text-xs text-violet-900/80">
                            score = 2·días + contenedores + zona_w + 2·quejas = {d.diasPonderado} +{" "}
                            {d.contenedoresPonderado} + {d.zonaW} + {d.quejasPonderado} ={" "}
                            <strong>{d.score}</strong> →{" "}
                            {d.prioridadRegla === "high" ? "alta (score > 2)" : d.prioridadRegla === "medium" ? "media (score 1–2)" : "baja (score ≤ 0)"}
                          </p>
                          {predicha && predicha !== d.prioridadRegla && (
                            <p className="mt-1 text-xs text-amber-700">
                              La regla da {d.prioridadRegla === "high" ? "alta" : d.prioridadRegla === "medium" ? "media" : "baja"} pero
                              el árbol predijo {predicha === "high" ? "alta" : predicha === "medium" ? "media" : "baja"} (o la
                              ajustaste a mano).
                            </p>
                          )}
                        </div>
                      );
                    })()}
                    {explicacion && explicacion.segmentId === tramoSeleccionadoId && explicacion.path.length > 0 && (
                      <div className="mt-3 rounded-md border border-violet-200 bg-white p-3 text-sm text-violet-950">
                        <p className="font-semibold">Camino del árbol</p>
                        <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-violet-900/80">
                          {explicacion.path.map((paso) => (
                            <li key={paso.node}>
                              {paso.leaf ? (
                                <>hoja → prioridad {explicacion.priority === "high" ? "alta" : explicacion.priority === "medium" ? "media" : "baja"}</>
                              ) : (
                                <>
                                  {paso.feature}: {paso.value !== undefined ? paso.value.toFixed(2) : "?"} {paso.direction}
                                  {" "}(umbral {paso.threshold !== undefined ? paso.threshold.toFixed(2) : "?"})
                                </>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {explicacionNota && explicacion?.segmentId !== tramoSeleccionadoId && (
                      <p className="mt-2 text-xs text-violet-900/60">{explicacionNota}</p>
                    )}
                    <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-violet-950">
                      Prioridad para el próximo circuito
                      <select
                        aria-label={`Prioridad del tramo seleccionado ${tramoSeleccionado.segmentId}`}
                        value={priorityBySegment.get(tramoSeleccionado.segmentId) ?? "low"}
                        disabled={loading || planning}
                        onChange={(event) =>
                          overridePriority(
                            tramoSeleccionado.segmentId,
                            event.target.value as Priority,
                          )
                        }
                        className="rounded-md border border-violet-300 bg-white px-2 py-1 text-sm"
                      >
                        {PRIORITIES.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="ml-3 text-sm text-violet-800 underline"
                      onClick={() => setTramoSeleccionadoId(null)}
                    >
                      Quitar selección
                    </button>
                  </div>
                )}
                {steps.length > 0 && (
                  <div className="mt-4">
                    <ControlesRecorrido
                      total={steps.length}
                      actual={pasoActual}
                      reproduciendo={reproduciendo}
                      tramoActual={pasoActual >= 0 ? steps[pasoActual]?.segmentId : undefined}
                      alReiniciar={() => {
                        setReproduciendo(false);
                        setPasoActual(-1);
                      }}
                      alAnterior={() => {
                        setReproduciendo(false);
                        setPasoActual((a) => Math.max(0, a - 1));
                      }}
                      alReproducirPausar={() => {
                        if (reproduciendo) {
                          setReproduciendo(false);
                        } else {
                          if (pasoActual >= steps.length - 1) setPasoActual(-1);
                          setReproduciendo(true);
                          if (pasoActual < 0) setPasoActual(0);
                        }
                      }}
                      alSiguiente={() => {
                        setReproduciendo(false);
                        setPasoActual((a) => Math.min(Math.max(a, 0) + 1, steps.length - 1));
                      }}
                      alSaltar={(paso) => {
                        setReproduciendo(false);
                        setPasoActual(paso);
                      }}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {cost && (
            <section
              aria-labelledby="result-title"
              className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6"
            >
              <h2 id="result-title" className="text-xl font-semibold text-zinc-900">
                3. Costo total y secuencia de tramos
              </h2>
              <ResumenRecorrido
                pasos={steps}
                costo={cost}
                pasoActual={pasoActual}
                onSelectPaso={(paso) => {
                  setReproduciendo(false);
                  setPasoActual(paso);
                }}
              />
            </section>
          )}

          </div>
        </div>
          <details className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
            <summary className="cursor-pointer text-xl font-semibold text-zinc-900">
              4. Tramos del escenario (datos)
            </summary>
            <p className="mt-1 text-sm text-zinc-600">
              {scenario.segments.length} tramos · {scenario.nodes.length} nodos · prioridad del
              árbol por tramo (editable para comparar el circuito). Preferí elegir el tramo en el
              mapa o filtrar a los visibles.
            </p>
            <label className="mt-3 flex max-w-sm flex-col gap-2 text-sm text-zinc-700">
              Buscar tramo por ID
              <input
                type="search"
                value={busquedaTramo}
                onChange={(event) => {
                  setBusquedaTramo(event.target.value);
                  setPagina(0);
                }}
                placeholder="p. ej. T0123"
                aria-label="Buscar tramo por ID"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2"
              />
            </label>
            {busquedaTramo.trim() !== "" && (
              <p className="mt-2 text-sm text-zinc-600" role="status">
                {tramosFiltrados.length} tramos coinciden con “{busquedaTramo.trim()}”.
              </p>
            )}
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={soloTramosVisibles}
                onChange={(event) => {
                  setSoloTramosVisibles(event.target.checked);
                  setPagina(0);
                }}
              />
              Solo tramos del área visible
              {areaVisible ? ` (${areaVisible.tramos.length})` : ""}
            </label>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="py-2 pr-3">Tramo</th>
                    <th className="pr-3">Zona</th>
                    <th className="pr-3">Contenedores</th>
                    <th>Prioridad (editable)</th>
                  </tr>
                </thead>
                <tbody>
                  {tramosFiltrados.slice(paginaVisible * TRAMOS_POR_PAGINA, (paginaVisible + 1) * TRAMOS_POR_PAGINA).map((segment) => {
                    const prioridad = priorityBySegment.get(segment.segmentId);
                    const enRuta = cost?.mandatory?.includes(segment.segmentId);
                    const esTransito = cost?.transit?.includes(segment.segmentId);
                    const seleccionado = segment.segmentId === tramoSeleccionadoId;
                    return (
                      <tr
                        key={segment.segmentId}
                        className={
                          seleccionado
                            ? "border-b border-violet-200 bg-violet-50 last:border-0"
                            : "border-b border-zinc-100 last:border-0"
                        }
                        onClick={() => setTramoSeleccionadoId(segment.segmentId)}
                      >
                        <td className="py-3 pr-3 font-medium text-zinc-900">
                          {segment.segmentId}
                          {enRuta && (
                            <span className="ml-2 text-xs font-normal text-emerald-700">
                              obligatorio
                            </span>
                          )}
                          {esTransito && (
                            <span className="ml-2 text-xs font-normal text-zinc-500">tránsito</span>
                          )}
                        </td>
                        <td className="pr-3">{ZONA_ES[segment.zoneType]}</td>
                        <td className="pr-3">{segment.containerCount}</td>
                        <td>
                          {prioridad ? (
                            <label className="inline-flex items-center gap-2">
                              <Badge className={PRIORIDAD_CLASE[prioridad]}>
                                {PRIORITIES.find(({ value }) => value === prioridad)?.label}
                              </Badge>
                              <select
                                aria-label={`Prioridad de ${segment.segmentId}`}
                                value={prioridad}
                                disabled={loading || planning}
                                onChange={(event) =>
                                  overridePriority(segment.segmentId, event.target.value as Priority)
                                }
                                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs"
                              >
                                {PRIORITIES.map(({ value, label }) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ) : (
                            "Pendiente"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {tramosFiltrados.length > TRAMOS_POR_PAGINA && (
              <div className="mt-3 flex items-center gap-3 text-sm">
                <button type="button" disabled={paginaVisible === 0} onClick={() => setPagina((p) => Math.max(0, p - 1))}>Anterior</button>
                <span>Página {paginaVisible + 1} de {totalPaginas}</span>
                <button type="button" disabled={paginaVisible + 1 >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}>Siguiente</button>
              </div>
            )}
          </details>
        </>
      )}
    </main>
  );
}
