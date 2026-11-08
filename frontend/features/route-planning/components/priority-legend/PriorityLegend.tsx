import { LEYENDA_PRIORIDAD, type Priority } from "../../domain/types";

export function LeyendaPrioridades() {
  const items = (Object.keys(LEYENDA_PRIORIDAD) as Priority[]).map((prioridad) => (
    <li key={prioridad}>
      {LEYENDA_PRIORIDAD[prioridad].etiqueta} — {LEYENDA_PRIORIDAD[prioridad].patron}
    </li>
  ));
  return (
    <div>
      <h2>Leyenda de prioridades</h2>
      <ul>
        {items}
        <li>Destino obligatorio — prioridad alta/media/baja</li>
        <li>Conexión de tránsito — gris discontinua; no es una recolección</li>
      </ul>
    </div>
  );
}
