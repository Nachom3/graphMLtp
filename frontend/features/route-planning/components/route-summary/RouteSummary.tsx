import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatDistance(value: number, unit: string) {
  const formatted = value.toLocaleString("es", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  return `${formatted} ${unit === "meters" ? "m" : unit}`;
}

export function ResumenRecorrido({
  pasos,
  costo,
  pasoActual = -1,
  onSelectPaso,
}: {
  pasos: { order: number; segmentId: string; repeated: boolean }[];
  costo: {
    totalCostM: number;
    unit: string;
    mandatory?: string[];
    repeatedDistanceM?: number;
    coverage?: number;
  };
  pasoActual?: number;
  onSelectPaso?: (paso: number) => void;
}) {
  const porcentajeCobertura =
    costo.coverage === undefined
      ? null
      : (costo.coverage * 100).toLocaleString("es", { maximumFractionDigits: 1 });

  return (
    <div className="mt-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Costo y pasos
      </h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <dt className="text-xs text-zinc-500">Distancia total</dt>
          <dd className="font-semibold text-zinc-900">
            {pasos.length} pasos · {formatDistance(costo.totalCostM, costo.unit)}
          </dd>
        </div>
        {costo.repeatedDistanceM !== undefined && (
          <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
            <dt className="text-xs text-teal-700">Tramos recorridos más de una vez</dt>
            <dd className="font-semibold text-teal-950">
              {formatDistance(costo.repeatedDistanceM, costo.unit)}
            </dd>
          </div>
        )}
        {costo.mandatory && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Calles obligatorias</dt>
            <dd className="font-semibold text-zinc-900">{costo.mandatory.length} cubiertas</dd>
          </div>
        )}
        {porcentajeCobertura !== null && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Cobertura</dt>
            <dd className="font-semibold text-zinc-900">{porcentajeCobertura}%</dd>
          </div>
        )}
      </dl>
      <ol className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto pr-1 text-sm">
        {pasos.map((paso) => {
          const activo = paso.order === pasoActual;
          const yaPasado = pasoActual >= 0 && paso.order < pasoActual && !activo;
          return (
            <li key={paso.order}>
              <button
                type="button"
                onClick={() => onSelectPaso?.(paso.order)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-left transition-colors",
                  activo
                    ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                    : yaPasado
                      ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
                      : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
                  paso.repeated && !activo && !yaPasado && "border-teal-200 bg-teal-50/60",
                )}
                aria-current={activo ? "step" : undefined}
              >
                <span>
                  Paso {paso.order + 1}: tramo {paso.segmentId}
                </span>
                {paso.repeated ? (
                  <Badge variant="secondary">repetido</Badge>
                ) : (
                  <span className="text-xs text-zinc-400">único</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
