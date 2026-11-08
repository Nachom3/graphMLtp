"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  cargarEscenario,
  obtenerEscenario,
  RequestStore,
  solicitarContenedores,
  solicitarExplicacion,
  solicitarPrioridades,
  type ApiGateway,
} from "../../application/usecases";
import { Alert, AlertDescription } from "../../../../components/ui/alert";
import { MapView, seleccionarAreaVisible, toMapViewModel, type LimitesMapa } from "../map-view";
import { ControlesRecorrido } from "../playback";
import { ResumenRecorrido } from "../route-summary";
import { DetalleTramo } from "./DetalleTramo";
import { PanelFiltros } from "./PanelFiltros";
import { TablaTramos } from "./TablaTramos";
import type {
  ContainerPoint,
  Priority,
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Scenario,
  SegmentExplanation,
} from "../../domain/types";
import {
  errorText,
  MAX_TRAMOS_CALCULO,
  MAX_TRAMOS_PREDICCION,
  PRIORITIES,
  TRAMOS_POR_PAGINA,
  UMBRAL_PREDICCION_GLOBAL,
} from "./constantes";

/** Planificador puro: recibe el puerto ApiGateway, nunca la infraestructura. */
export function Planificador({ gateway }: { gateway: ApiGateway }) {
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
      setLoading(false);
      if (valid.datos.segments.length <= UMBRAL_PREDICCION_GLOBAL) {
        const predicted = await solicitarPrioridades(
          gateway,
          new RequestStore(),
          "arbol",
          valid.datos.segments,
        );
        if (!active) return;
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
      } else {
        setMessage(
          `Escenario grande (${valid.datos.segments.length} tramos): acercá el mapa para predecir y colorear el área visible.`,
        );
      }
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

  const esEscenarioGrande = (scenario?.segments.length ?? 0) > UMBRAL_PREDICCION_GLOBAL;

  useEffect(() => {
    if (!esEscenarioGrande || !areaVisible || areaVisible.tramos.length === 0) return;
    if (areaVisible.tramos.length > MAX_TRAMOS_PREDICCION) return;
    let active = true;
    void solicitarPrioridades(gateway, new RequestStore(), "arbol", areaVisible.tramos).then((resultado) => {
      if (!active) return;
      if (resultado.estado === "exito") {
        setPriorities(resultado.datos);
        setMessage(
          `Prioridades del área calculadas por el árbol (${resultado.datos.length} tramos). Elegí prioridades, inicio y solicitá el circuito.`,
        );
      } else if (resultado.estado === "error") {
        setMessage(`No se pudieron predecir las prioridades del área: ${errorText(resultado.error)} Movete o acercá para reintentar.`);
      }
    });
    return () => {
      active = false;
    };
  }, [gateway, esEscenarioGrande, areaVisible]);

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
          <PanelFiltros
            include={include}
            onTogglePriority={togglePriority}
            deshabilitado={loading || planning}
            sinPrioridades={priorities.length === 0}
            inicioVisible={inicioVisible}
            iniciosDisponibles={iniciosDisponibles}
            onElegirInicio={(nodeId) => {
              setStartNodeId(nodeId);
              resetRouteView();
            }}
            fijarInicio={fijarInicio}
            onFijarInicioToggle={() => setFijarInicio((v) => !v)}
            puedeFijar={!!areaVisible && areaVisible.tramos.length > 0}
            areaTramos={areaVisible ? areaVisible.tramos.length : null}
            planEnCurso={planning}
            puedePlanificar={!(loading || planning || priorities.length === 0 || include.length === 0 || !inicioVisible || !areaVisible || areaVisible.tramos.length > MAX_TRAMOS_CALCULO)}
            onPlan={plan}
          />
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
                  <DetalleTramo
                    tramo={tramoSeleccionado}
                    prediccion={priorityBySegment.get(tramoSeleccionado.segmentId)}
                    explicacion={explicacion}
                    notaExplicacion={explicacionNota}
                    deshabilitado={loading || planning}
                    onOverride={(priority) => overridePriority(tramoSeleccionado.segmentId, priority)}
                    onQuitar={() => setTramoSeleccionadoId(null)}
                  />
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
          <TablaTramos
            totalTramos={scenario.segments.length}
            totalNodos={scenario.nodes.length}
            busqueda={busquedaTramo}
            onBusqueda={(texto) => {
              setBusquedaTramo(texto);
              setPagina(0);
            }}
            soloVisibles={soloTramosVisibles}
            onSoloVisibles={(valor) => {
              setSoloTramosVisibles(valor);
              setPagina(0);
            }}
            areaTramos={areaVisible ? areaVisible.tramos.length : null}
            filtrados={tramosFiltrados}
            paginaVisible={paginaVisible}
            totalPaginas={totalPaginas}
            prioridades={priorityBySegment}
            costo={cost}
            seleccionadoId={tramoSeleccionadoId}
            onSeleccionar={(segmentId) => setTramoSeleccionadoId(segmentId)}
            deshabilitado={loading || planning}
            onOverride={overridePriority}
            onPagina={(pagina) => setPagina(pagina)}
          />
        </>
      )}
    </main>
  );
}
