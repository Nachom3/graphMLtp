/**
 * Planificador: sidebar scrolleable (izq.) + mapa grande fijo (der.).
 *
 * En desktop el mapa queda a la vista mientras leés filtros, costo y tabla.
 * En mobile el mapa va arriba sticky y el resto scrollea debajo.
 */
"use client";

import { Alert, AlertDescription } from "../../../../components/ui/alert";
import type { ApiGateway } from "../../application/usecases";
import { PanelFiltros } from "./PanelFiltros";
import { SeccionCosto } from "./SeccionCosto";
import { SeccionMapa } from "./SeccionMapa";
import { SidebarInfo } from "./SidebarInfo";
import { TablaTramos } from "./TablaTramos";
import { PlanificadorProvider, usePlanificador } from "./store";

function TiritaPasos() {
  return (
    <ol className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Pasos de la demo">
      {[
        { n: "1", t: "Mirar prioridades" },
        { n: "2", t: "Simular circuito" },
        { n: "3", t: "Ver pasos en el mapa" },
      ].map((paso, i) => (
        <li
          key={paso.n}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-900"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
            {paso.n}
          </span>
          {paso.t}
          {i < 2 && <span className="sr-only">luego</span>}
        </li>
      ))}
    </ol>
  );
}

function Contenido() {
  const v = usePlanificador();
  return (
    <main className="flex min-h-[100dvh] w-full flex-1 flex-col lg:h-[100dvh] lg:max-h-[100dvh] lg:flex-row lg:overflow-hidden">
      {/* Sidebar: scrollea solo; el mapa no se va */}
      <aside className="order-2 flex w-full shrink-0 flex-col gap-4 border-zinc-200 bg-zinc-50 px-4 py-5 sm:px-5 lg:order-1 lg:h-full lg:w-[400px] lg:overflow-y-auto lg:border-r xl:w-[440px]">
        <header>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
            Demo de planificación
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
            Circuito de recolección
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            El árbol colorea prioridades. Simulá acá y mirá el recorrido en el mapa sin perderlo al
            scrollear.
          </p>
          <TiritaPasos />
        </header>

        <Alert role="status" aria-live="polite" className="border-zinc-200 bg-white">
          <AlertDescription>{v.message}</AlertDescription>
        </Alert>

        {v.scenario && (
          <>
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
            <SidebarInfo />
            <SeccionCosto />
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
      </aside>

      {/* Mapa: grande y fijo a la derecha (sticky arriba en mobile) */}
      <div className="relative order-1 z-10 h-[50vh] w-full shrink-0 bg-zinc-200 lg:order-2 lg:h-full lg:min-h-0 lg:flex-1 lg:self-stretch">
        {v.scenario ? (
          <SeccionMapa />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
            Cargando escenario…
          </div>
        )}
      </div>
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
