/**
 * Composición de la demo: crea el gateway HTTP real e inyecta el puerto.
 *
 * Es el único lugar que conoce la infraestructura concreta; el
 * Planificador puro solo depende del puerto ApiGateway (DIP).
 */
"use client";

import { useState } from "react";
import { crearHttpGateway } from "../../infrastructure/httpGateway";
import { Planificador } from "./Planificador";

export default function PlanificadorDemo() {
  const [gateway] = useState(() =>
    crearHttpGateway(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"),
  );
  return <Planificador gateway={gateway} />;
}
