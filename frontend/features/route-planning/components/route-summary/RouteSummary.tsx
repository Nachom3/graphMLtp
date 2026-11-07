export function ResumenRecorrido({
  pasos,
  costo,
}: {
  pasos: { order: number; segmentId: string; repeated: boolean }[];
  costo: { totalCostM: number; unit: string };
}) {
  return (
    <div>
      <h2>Recorrido</h2>
      <p>
        {pasos.length} pasos — costo {costo.totalCostM} {costo.unit} (informado por el backend).
      </p>
      <ol>
        {pasos.map((paso) => (
          <li key={paso.order}>
            Paso {paso.order + 1}: tramo {paso.segmentId}
            {paso.repeated ? " (repetido)" : ""}
          </li>
        ))}
      </ol>
    </div>
  );
}
