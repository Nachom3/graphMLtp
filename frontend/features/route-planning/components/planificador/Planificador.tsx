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

function TiritaPasos() {
  return (
    <ol className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Pasos de la demo">
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
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          Demo de planificación
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          Planificá un circuito de recolección
        </h1>
        <p className="mt-3 text-zinc-600">
          El árbol colorea cada tramo por prioridad. Simulá el circuito en esta zona y miralo paso a
          paso en el mismo mapa, con contenedores e inicio marcados.
        </p>
        <TiritaPasos />
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
