/**
 * Detalle del tramo seleccionado: veredicto humano → barras → árbol → fórmula.
 */
import { useState } from "react";
import { desgloseScore } from "../../domain/explain";
import type { Priority, Segment, SegmentExplanation } from "../../domain/types";
import { PRIORITIES, ZONA_ES } from "./constantes";

interface DetalleTramoProps {
  tramo: Segment;
  prediccion?: Priority;
  explicacion: SegmentExplanation | null;
  notaExplicacion: string | null;
  deshabilitado: boolean;
  onOverride: (priority: Priority) => void;
  onQuitar: () => void;
}

function etiquetaPrioridad(p: Priority): string {
  return p === "high" ? "alta" : p === "medium" ? "media" : "baja";
}

function frasePorQue(
  prediccion: Priority | undefined,
  d: ReturnType<typeof desgloseScore>,
  tramo: Segment,
): string {
  const prioridad = prediccion ?? d.prioridadRegla;
  const partes: string[] = [];
  if (tramo.daysSinceLastCollection > 0) {
    partes.push(`${tramo.daysSinceLastCollection} días sin recolección`);
  }
  if (tramo.containerCount > 0) {
    partes.push(`${tramo.containerCount} contenedores`);
  }
  if (tramo.historicNeighborComplaints > 0) {
    partes.push(`${tramo.historicNeighborComplaints} quejas vecinales`);
  }
  if (tramo.zoneType === "commercial") partes.push("zona comercial");
  if (tramo.zoneType === "industrial") partes.push("zona industrial");
  const motivo = partes.length > 0 ? partes.join(", ") : "pocas señales de urgencia";
  return `Prioridad ${etiquetaPrioridad(prioridad)} porque ${motivo}.`;
}

function Barra({ label, valor, max }: { label: string; valor: number; max: number }) {
  const ancho = max <= 0 ? 0 : Math.min(100, Math.round((Math.abs(valor) / max) * 100));
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-violet-900/80">
        <span>{label}</span>
        <span>{valor}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
        <div className="h-full rounded-full bg-violet-600" style={{ width: `${ancho}%` }} />
      </div>
    </div>
  );
}

export function DetalleTramo({
  tramo,
  prediccion,
  explicacion,
  notaExplicacion,
  deshabilitado,
  onOverride,
  onQuitar,
}: DetalleTramoProps) {
  const d = desgloseScore(tramo);
  const [verArbol, setVerArbol] = useState(false);
  const [verFormula, setVerFormula] = useState(false);
  const prioridad = prediccion ?? d.prioridadRegla;
  const maxBarra = Math.max(d.diasPonderado, d.contenedoresPonderado, d.zonaW, d.quejasPonderado, 1);

  return (
    <div
      className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4"
      role="region"
      aria-label="Tramo seleccionado en el mapa"
    >
      <h3 className="text-sm font-semibold text-violet-950">
        Prioridad {etiquetaPrioridad(prioridad)} · tramo {tramo.segmentId}
      </h3>
      <p className="mt-1 text-sm text-violet-900">{frasePorQue(prediccion, d, tramo)}</p>
      <p className="mt-1 text-xs text-violet-900/70">
        {ZONA_ES[tramo.zoneType]} · {tramo.containerCount} contenedores ·{" "}
        {tramo.daysSinceLastCollection} días · {tramo.historicNeighborComplaints} quejas.
      </p>

      <div className="mt-3 space-y-2 rounded-md border border-violet-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">
          Qué pesó más
        </p>
        <Barra label="Días (×2)" valor={d.diasPonderado} max={maxBarra} />
        <Barra label="Contenedores" valor={d.contenedoresPonderado} max={maxBarra} />
        <Barra label="Zona" valor={d.zonaW} max={maxBarra} />
        <Barra label="Quejas (×2)" valor={d.quejasPonderado} max={maxBarra} />
        {prediccion && prediccion !== d.prioridadRegla && (
          <p className="text-xs text-amber-700">
            La regla simple daría {etiquetaPrioridad(d.prioridadRegla)}; el árbol (o tu ajuste)
            dejó {etiquetaPrioridad(prediccion)}.
          </p>
        )}
      </div>

      {explicacion && explicacion.segmentId === tramo.segmentId && explicacion.path.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            className="text-sm font-medium text-violet-800 underline"
            aria-expanded={verArbol}
            onClick={() => setVerArbol((v) => !v)}
          >
            {verArbol ? "Ocultar camino del árbol" : "Ver camino del árbol"}
          </button>
          {verArbol && (
            <ol className="mt-2 list-decimal space-y-1 rounded-md border border-violet-200 bg-white p-3 pl-8 text-xs text-violet-900/80">
              {explicacion.path.map((paso) => (
                <li key={paso.node}>
                  {paso.leaf ? (
                    <>hoja → prioridad {etiquetaPrioridad(explicacion.priority)}</>
                  ) : (
                    <>
                      {paso.feature}: {paso.value !== undefined ? paso.value.toFixed(2) : "?"}{" "}
                      {paso.direction} (umbral{" "}
                      {paso.threshold !== undefined ? paso.threshold.toFixed(2) : "?"})
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      {notaExplicacion && explicacion?.segmentId !== tramo.segmentId && (
        <p className="mt-2 text-xs text-violet-900/60">{notaExplicacion}</p>
      )}

      <div className="mt-3">
        <button
          type="button"
          className="text-xs text-violet-700 underline"
          aria-expanded={verFormula}
          onClick={() => setVerFormula((v) => !v)}
        >
          {verFormula ? "Ocultar detalle técnico" : "Detalle técnico (fórmula)"}
        </button>
        {verFormula && (
          <p className="mt-1 rounded-md border border-violet-200 bg-white p-2 text-xs text-violet-900/80">
            score = 2·días + contenedores + zona_w + 2·quejas = {d.diasPonderado} +{" "}
            {d.contenedoresPonderado} + {d.zonaW} + {d.quejasPonderado} ={" "}
            <strong>{d.score}</strong> → {etiquetaPrioridad(d.prioridadRegla)} (umbrales: baja ≤0,
            media 1–2, alta &gt;2). Cambiar la prioridad abajo simula otro circuito; no reentrena el
            árbol.
          </p>
        )}
      </div>

      <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-violet-950">
        Prioridad para el próximo circuito
        <select
          aria-label={`Prioridad del tramo seleccionado ${tramo.segmentId}`}
          value={prediccion ?? "low"}
          disabled={deshabilitado}
          onChange={(event) => onOverride(event.target.value as Priority)}
          className="rounded-md border border-violet-300 bg-white px-2 py-1 text-sm"
        >
          {PRIORITIES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="ml-3 text-sm text-violet-800 underline" onClick={onQuitar}>
        Quitar selección
      </button>
    </div>
  );
}
