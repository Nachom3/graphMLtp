import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEYENDA_PRIORIDAD, type Priority } from "../../domain/types";

/** Color usado en el mapa para cada prioridad (ver MapViewCliente). */
const COLOR: Record<Priority | "transito", string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#2563eb",
  transito: "#52525b",
};

const ESTILO_LINEA: Record<Priority | "transito", string> = {
  high: "solid",
  medium: "dashed",
  low: "dotted",
  transito: "dashed",
};

function Muestra({ clave }: { clave: Priority | "transito" }) {
  return (
    <span
      aria-hidden
      className="inline-block h-0 w-10 shrink-0"
      style={{ borderTop: `3px ${ESTILO_LINEA[clave]} ${COLOR[clave]}` }}
    />
  );
}

export function LeyendaPrioridades() {
  const items = Object.keys(LEYENDA_PRIORIDAD) as Priority[];
  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Leyenda de prioridades
      </h2>
      <ul className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
        {items.map((prioridad) => (
          <li key={prioridad} className="flex items-center gap-2">
            <Muestra clave={prioridad} />
            <Badge
              className={cn(
                "border-transparent text-xs font-medium text-white",
                prioridad === "high" && "bg-red-600",
                prioridad === "medium" && "bg-amber-600",
                prioridad === "low" && "bg-blue-600",
              )}
            >
              {LEYENDA_PRIORIDAD[prioridad].etiqueta} — {LEYENDA_PRIORIDAD[prioridad].patron}
            </Badge>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <Muestra clave="transito" />
          <span>Conexión de tránsito — gris discontinua; no es una recolección</span>
        </li>
        <li className="flex items-center gap-2 text-zinc-600">
          <span aria-hidden className="inline-block h-0 w-10 shrink-0 border-t-[3px] border-zinc-400" />
          <span>Destino obligatorio — prioridad alta/media/baja</span>
        </li>
      </ul>
    </div>
  );
}
