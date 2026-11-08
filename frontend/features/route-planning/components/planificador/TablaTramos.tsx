/**
 * Tabla de tramos del escenario (sección 4): búsqueda, filtro y paginación.
 *
 * Presentacional: recibe filas ya filtradas y callbacks, no filtra nada.
 */
import { Badge } from "../../../../components/ui/badge";
import type { Priority, RouteCost, Segment } from "../../domain/types";
import { PRIORIDAD_CLASE, PRIORITIES, TRAMOS_POR_PAGINA, ZONA_ES } from "./constantes";

interface TablaTramosProps {
  totalTramos: number;
  totalNodos: number;
  busqueda: string;
  onBusqueda: (texto: string) => void;
  soloVisibles: boolean;
  onSoloVisibles: (valor: boolean) => void;
  areaTramos: number | null;
  filtrados: Segment[];
  paginaVisible: number;
  totalPaginas: number;
  prioridades: Map<string, Priority>;
  costo: RouteCost | null;
  seleccionadoId: string | null;
  onSeleccionar: (segmentId: string) => void;
  deshabilitado: boolean;
  onOverride: (segmentId: string, priority: Priority) => void;
  onPagina: (pagina: number) => void;
}

export function TablaTramos({
  totalTramos,
  totalNodos,
  busqueda,
  onBusqueda,
  soloVisibles,
  onSoloVisibles,
  areaTramos,
  filtrados,
  paginaVisible,
  totalPaginas,
  prioridades,
  costo,
  seleccionadoId,
  onSeleccionar,
  deshabilitado,
  onOverride,
  onPagina,
}: TablaTramosProps) {
  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
      <summary className="cursor-pointer text-xl font-semibold text-zinc-900">
        4. Tramos del escenario (datos)
      </summary>
      <p className="mt-1 text-sm text-zinc-600">
        {totalTramos} tramos · {totalNodos} nodos · prioridad del
        árbol por tramo (editable para comparar el circuito). Preferí elegir el tramo en el
        mapa o filtrar a los visibles.
      </p>
      <label className="mt-3 flex max-w-sm flex-col gap-2 text-sm text-zinc-700">
        Buscar tramo por ID
        <input
          type="search"
          value={busqueda}
          onChange={(event) => onBusqueda(event.target.value)}
          placeholder="p. ej. T0123"
          aria-label="Buscar tramo por ID"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2"
        />
      </label>
      {busqueda.trim() !== "" && (
        <p className="mt-2 text-sm text-zinc-600" role="status">
          {filtrados.length} tramos coinciden con “{busqueda.trim()}”.
        </p>
      )}
      <label className="mt-3 inline-flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={soloVisibles}
          onChange={(event) => onSoloVisibles(event.target.checked)}
        />
        Solo tramos del área visible
        {areaTramos !== null ? ` (${areaTramos})` : ""}
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
            {filtrados.slice(paginaVisible * TRAMOS_POR_PAGINA, (paginaVisible + 1) * TRAMOS_POR_PAGINA).map((segment) => {
              const prioridad = prioridades.get(segment.segmentId);
              const enRuta = costo?.mandatory?.includes(segment.segmentId);
              const esTransito = costo?.transit?.includes(segment.segmentId);
              const seleccionado = segment.segmentId === seleccionadoId;
              return (
                <tr
                  key={segment.segmentId}
                  className={
                    seleccionado
                      ? "border-b border-violet-200 bg-violet-50 last:border-0"
                      : "border-b border-zinc-100 last:border-0"
                  }
                  onClick={() => onSeleccionar(segment.segmentId)}
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
                          disabled={deshabilitado}
                          onChange={(event) =>
                            onOverride(segment.segmentId, event.target.value as Priority)
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
      {filtrados.length > TRAMOS_POR_PAGINA && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button type="button" disabled={paginaVisible === 0} onClick={() => onPagina(Math.max(0, paginaVisible - 1))}>Anterior</button>
          <span>Página {paginaVisible + 1} de {totalPaginas}</span>
          <button type="button" disabled={paginaVisible + 1 >= totalPaginas} onClick={() => onPagina(Math.min(totalPaginas - 1, paginaVisible + 1))}>Siguiente</button>
        </div>
      )}
    </details>
  );
}
