import type { EstadoOperacion } from "../domain/types";
import { LEYENDA_PRIORIDAD, type Prioridad } from "../domain/types";

/** Texto accesible por estado (nunca solo color). */
export function textoEstado<T>(e: EstadoOperacion<T> | { estado: "ociosa" }): string {
  switch (e.estado) {
    case "ociosa":
      return "Sin solicitud todavía.";
    case "carga":
      return "Cargando…";
    case "vacio":
      return `Sin resultados: ${e.motivo}.`;
    case "exito":
      return "Listo.";
    case "error":
      return `Error (${e.error.codigo}): ${e.error.detalle ?? "reintentá la solicitud"}.`;
  }
}

export function EstadoVista<T>({ estado }: { estado: EstadoOperacion<T> | { estado: "ociosa" } }) {
  return <p role="status">{textoEstado(estado)}</p>;
}

export function LeyendaPrioridades() {
  const items = (Object.keys(LEYENDA_PRIORIDAD) as Prioridad[]).map((p) => (
    <li key={p}>
      {LEYENDA_PRIORIDAD[p].etiqueta} — {LEYENDA_PRIORIDAD[p].patron}
    </li>
  ));
  return (
    <div>
      <h2>Leyenda de prioridades</h2>
      <ul>{items}</ul>
    </div>
  );
}

export function ResumenRecorrido({
  pasos,
  costo,
}: {
  pasos: { orden: number; tramoId: string; repetido: boolean }[];
  costo: { valor: number; unidad: string };
}) {
  return (
    <div>
      <h2>Recorrido</h2>
      <p>
        {pasos.length} pasos — costo {costo.valor} {costo.unidad} (informado por el backend).
      </p>
      <ol>
        {pasos.map((p) => (
          <li key={p.orden}>
            Paso {p.orden + 1}: tramo {p.tramoId}
            {p.repetido ? " (repetido)" : ""}
          </li>
        ))}
      </ol>
    </div>
  );
}
