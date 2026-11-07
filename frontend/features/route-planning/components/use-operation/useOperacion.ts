"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ApiGateway, RequestStore } from "../../application/usecases";
import { RequestStore as Store } from "../../application/usecases";
import type { EstadoOperacion } from "../../domain/types";

/**
 * Hook genérico: ejecuta un caso de uso con el gateway inyectado,
 * guarda requestId vigente y aborta la solicitud anterior.
 * Fuente de verdad mínima, sin store global.
 */
export function useOperacion<T, A extends unknown[]>(
  gateway: ApiGateway,
  caso: (
    gw: ApiGateway,
    store: RequestStore,
    ...args: [...A, AbortSignal?]
  ) => Promise<EstadoOperacion<T>>,
): [EstadoOperacion<T> | { estado: "ociosa" }, (...args: A) => Promise<void>] {
  const storeRef = useRef<Store | null>(null);
  if (!storeRef.current) storeRef.current = new Store();
  const abortRef = useRef<AbortController | null>(null);
  const [estado, setEstado] = useState<EstadoOperacion<T> | { estado: "ociosa" }>({
    estado: "ociosa",
  });
  const correr = useCallback(
    async (...args: A) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setEstado({ estado: "carga", requestId: -1 });
      const res = await caso(gateway, storeRef.current!, ...args, ctrl.signal);
      setEstado(res);
    },
    [gateway, caso],
  );
  return useMemo(() => [estado, correr] as const, [estado, correr]);
}
