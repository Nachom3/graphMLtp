/**
 * Mapa a pantalla completa en la columna derecha.
 * Modos, leyenda y toggle de contenedores van como overlays encima.
 */
import { MapView } from "../map-view";
import { BARRIO_DEFAULT, type ModoMapa } from "./constantes";
import { MiniLeyenda } from "./MiniLeyenda";
import { usePlanificador } from "./store";

const MODOS: { value: ModoMapa; label: string }[] = [
  { value: "prioridad", label: "Prioridad" },
  { value: "recorrido", label: "Recorrido" },
  { value: "contenedores", label: "Contenedores" },
];

export function SeccionMapa() {
  const v = usePlanificador();
  const mapModel = v.mapModel;
  if (!mapModel) return null;

  const resumen = v.cost
    ? mapModel.resumen
    : v.areaVisible
      ? `${v.areaVisible.tramos.length} tramos visibles`
      : "Esperando área del mapa";

  return (
    <section
      aria-labelledby="map-title"
      className="relative h-full min-h-[50vh] w-full overflow-hidden bg-[#e5e7eb]"
    >
      <h2 id="map-title" className="sr-only">
        Grafo y recorrido
      </h2>

      {/* In-flow (no absolute): garantiza altura real para Leaflet */}
      <div className="absolute inset-0">
        <MapView
          modelo={mapModel}
          className="h-full w-full"
          tramoSeleccionadoId={v.tramoSeleccionadoId}
          contenedores={v.contenedores}
          mostrarContenedores={v.mostrarContenedores}
          modoMapa={v.modoMapa}
          encuadreInicial={BARRIO_DEFAULT}
          fijarInicioActivo={v.fijarInicio}
          onFijarInicio={v.fijarInicioEn}
          onSeleccionarTramo={v.seleccionarTramo}
          onLimitesChange={v.actualizarLimites}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-wrap items-start justify-between gap-2 p-3">
        <p className="max-w-[min(100%,20rem)] truncate rounded-md bg-white/90 px-2.5 py-1.5 text-xs text-zinc-700 shadow-sm backdrop-blur-sm">
          {resumen}
        </p>
        <div
          className="pointer-events-auto inline-flex rounded-lg border border-zinc-200 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm"
          role="group"
          aria-label="Modo de visualización del mapa"
        >
          {MODOS.map((modo) => (
            <button
              key={modo.value}
              type="button"
              onClick={() => v.elegirModoMapa(modo.value)}
              aria-pressed={v.modoMapa === modo.value}
              className={`rounded-md px-2.5 py-1 text-xs font-medium sm:text-sm ${
                v.modoMapa === modo.value
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {modo.label}
            </button>
          ))}
        </div>
      </div>

      <MiniLeyenda modo={v.modoMapa} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex flex-wrap items-center gap-2 p-3">
        <label className="pointer-events-auto inline-flex items-center gap-2 rounded-md bg-white/95 px-2.5 py-1.5 text-xs text-zinc-700 shadow-sm backdrop-blur-sm">
          <input
            type="checkbox"
            checked={v.mostrarContenedores}
            onChange={(event) => v.alternarContenedores(event.target.checked)}
          />
          Contenedores
          {v.mostrarContenedores && v.contenedoresTotal > 0 && (
            <span className="text-zinc-500">
              ({v.contenedores.length}/{v.contenedoresTotal} {v.modoMapa === "recorrido" && v.steps.length > 0 ? "en recorrido" : "en grafo"}
              {v.contenedores.length < v.contenedoresTotal ? ", resto fuera" : ""})
            </span>
          )}
        </label>
        {v.revisionRuta !== null && v.revisionRuta !== v.revisionVisible && (
          <span className="rounded-md bg-amber-50/95 px-2.5 py-1.5 text-xs text-amber-800 shadow-sm">
            Circuito de la vista anterior — volvé a simular.
          </span>
        )}
      </div>
    </section>
  );
}
