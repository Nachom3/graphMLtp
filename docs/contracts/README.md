# Contratos API — nota frontend (issue #13)

> El backend es la fuente de verdad y habla inglés (`SegmentFeatures`,
> `Priority` low|medium|high, códigos `IMPOSSIBLE_ROUTE`,
> `PREDICTION_WITHOUT_SEGMENT`, `INVALID_DATASET`). El frontend sigue esos
> nombres en tipos, DTOs y errores.
>
> Divergencia conocida: **`docs/contracts/api-v1.md`** (sesión #12) sigue en
> español y describe un transporte que el backend aún no implementa. Cuando
> el backend publique su transporte, api-v1 debe actualizarse al inglés;
> mientras tanto, las rutas del frontend marcadas provisorias abajo son la
> propuesta a acordar con backend.

## Qué usa el frontend del backend

| Operación | Endpoint | Respuesta que presenta |
|---|---|---|
| Salud/versión | `GET /health` (existe en `api.py`) | `{status, version, schema}`; exige `v1` |
| Prioridades | `POST /predictions:predict` (provisoria) `{model_id, training_rows, segments}` | `predictions[]` 1:1 por `segment_id` |
| Recorrido | `POST /routes:plan` (provisoria) `{nodes, segments, priorities, include}` | `{order, repetitions, total_cost_m, unit}` → pasos con `repeated`, costo opaco |
| Comparación | — (offline) | El backend pide no llamar a comparar desde visualización: el frontend presenta `ModelComparison` ya calculado (datos versionados) |

## Reglas (las define el backend)

1. **Costo:** `total_cost_m` (suma con repeticiones, `unit: "meters"`). El frontend
   lo presenta tal cual; nunca recalcula ni optimiza.
2. **Selección válida:** la valida el backend (`include`, `422` si imposible).
   El frontend envía la selección y presenta errores tipados.
   `arbol`/`logistica` exigen `training_rows` (sin ellas el backend
   devuelve `422`); `rule-v1` no las necesita y acepta `[]`.
3. **Orden/frescura:** el frontend guarda cada respuesta con su `requestId`
   y solo aplica la vigente (test de carrera incluido).
4. **IDs:** `segment_id` estable (`reftramo` IDE; `T0001`… solo aliases
   de fixture, iguales a los CSV del backend), `node_id` `N0001…`, WGS84, `length_m` en metros.
5. **Valores:** prioridades `low`/`medium`/`high`, zonas
   `residential`/`commercial`/`industrial` (idénticas en CSVs y código).

## Errores

El backend define `IMPOSSIBLE_ROUTE`, `PREDICTION_WITHOUT_SEGMENT`,
`INVALID_DATASET` (ver `backend/src/collection/domain/errors/`). El adaptador
HTTP los mapea a códigos estables de presentación (`impossible-route`,
`prediction-without-segment`, `invalid-dataset`, `backend`, …) — ver
`httpGateway.ts`. Sin equivalente backend (todavía): `EVALUACION_INVALIDA` y
`MODELO_DESCONOCIDO` de api-v1; caen a `backend` genérico.

## Tipos TS

Derivados del dominio backend en `frontend/features/route-planning/domain/types.ts`.
Si el transporte backend cambia, se actualizan tipos + gateway + fixtures,
sin tocar casos de uso.
