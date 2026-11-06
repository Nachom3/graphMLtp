# Contratos API — nota frontend (issue #13)

> El contrato canónico es **`docs/contracts/api-v1.md`** (sesión #12, backend).
> Este archivo documenta cómo el frontend lo consume. Ante divergencia, manda api-v1.

## Qué usa el frontend de api-v1

| Operación | Endpoint | Respuesta que presenta |
|---|---|---|
| Salud/versión | `GET /salud` | `{estado, version, esquema}`; exige `v1` |
| Prioridades | `POST /predicciones:predecir` `{modelo_id, tramos}` | `predicciones[]` 1:1 por `tramo_id` |
| Recorrido | `POST /recorridos:planificar` `{nodos, tramos, prioridades, incluir}` | `{orden, repeticiones, costo_total_m, unidad}` → pasos con `repetido`, costo opaco |
| Comparación | — (offline) | api-v1 pide no llamar a `/modelos/comparar` desde visualización: el frontend presenta resultados ya calculados (datos versionados) |

## Reglas (las define el backend)

1. **Costo:** `costo_total_m` (suma con repeticiones, metros). El frontend
   lo presenta tal cual; nunca recalcula ni optimiza.
2. **Selección válida:** la valida el backend (`incluir`, `422` si imposible).
   El frontend envía la selección y presenta errores tipados.
3. **Orden/frescura:** el frontend guarda cada respuesta con su `requestId`
   y solo aplica la vigente (test de carrera incluido).
4. **IDs:** `tramo_id` estable (`reftramo` IDE; `T0001`/`R-101` solo aliases
   de fixture), `nodo_id` `N0001…`, WGS84, `longitud_m` en metros.

## Errores

api-v1 envuelve en `{"detail": {"codigo", "detalle"}}` con códigos
`RECORRIDO_IMPOSIBLE`, `PREDICCION_SIN_TRAMO`, `MODELO_DESCONOCIDO`,
`DATASET_INVALIDO`, `EVALUACION_INVALIDA` (+ Pydantic). El adaptador HTTP
los mapea a códigos estables de presentación (`recorrido-imposible`,
`tramo-desconocido`, `backend`, …) — ver `httpGateway.ts`.

## Tipos TS

Derivados de api-v1 en `frontend/src/domain/types.ts`. Si api-v1 cambia,
se actualizan tipos + gateway + fixtures, sin tocar casos de uso.
