/**
 * Detalle del tramo seleccionado: regla, camino del árbol y override.
 *
 * Presentacional: el desglose se calcula acá desde el dominio.
 */
import { desgloseScore } from "../../domain/explain";
import type { Priority, Segment, SegmentExplanation } from "../../domain/types";
import { PRIORITIES } from "./constantes";

interface DetalleTramoProps {
  tramo: Segment;
  prediccion?: Priority;
  explicacion: SegmentExplanation | null;
  notaExplicacion: string | null;
  deshabilitado: boolean;
  onOverride: (priority: Priority) => void;
  onQuitar: () => void;
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
  return (
    <div
      className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4"
      role="region"
      aria-label="Tramo seleccionado en el mapa"
    >
      <h3 className="text-sm font-semibold text-violet-950">
        Tramo seleccionado: {tramo.segmentId}
      </h3>
      <p className="mt-1 text-sm text-violet-900/80">
        {tramo.zoneType === "residential" ? "Residencial" : tramo.zoneType === "commercial" ? "Comercial" : "Industrial"} · {tramo.containerCount} contenedores ·{" "}
        {tramo.daysSinceLastCollection} días sin recolección ·{" "}
        {tramo.historicNeighborComplaints} quejas.
        Cambiar la prioridad simula otro resultado de planificación; no genera una
        predicción nueva del árbol.
      </p>
      <div className="mt-3 rounded-md border border-violet-200 bg-white p-3 text-sm text-violet-950">
        <p className="font-semibold">¿Por qué esta prioridad?</p>
        <p className="mt-1 text-xs text-violet-900/80">
          score = 2·días + contenedores + zona_w + 2·quejas = {d.diasPonderado} +{" "}
          {d.contenedoresPonderado} + {d.zonaW} + {d.quejasPonderado} ={" "}
          <strong>{d.score}</strong> →{" "}
          {d.prioridadRegla === "high" ? "alta (score > 2)" : d.prioridadRegla === "medium" ? "media (score 1–2)" : "baja (score ≤ 0)"}
        </p>
        {prediccion && prediccion !== d.prioridadRegla && (
          <p className="mt-1 text-xs text-amber-700">
            La regla da {d.prioridadRegla === "high" ? "alta" : d.prioridadRegla === "medium" ? "media" : "baja"} pero
            el árbol predijo {prediccion === "high" ? "alta" : prediccion === "medium" ? "media" : "baja"} (o la
            ajustaste a mano).
          </p>
        )}
      </div>
      {explicacion && explicacion.segmentId === tramo.segmentId && explicacion.path.length > 0 && (
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
      {notaExplicacion && explicacion?.segmentId !== tramo.segmentId && (
        <p className="mt-2 text-xs text-violet-900/60">{notaExplicacion}</p>
      )}
      <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-violet-950">
        Prioridad para el próximo circuito
        <select
          aria-label={`Prioridad del tramo seleccionado ${tramo.segmentId}`}
          value={prediccion ?? "low"}
          disabled={deshabilitado}
          onChange={(event) =>
            onOverride(event.target.value as Priority)
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
        onClick={onQuitar}
      >
        Quitar selección
      </button>
    </div>
  );
}
