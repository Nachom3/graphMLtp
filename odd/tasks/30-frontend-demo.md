# #30 Frontend demo — conectada a API real

Objetivo: completar Next.js demo visualizando cálculos del backend. Rama `30-frontend-demo`, worktree `/home/nacho/Documentos/worktrees/30-frontend-demo`, base `61565d4` + contrato #29.
Pruebas: `npm test` / `vitest` + e2e contra backend real.

## Specs

- S1: «Completar la aplicación de planificación de recolección con Next.js, TypeScript, shadcn y Leaflet, reutilizando la arquitectura por features existente. La integración real depende de #29; los componentes y pruebas con gateway falso pueden avanzar en paralelo una vez acordado el contrato.»
- S2: «La aplicación usa el árbol elegido en #10; no necesita ofrecer un selector de otros clasificadores ni enviar datos de entrenamiento. El frontend visualiza los cálculos del backend y no vuelve a optimizar el recorrido.»
- S3: «Sustituir la página provisional por un flujo que obtenga el escenario, prediga prioridades y solicite un circuito para las prioridades elegidas y un nodo de inicio válido.»
- S4: «Adaptar el gateway HTTP al contrato final de #29; mantener los límites de dominio, aplicación, infraestructura y componentes, sin llamadas HTTP dispersas ni lógica de grafos en React.»
- S5: «Mostrar en el mapa las prioridades, los tramos incorporados como conexiones de tránsito y el recorrido final. Identificar destinos y tránsito sin tratar un tramo de cero contenedores como recolección; conservar orden y repeticiones devueltos.»
- S6: «Mostrar distancia total, distancia recorrida en tramos repetidos, cantidad de calles obligatorias cubiertas y porcentaje de cobertura según los datos y definiciones del backend. No recalcular el costo ni presentar la optimización como óptimo global del cartero rural.»
- S7: «La demo carga un escenario, obtiene prioridades del árbol y presenta un circuito y sus estadísticas a partir de la API real, sin entrenar desde la interfaz.»
- S8: «En un caso con dos zonas obligatorias conectadas por un tramo de cero contenedores, el mapa muestra ese tramo como tránsito y no como destino; el orden, repeticiones y distancias coinciden con el backend.»

## Tasks

- T1 [S1,S3,S4] ruta: worker; estado: pendiente — Flujo escenario->predecir->planificar + httpGateway al contrato #29.
- T2 [S5,S6] ruta: worker; estado: pendiente — Mapa Leaflet prioridades/tránsito/recorrido + estadísticas backend sin recalcular.
- T3 [S7,S8] ruta: worker; estado: pendiente — Tests con gateway falso + e2e contra API real y docs README.

## Log

- L1: «3. Al final: #30 — frontend y demo (https://github.com/Nachom3/graphMLtp/issues/30), conectado a la API real.»
- L2: «Listo, trae main y arranco. FULL AUTO.»
- L3: «No voy a estar en la pc asi que no pidas permisos de nada porque no voy a estar»
