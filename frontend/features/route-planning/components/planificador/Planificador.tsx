/**
 * Planificador: composición del store con las secciones.
 *
 * Todo el estado y efectos viven en PlanificadorProvider; este archivo
 * solo ordena header, alerta, panel, mapa, costo y tabla. Recibe el puerto
 * ApiGateway, nunca la infraestructura.
 */
"use client";

import { Alert, AlertDescription } from "../../../../components/ui/alert";
import type { ApiGateway } from "../../application/usecases";
import { PanelFiltros } from "./PanelFiltros";
import { SeccionCosto } from "./SeccionCosto";
import { SeccionMapa } from "./SeccionMapa";
import { TablaTramos } from "./TablaTramos";
import { PlanificadorProvider, usePlanificador } from "./store";

function Contenido() {
  const v = usePlanificador();
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
        <AlertDescription>{v.message}</AlertDescription>
      </Alert>

      {v.scenario && (
        <>
        <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-6">
          <PanelFiltros
            include={v.include}
            onTogglePriority={v.togglePriority}
            deshabilitado={v.deshabilitado}
            sinPrioridades={v.sinPrioridades}
            inicioVisible={v.inicioVisible}
            iniciosDisponibles={v.iniciosDisponibles}
            onElegirInicio={v.elegirInicio}
            fijarInicio={v.fijarInicio}
            onFijarInicioToggle={v.alternarFijarInicio}
            puedeFijar={v.puedeFijar}
            areaTramos={v.areaTramos}
            planEnCurso={v.planning}
            puedePlanificar={v.puedePlanificar}
            onPlan={v.plan}
          />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
          <SeccionMapa />
          <SeccionCosto />
          </div>
        </div>
          <TablaTramos
            totalTramos={v.scenario.segments.length}
            totalNodos={v.scenario.nodes.length}
            busqueda={v.busquedaTramo}
            onBusqueda={v.buscarTramo}
            soloVisibles={v.soloTramosVisibles}
            onSoloVisibles={v.alternarVisibles}
            areaTramos={v.areaTramos}
            filtrados={v.tramosFiltrados}
            paginaVisible={v.paginaVisible}
            totalPaginas={v.totalPaginas}
            prioridades={v.priorityBySegment}
            costo={v.cost}
            seleccionadoId={v.tramoSeleccionadoId}
            onSeleccionar={v.seleccionarTramo}
            deshabilitado={v.deshabilitado}
            onOverride={v.overridePriority}
            onPagina={v.irAPagina}
          />
        </>
      )}
    </main>
  );
}

export function Planificador({ gateway }: { gateway: ApiGateway }) {
  return (
    <PlanificadorProvider gateway={gateway}>
      <Contenido />
    </PlanificadorProvider>
  );
}
