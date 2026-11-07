import { LEYENDA_PRIORIDAD, type Prioridad } from "../../domain/types";

export function LeyendaPrioridades() {
  const items = (Object.keys(LEYENDA_PRIORIDAD) as Prioridad[]).map((prioridad) => (
    <li key={prioridad}>
      {LEYENDA_PRIORIDAD[prioridad].etiqueta} — {LEYENDA_PRIORIDAD[prioridad].patron}
    </li>
  ));
  return (
    <div>
      <h2>Leyenda de prioridades</h2>
      <ul>{items}</ul>
    </div>
  );
}
