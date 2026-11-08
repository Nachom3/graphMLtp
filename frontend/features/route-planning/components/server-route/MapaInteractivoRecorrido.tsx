"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PriorityForSegment,
  RouteCost,
  RouteStep,
  Scenario,
} from "../../domain/types";
import { MapView, toMapViewModel } from "../map-view";
import { ControlesRecorrido } from "../playback";

/** Mejora opcional: el HTML y el SVG del recorrido ya llegaron desde el servidor. */
export function MapaInteractivoRecorrido({
  scenario,
  priorities,
  steps,
  cost,
  startNodeId,
}: {
  scenario: Scenario;
  priorities: PriorityForSegment[];
  steps: RouteStep[];
  cost: RouteCost;
  startNodeId: string;
}) {
  const [visible, setVisible] = useState(false);
  const [actual, setActual] = useState(-1);
  const [reproduciendo, setReproduciendo] = useState(false);
  const modelo = useMemo(
    () => toMapViewModel({
      tramos: scenario.segments,
      nodos: new Map(scenario.nodes.map((n) => [n.nodeId, { lat: n.lat, lon: n.lon }])),
      prioridades: priorities,
      pasos: steps,
      mandatory: cost.mandatory,
      transit: cost.transit,
      pasoActual: actual >= 0 ? actual : undefined,
      startNodeId,
    }),
    [scenario, priorities, steps, cost, actual, startNodeId],
  );

  useEffect(() => {
    if (!reproduciendo || steps.length === 0 || actual >= steps.length - 1) return;
    const timer = setTimeout(() => setActual((value) => Math.min(value + 1, steps.length - 1)), 1100);
    return () => clearTimeout(timer);
  }, [reproduciendo, steps.length, actual]);

  function alternarReproduccion() {
    if (reproduciendo && actual < steps.length - 1) {
      setReproduciendo(false);
      return;
    }
    if (actual >= steps.length - 1 || actual < 0) setActual(0);
    setReproduciendo(true);
  }

  return (
    <div className="mt-5 border-t border-zinc-200 pt-4">
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-expanded={visible}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium"
      >
        {visible ? "Ocultar mapa interactivo" : "Abrir mapa interactivo"}
      </button>
      {visible && (
        <div className="mt-4">
          <MapView modelo={modelo} />
          {steps.length > 0 && (
            <div className="mt-4">
              <ControlesRecorrido
                total={steps.length}
                actual={actual}
                reproduciendo={reproduciendo && actual < steps.length - 1}
                tramoActual={actual >= 0 ? steps[actual]?.segmentId : undefined}
                alReiniciar={() => { setReproduciendo(false); setActual(-1); }}
                alAnterior={() => { setReproduciendo(false); setActual((value) => Math.max(0, value - 1)); }}
                alReproducirPausar={alternarReproduccion}
                alSiguiente={() => { setReproduciendo(false); setActual((value) => Math.min(Math.max(value, -1) + 1, steps.length - 1)); }}
                alSaltar={(paso) => { setReproduciendo(false); setActual(paso); }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
