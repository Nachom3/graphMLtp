import { Alert, AlertDescription } from "../ui/alert";

type EstadoVisible =
  | { estado: "ociosa" }
  | { estado: "carga"; requestId?: number }
  | { estado: "vacio"; motivo: string }
  | { estado: "exito"; requestId?: number }
  | { estado: "error"; requestId?: number; error: { code: string; detail?: string } };

/** Texto accesible por estado sin depender de tipos de ninguna feature. */
export function textoEstado(estado: EstadoVisible): string {
  switch (estado.estado) {
    case "ociosa":
      return "Sin solicitud todavía.";
    case "carga":
      return "Cargando…";
    case "vacio":
      return `Sin resultados: ${estado.motivo}.`;
    case "exito":
      return "Listo.";
    case "error":
      return `Error (${estado.error.code}): ${estado.error.detail ?? "reintentá la solicitud"}.`;
  }
}

export function EstadoVista({ estado }: { estado: EstadoVisible }) {
  return (
    <Alert role="status">
      <AlertDescription>{textoEstado(estado)}</AlertDescription>
    </Alert>
  );
}
