import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEYENDA_PRIORIDAD, type Priority } from "../../domain/types";

/** Color usado en el mapa para cada prioridad (ver MapViewCliente). */
const COLOR: Record<Priority | "transito" | "repetido" | "actual" | "seleccion", string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#2563eb",
  transito: "#52525b",
  repetido: "#0f766e",
  actual: "#047857",
  seleccion: "#7c3aed",
};

function MuestraLinea({
  color,
  estilo = "solid",
  grueso = 3,
  contorno,
}: {
  color: string;
  estilo?: "solid" | "dashed" | "dotted";
  grueso?: number;
  contorno?: string;
}) {
  return (
    <span className="relative inline-flex h-3 w-12 shrink-0 items-center" aria-hidden>
      {contorno && (
        <span
          className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          style={{ borderTop: `8px solid ${contorno}`, opacity: 0.45 }}
        />
      )}
      <span
        className="absolute inset-x-0 top-1/2 -translate-y-1/2"
        style={{
          borderTop: `${grueso}px ${estilo} ${color}`,
        }}
      />
    </span>
  );
}

/**
 * Leyenda en dos capas: (1) color = prioridad del tramo;
 * (2) marcas encima = rol en el recorrido. La repetición no es otra calle.
 */
export function LeyendaPrioridades() {
  const items = Object.keys(LEYENDA_PRIORIDAD) as Priority[];
  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Cómo leer el mapa
      </h2>
      <p className="mt-2 text-sm text-zinc-600">
        Una misma calle puede verse con varias marcas: el color es la prioridad; el contorno
        verde agua indica que el camión la recorre más de una vez (no es una calle extra).
      </p>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        1. Prioridad del tramo
      </h3>
      <ul className="mt-2 grid gap-2 text-sm text-zinc-700 sm:grid-cols-3">
        {items.map((prioridad) => (
          <li key={prioridad} className="flex items-center gap-2">
            <MuestraLinea
              color={COLOR[prioridad]}
              estilo={
                prioridad === "medium" ? "dashed" : prioridad === "low" ? "dotted" : "solid"
              }
              grueso={prioridad === "high" ? 5 : 3}
            />
            <Badge
              className={cn(
                "border-transparent text-xs font-medium text-white",
                prioridad === "high" && "bg-red-600",
                prioridad === "medium" && "bg-amber-600",
                prioridad === "low" && "bg-blue-600",
              )}
            >
              {LEYENDA_PRIORIDAD[prioridad].etiqueta}
            </Badge>
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        2. Rol en el recorrido (misma calle)
      </h3>
      <ul className="mt-2 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
        <li className="flex items-center gap-2">
          <MuestraLinea color={COLOR.high} grueso={4} contorno={COLOR.repetido} />
          <span>
            <strong className="font-medium">Repetición</strong> — contorno verde agua detrás del
            color de prioridad
          </span>
        </li>
        <li className="flex items-center gap-2">
          <MuestraLinea color={COLOR.transito} estilo="dashed" grueso={3} />
          <span>
            <strong className="font-medium">Tránsito</strong> — gris discontinuo; conecta, no
            recolecta
          </span>
        </li>
        <li className="flex items-center gap-2">
          <MuestraLinea color={COLOR.actual} grueso={5} />
          <span>
            <strong className="font-medium">Paso actual</strong> — verde esmeralda del camión
          </span>
        </li>
        <li className="flex items-center gap-2">
          <MuestraLinea color={COLOR.seleccion} grueso={5} />
          <span>
            <strong className="font-medium">Seleccionado</strong> — clic en el mapa para editar
            prioridad
          </span>
        </li>
      </ul>
    </div>
  );
}
