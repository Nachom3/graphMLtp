"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  cargarEscenario,
  obtenerEscenario,
  RequestStore,
  solicitarContenedores,
  solicitarExplicacion,
  solicitarPrioridades,
  type ApiGateway,
} from "../../application/usecases";
import { seleccionarAreaVisible, toMapViewModel, type LimitesMapa, type MapViewModel } from "../map-view";
import type {
  ContainerPoint,
  Node,
  Priority,
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Scenario,
  Segment,
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

/**
 * Store del planificador: todo el estado y efectos en un solo provider.
 *
 * Las secciones (filtros, mapa, costo, tabla) consumen vía usePlanificador
 * sin prop-drilling. La lógica es la del Planificador original, movida
 * verbatim: mismos efectos, mismos mensajes, mismo comportamiento.
 */
export interface ValorPlanificador {
  scenario: Scenario | null;
  priorities: PriorityForSegment[];
  include: Priority[];
  fijarInicio: boolean;
  revisionVisible: number;
  busquedaTramo: string;
  steps: RouteStep[];
  revisionRuta: number | null;
  cost: RouteCost | null;
  pasoActual: number;
  reproduciendo: boolean;
  loading: boolean;
  planning: boolean;
  message: string;
  tramoSeleccionadoId: string | null;
  explicacion: SegmentExplanation | null;
  explicacionNota: string | null;
  soloTramosVisibles: boolean;
  mostrarContenedores: boolean;
  contenedores: ContainerPoint[];
  contenedoresTotal: number;
  priorityBySegment: Map<string, Priority>;
  areaVisible: { nodos: Node[]; tramos: Segment[] } | null;
  iniciosDisponibles: Node[];
  inicioVisible: string;
  mapModel: MapViewModel | null;
  tramosFiltrados: Segment[];
  totalPaginas: number;
  paginaVisible: number;
  tramoSeleccionado: Segment | null;
  puedePlanificar: boolean;
  puedeFijar: boolean;
  areaTramos: number | null;
  deshabilitado: boolean;
  sinPrioridades: boolean;
  togglePriority: (priority: Priority) => void;
  overridePriority: (segmentId: string, priority: Priority) => void;
  plan: () => void;
  elegirInicio: (nodeId: string) => void;
  alternarFijarInicio: () => void;
  fijarInicioEn: (nodo: { nodeId: string; lat: number; lon: number }) => void;
  seleccionarTramo: (segmentId: string) => void;
  quitarSeleccion: () => void;
  actualizarLimites: (limites: LimitesMapa) => void;
  buscarTramo: (texto: string) => void;
  alternarVisibles: (valor: boolean) => void;
  irAPagina: (pagina: number) => void;
  alternarContenedores: (valor: boolean) => void;
  reiniciarRecorrido: () => void;
  pasoAnterior: () => void;
  reproducirPausar: () => void;
  pasoSiguiente: () => void;
  saltarAPaso: (paso: number) => void;
  elegirPaso: (paso: number) => void;
}

const ContextoPlanificador = createContext<ValorPlanificador | null>(null);

export function usePlanificador(): ValorPlanificador {
  const valor = useContext(ContextoPlanificador);
  if (!valor) throw new Error("usePlanificador fuera del PlanificadorProvider");
  return valor;
}

export function PlanificadorProvider({ gateway, children }: { gateway: ApiGateway; children: ReactNode }) {
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

  const puedePlanificar = !(loading || planning || priorities.length === 0 || include.length === 0 || !inicioVisible || !areaVisible || areaVisible.tramos.length > MAX_TRAMOS_CALCULO);
  const puedeFijar = !!areaVisible && areaVisible.tramos.length > 0;
  const areaTramos = areaVisible ? areaVisible.tramos.length : null;
  const deshabilitado = loading || planning;
  const sinPrioridades = priorities.length === 0;

  function elegirInicio(nodeId: string) {
    setStartNodeId(nodeId);
    resetRouteView();
  }

  function alternarFijarInicio() {
    setFijarInicio((v) => !v);
  }

  function seleccionarTramo(segmentId: string) {
    setTramoSeleccionadoId(segmentId);
    setMessage(
      `Tramo ${segmentId} seleccionado. Podés cambiar su prioridad abajo; eso no vuelve a consultar el modelo.`,
    );
  }

  function quitarSeleccion() {
    setTramoSeleccionadoId(null);
  }

  function actualizarLimites(nuevos: LimitesMapa) {
    revisionArea.current += 1;
    setRevisionVisible(revisionArea.current);
    setLimites(nuevos);
  }

  function buscarTramo(texto: string) {
    setBusquedaTramo(texto);
    setPagina(0);
  }

  function alternarVisibles(valor: boolean) {
    setSoloTramosVisibles(valor);
    setPagina(0);
  }

  function irAPagina(pagina: number) {
    setPagina(pagina);
  }

  function alternarContenedores(valor: boolean) {
    setMostrarContenedores(valor);
  }

  function reiniciarRecorrido() {
    setReproduciendo(false);
    setPasoActual(-1);
  }

  function pasoAnterior() {
    setReproduciendo(false);
    setPasoActual((a) => Math.max(0, a - 1));
  }

  function reproducirPausar() {
    if (reproduciendo) {
      setReproduciendo(false);
    } else {
      if (pasoActual >= steps.length - 1) setPasoActual(-1);
      setReproduciendo(true);
      if (pasoActual < 0) setPasoActual(0);
    }
  }

  function pasoSiguiente() {
    setReproduciendo(false);
    setPasoActual((a) => Math.min(Math.max(a, 0) + 1, steps.length - 1));
  }

  function saltarAPaso(paso: number) {
    setReproduciendo(false);
    setPasoActual(paso);
  }

  function elegirPaso(paso: number) {
    setReproduciendo(false);
    setPasoActual(paso);
  }

  const valor: ValorPlanificador = {
    scenario, priorities, include, fijarInicio,
    revisionVisible, busquedaTramo, steps, revisionRuta, cost,
    pasoActual, reproduciendo, loading, planning, message,
    tramoSeleccionadoId, explicacion, explicacionNota,
    soloTramosVisibles, mostrarContenedores, contenedores, contenedoresTotal,
    priorityBySegment, areaVisible, iniciosDisponibles, inicioVisible,
    mapModel, tramosFiltrados, totalPaginas, paginaVisible,
    tramoSeleccionado, puedePlanificar, puedeFijar, areaTramos,
    deshabilitado, sinPrioridades,
    togglePriority, overridePriority, plan, elegirInicio,
    alternarFijarInicio, fijarInicioEn, seleccionarTramo, quitarSeleccion,
    actualizarLimites, buscarTramo, alternarVisibles, irAPagina,
    alternarContenedores, reiniciarRecorrido, pasoAnterior,
    reproducirPausar, pasoSiguiente, saltarAPaso, elegirPaso,
  };
  return <ContextoPlanificador.Provider value={valor}>{children}</ContextoPlanificador.Provider>;
}
