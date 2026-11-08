/**
 * Sección del mapa (nº 2): grafo, contenedores, detalle y reproducción.
 *
 * Presentacional sobre el store: sin estado propio ni gateway.
 */
import { MapView } from "../map-view";
import { ControlesRecorrido } from "../playback";
import { BARRIO_DEFAULT, type ModoMapa } from "./constantes";
import { CartelitoCriollo } from "./CartelitoCriollo";
import { DetalleTramo } from "./DetalleTramo";
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
  return (
    <section
      aria-labelledby="map-title"
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white"
    >
      <div className="border-b border-zinc-100 p-5 pb-4 sm:p-6 sm:pb-4">
        <h2 id="map-title" className="text-xl font-semibold text-zinc-900">
          2. Grafo de calles y recorrido
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {v.cost
            ? mapModel.resumen
            : v.areaVisible
              ? `${v.areaVisible.tramos.length} tramos en el área visible (escenario: ${v.scenario?.segments.length} tramos · ${v.scenario?.nodes.length} nodos).`
              : `Escenario: ${v.scenario?.segments.length} tramos · ${v.scenario?.nodes.length} nodos. Esperando el área del mapa.`}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {mapModel.tramosSinGeometria > 0
            ? `${mapModel.tramosSinGeometria} tramos sin geometría vial se representan como rectas aproximadas.`
            : "Geometría vial IDE (LineString WGS84) desde la API; el mapa dibuja solo el área visible."}
        </p>
        {v.revisionRuta !== null && v.revisionRuta !== v.revisionVisible && (
          <p className="mt-2 text-xs text-amber-700">
            El circuito mostrado se calculó sobre la vista anterior. Solicitá otro para el área visible actual.
          </p>
        )}
      </div>
      <div className="p-4 sm:p-6">
        <div
          className="mb-3 inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1"
          role="group"
          aria-label="Modo de visualización del mapa"
        >
          {MODOS.map((modo) => (
            <button
              key={modo.value}
              type="button"
              onClick={() => v.elegirModoMapa(modo.value)}
              aria-pressed={v.modoMapa === modo.value}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                v.modoMapa === modo.value
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {modo.label}
            </button>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-lg border border-zinc-200">
          <MapView
            modelo={mapModel}
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
          <MiniLeyenda modo={v.modoMapa} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Mapa: © OpenStreetMap contributors. Clic en un tramo para ver por qué tiene esa prioridad.
          El marcador INICIO es donde empieza y termina el circuito.
        </p>
        <label className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={v.mostrarContenedores}
            onChange={(event) => v.alternarContenedores(event.target.checked)}
          />
          Mostrar contenedores del área visible
          {v.mostrarContenedores && v.contenedoresTotal > 0 && (
            <span className="text-xs text-zinc-500">
              ({v.contenedores.length} dibujados de {v.contenedoresTotal} en vista
              {v.contenedores.length < v.contenedoresTotal ? "; vista truncada" : ""})
            </span>
          )}
        </label>
        {v.cost && v.steps.length > 0 && (
          <div className="mt-4">
            <CartelitoCriollo steps={v.steps} cost={v.cost} />
          </div>
        )}
        {v.tramoSeleccionado && (
          <DetalleTramo
            tramo={v.tramoSeleccionado}
            prediccion={v.priorityBySegment.get(v.tramoSeleccionado.segmentId)}
            explicacion={v.explicacion}
            notaExplicacion={v.explicacionNota}
            deshabilitado={v.deshabilitado}
            onOverride={(priority) => v.overridePriority(v.tramoSeleccionado!.segmentId, priority)}
            onQuitar={v.quitarSeleccion}
          />
        )}
        {v.steps.length > 0 && (
          <div className="mt-4">
            <ControlesRecorrido
              total={v.steps.length}
              actual={v.pasoActual}
              reproduciendo={v.reproduciendo}
              tramoActual={v.pasoActual >= 0 ? v.steps[v.pasoActual]?.segmentId : undefined}
              alReiniciar={v.reiniciarRecorrido}
              alAnterior={v.pasoAnterior}
              alReproducirPausar={v.reproducirPausar}
              alSiguiente={v.pasoSiguiente}
              alSaltar={v.saltarAPaso}
            />
          </div>
        )}
      </div>
    </section>
  );
}
