import { Badge } from "@/components/ui/badge";

export function ResumenRecorrido({
  pasos,
  costo,
}: {
  pasos: { order: number; segmentId: string; repeated: boolean }[];
  costo: {
    totalCostM: number;
    unit: string;
    mandatory?: string[];
    repeatedDistanceM?: number;
    coverage?: number;
  };
}) {
  const porcentajeCobertura =
    costo.coverage === undefined
      ? null
      : (costo.coverage * 100).toLocaleString("es", { maximumFractionDigits: 1 });

  return (
    <div className="mt-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Recorrido</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
          <dt className="text-xs text-zinc-500">Distancia total</dt>
          <dd className="font-semibold text-zinc-900">
            {pasos.length} pasos — distancia total {costo.totalCostM} {costo.unit} (informada
            por el backend).
          </dd>
        </div>
        {costo.repeatedDistanceM !== undefined && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Tramos repetidos</dt>
            <dd className="font-semibold text-zinc-900">
              Distancia en tramos repetidos: {costo.repeatedDistanceM} {costo.unit} (dato del
              backend).
            </dd>
          </div>
        )}
        {costo.mandatory && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Cobertura obligatoria</dt>
            <dd className="font-semibold text-zinc-900">
              Calles obligatorias cubiertas: {costo.mandatory.length}.
            </dd>
          </div>
        )}
        {porcentajeCobertura !== null && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <dt className="text-xs text-zinc-500">Cobertura</dt>
            <dd className="font-semibold text-zinc-900">
              Cobertura: {porcentajeCobertura}% (informada por el backend).
            </dd>
          </div>
        )}
      </dl>
      <ol className="mt-3 flex max-h-56 flex-col gap-1 overflow-y-auto pr-1 text-sm">
        {pasos.map((paso) => (
          <li
            key={paso.order}
            className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-1.5"
          >
            <span>
              Paso {paso.order + 1}: tramo {paso.segmentId}
            </span>
            {paso.repeated ? (
              <Badge variant="secondary">(repetido)</Badge>
            ) : (
              <span className="text-xs text-zinc-400">único</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
