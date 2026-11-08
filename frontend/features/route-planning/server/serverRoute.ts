import "server-only";

import { crearHttpGateway } from "../infrastructure/httpGateway";
import { calcularRecorridoSSRConGateway, type ResultadoRecorridoSSR } from "./serverRouteCore";

/** Ejecuta el circuito exclusivamente en el servidor para el área indicada. */
export async function calcularRecorridoSSR(params: URLSearchParams): Promise<ResultadoRecorridoSSR> {
  const baseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return calcularRecorridoSSRConGateway(params, crearHttpGateway(baseUrl.replace(/\/$/, "")));
}
