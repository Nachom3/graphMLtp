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
    <div>
      <h2>Recorrido</h2>
      <p>
        {pasos.length} pasos — distancia total {costo.totalCostM} {costo.unit} (informada por el backend).
      </p>
      {costo.repeatedDistanceM !== undefined && (
        <p>Distancia en tramos repetidos: {costo.repeatedDistanceM} {costo.unit} (dato del backend).</p>
      )}
      {costo.mandatory && <p>Calles obligatorias cubiertas: {costo.mandatory.length}.</p>}
      {porcentajeCobertura !== null && <p>Cobertura: {porcentajeCobertura}% (informada por el backend).</p>}
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
