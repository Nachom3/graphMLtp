# #29 API v1 — integrar #27+#28

Objetivo: completar FastAPI para conectar frontend con carga, predicción árbol y planificador. Rama `29-api-v1`, worktree `/home/nacho/Documentos/worktrees/29-api-v1`, base `61565d4`.
Pruebas: `python -m pytest backend/tests/ -q`.

## Specs

- S1: «Completar la API v1 de FastAPI para conectar el frontend con la carga de datos, la predicción por árbol y el planificador de recorridos. Depende de #27 y #28; no rehacer allí sus algoritmos ni sus casos de uso.»
- S2: «La documentación de contrato y el gateway actual no coinciden en rutas y nombres, y el transporte de main es una plantilla. Definir un único contrato implementado y documentado, alineado con el dominio y DTOs en inglés del backend, conservando textos de interfaz en español. No recibir filas de entrenamiento para predecir ni entrenar desde una solicitud.»
- S3: «Implementar composición explícita e inyección de dependencias existentes. El transporte valida formas, traduce DTOs y errores y delega; no contiene lógica de negocio, entrenamiento ni algoritmos de grafos.»
- S4: «Implementar salud/versiones y operaciones documentadas para obtener el escenario del piloto, predecir prioridades con el árbol y planificar la ruta; acordar rutas y campos concretos con el gateway. El cliente no proporciona rutas arbitrarias del sistema de archivos.»
- S5: «En la planificación distinguir destinos con contenedores de tramos de tránsito, recibir la selección de prioridades y nodo de inicio y devolver pasos ordenados, IDs, repeticiones, costos y datos de cobertura suficientes para la interfaz.»
- S6: «Definir y probar respuestas para datos inválidos, modelo no disponible, ausencia de destinos y desconexión real en el grafo completo. Actualizar el contrato anterior que trataba como imposible un subgrafo obligatorio desconectado, pues ahora puede conectarse mediante tránsito.»
- S7: «Pruebas HTTP con datos de prueba cubren salud, escenario, predicción 1:1, planificación y errores tipados; las respuestas concuerdan con el contrato publicado.»
- S8: «Un caso con dos componentes obligatorias unidas por tránsito se procesa sin tratar la calle con cero contenedores como destino. Se conservan orden, claves/IDs de tramos, repeticiones y costos del planificador.»
- S9: «Ningún endpoint de visualización llama a entrenamiento y un pipeline no disponible produce un error documentado.»
- S10: «Los límites de dominio, aplicación, adaptadores y transporte se mantienen; pruebas y documentación acompañan la implementación.»

## Tasks

- T1 [S1,S3,S4] ruta: worker; estado: pendiente — Cablear composition (plan_route con NetworkX real) y FastAPI transporte salud/escenario/predicción/planificación.
- T2 [S5,S6,S7,S8,S9] ruta: worker; estado: pendiente — Tests HTTP TestClient con fixtures incl. dos componentes por tránsito y errores tipados.
- T3 [S2,S10] ruta: worker; estado: pendiente — Alinear docs/contracts/api-v1.md, README, OpenAPI y ejemplos.

## Log

- L1: «Haz estos dos issues, en orden, usando subagentes y verificado, Cada uno un worktree»
- L2: «2. Después: #29 — API v1 (https://github.com/Nachom3/graphMLtp/issues/29), integrando ambos resultados.»
- L3: «Listo, trae main y arranco. FULL AUTO.»
- L4: Base main 61565d4 incluye PR #31 (#27) y PR #32 (#28); 43 passed en backend/tests; explorers reportan lógica #27/#28 PASS salvo composition plan_route TODO que resuelve #29.
