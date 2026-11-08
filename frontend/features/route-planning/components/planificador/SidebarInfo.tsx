/**
 * Bloques de info del sidebar (cartelito, detalle, playback) que acompañan
 * al mapa sin taparlo: viven en la columna scrolleable.
 */
import { ControlesRecorrido } from "../playback";
import { CartelitoCriollo } from "./CartelitoCriollo";
import { DetalleTramo } from "./DetalleTramo";
import { usePlanificador } from "./store";

export function SidebarInfo() {
  const v = usePlanificador();
  return (
    <>
      {v.cost && v.steps.length > 0 && (
        <CartelitoCriollo steps={v.steps} cost={v.cost} />
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
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Reproducir recorrido</h3>
          <p className="mt-1 text-xs text-zinc-500">
            El camión se mueve en el mapa de la derecha; no hace falta bajar la página.
          </p>
          <div className="mt-3">
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
        </div>
      )}
    </>
  );
}
