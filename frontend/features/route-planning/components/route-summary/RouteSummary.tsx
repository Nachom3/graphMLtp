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
        {pasos.map((paso) => (
          <li key={paso.orden}>
            Paso {paso.orden + 1}: tramo {paso.tramoId}
            {paso.repetido ? " (repetido)" : ""}
          </li>
        ))}
      </ol>
    </div>
  );
}
