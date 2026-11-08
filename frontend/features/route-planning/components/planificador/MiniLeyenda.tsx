/**
 * Mini-leyenda flotante pegada al mapa: 3–4 ítems según el modo activo.
 */
import type { ModoMapa } from "../map-view-client/mapStyles";

const ITEMS: Record<ModoMapa, { color: string; label: string; dashed?: boolean }[]> = {
  prioridad: [
    { color: "#dc2626", label: "Alta" },
    { color: "#d97706", label: "Media" },
    { color: "#2563eb", label: "Baja" },
  ],
  recorrido: [
    { color: "#047857", label: "Paso actual" },
    { color: "#0f766e", label: "Repetido" },
    { color: "#52525b", label: "Tránsito", dashed: true },
  ],
  contenedores: [
    { color: "#38bdf8", label: "≤2 días" },
    { color: "#f59e0b", label: "3–5 días" },
    { color: "#dc2626", label: "≥6 días" },
  ],
};

export function MiniLeyenda({ modo }: { modo: ModoMapa }) {
  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-md border border-zinc-200 bg-white/95 p-2 text-xs shadow-sm"
      aria-hidden
    >
      <p className="mb-1 font-semibold uppercase tracking-wide text-zinc-500">
        {modo === "prioridad" ? "Prioridad" : modo === "recorrido" ? "Recorrido" : "Contenedores"}
      </p>
      <ul className="space-y-1 text-zinc-700">
        {ITEMS[modo].map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-6 shrink-0"
              style={{
                borderTop: item.dashed ? `2px dashed ${item.color}` : `3px solid ${item.color}`,
              }}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
