"use client";

import dynamic from "next/dynamic";

/**
 * Frontera cliente de Leaflet: el mapa real solo se carga en cliente.
 * Recibe el MapViewModel (puro), nunca entidades crudas del backend.
 * Sin página demo en este issue; este componente queda listo para el
 * trabajo posterior.
 */
export const MapView = dynamic(() => import("../map-view-client"), { ssr: false });
