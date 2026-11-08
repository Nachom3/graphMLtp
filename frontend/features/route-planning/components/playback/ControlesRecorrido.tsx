/**
 * Controles de reproducción del vehículo sobre el recorrido.
 * Presentacional: el estado (paso actual, reproducción) vive en la página.
 */
export function ControlesRecorrido({
  total,
  actual,
  reproduciendo,
  tramoActual,
  alReiniciar,
  alAnterior,
  alReproducirPausar,
  alSiguiente,
  alSaltar,
}: {
  total: number;
  actual: number;
  reproduciendo: boolean;
  tramoActual?: string;
  alReiniciar: () => void;
  alAnterior: () => void;
  alReproducirPausar: () => void;
  alSiguiente: () => void;
  alSaltar: (paso: number) => void;
}) {
  const botonSecundario =
    "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div
      className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
      role="group"
      aria-label="Reproducción del recorrido paso a paso"
    >
      <p className="text-sm font-medium text-zinc-800">Visualización paso a paso</p>
      <p className="mt-1 text-sm text-zinc-600" aria-live="polite">
        {actual >= 0 && tramoActual
          ? `Paso ${actual + 1} de ${total}: tramo ${tramoActual}`
          : "El mapa muestra el circuito completo. Reproducí el recorrido para ver cada tramo."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={alReiniciar}
          disabled={actual < 0 && !reproduciendo}
          className={botonSecundario}
        >
          Reiniciar
        </button>
        <button
          type="button"
          onClick={alAnterior}
          disabled={actual <= 0}
          className={botonSecundario}
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={alReproducirPausar}
          className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {reproduciendo && actual < total - 1
            ? "Pausar"
            : actual >= total - 1
              ? "Reproducir de nuevo"
              : actual >= 0
                ? "Continuar"
                : "Reproducir recorrido"}
        </button>
        <button
          type="button"
          onClick={alSiguiente}
          disabled={actual >= total - 1}
          className={botonSecundario}
        >
          Siguiente
        </button>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(total - 1, 0)}
        value={Math.max(actual, 0)}
        onChange={(event) => alSaltar(Number(event.target.value))}
        aria-label="Paso del recorrido"
        className="mt-3 w-full accent-emerald-700"
        disabled={total === 0}
      />
    </div>
  );
}
