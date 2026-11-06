# Contrato API v1 (fuente de verdad para el frontend #13)

Base: la API expone los casos de uso del backend; el frontend **visualiza**
lo que el backend calcula. Versiones: API `v1` + esquema dataset `v1`.
OpenAPI generado en `/openapi.json` (FastAPI); este documento manda ante
cualquier duda.

## Identificadores y versiones

- `tramo_id`: estable (`reftramo` IDE en #9; `T0001`… solo en fixtures).
- `nodo_id`: estable (`N0001`…).
- `modelo_id`: `arbol` | `logistica` | `regla-v1` (demo; #10 agrega reales).
- Toda respuesta de escritura incluye lo pedido; `version: "v1"` en `/salud`.

## Geometrías y unidades

- Nodos: `lon`/`lat` WGS84 (EPSG:4326).
- Tramos: `longitud_m` en **metros** (geodésica en #9; metros directos en fixture).
- Recorrido: `orden` (tramo_ids en visita, con repeticiones incluidas),
  `repeticiones` (tramo_ids visitados más de una vez),
  `costo_total_m` (suma con repeticiones, metros).

## Endpoints

### `GET /salud` → `{estado, version, esquema}`

### `POST /dataset/validar`

```json
{"fuente": "<directorio con nodos.csv+tramos.csv>", "version_esquema": "v1"}
```

→ `{"valido": true, "n_nodos": 6, "n_tramos": 12}`.

### `POST /modelos/comparar` (offline; no llamar desde visualización)

```json
{"filas": [{"tipo_zona": "comercial", "cantidad_contenedores": 2,
  "dias_desde_ultima_recoleccion": 4, "historico_quejas_vecinales": 2,
  "prioridad_recoleccion": "alta"}],
 "configs": ["arbol", "logistica"], "semilla": 0}
```

→ `{"metricas": [{"modelo_id": "arbol", "accuracy": 0.67,
"precision_macro": 0.5, "recall_macro": 0.5, "f1_macro": 0.5,
"matriz_confusion": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
"n_train": 9, "n_test": 3}],
"baseline_accuracy": 0.33, "mejor_por_cv": "arbol", "registro": {...}}`.

`registro`: `n_filas`, `test_size`, `semilla`, `cv_folds_pedidos/usados`,
`cv_accuracy_media_train`, `baseline_mayoria_test`, `versiones`.

### `POST /predicciones:predecir`

```json
{"modelo_id": "arbol", "filas_entrenamiento": [...],
 "tramos": [{"tramo_id": "T0001", "nodo_origen": "N0001",
   "nodo_destino": "N0002", "longitud_m": 85.5, "tipo_zona": "residencial",
   "cantidad_contenedores": 1, "dias_desde_ultima_recoleccion": 2,
   "historico_quejas_vecinales": 0}]}
```

→ `{"modelo_id": "arbol", "predicciones":
[{"tramo_id": "T0001", "prioridad": "baja"}]}` (1:1 por `tramo_id`).

`regla-v1` no necesita `filas_entrenamiento`.

### `POST /recorridos:planificar`

```json
{"nodos": [{"nodo_id": "N0001", "lon": -56.155, "lat": -34.91}],
 "tramos": [...], "prioridades": {"T0001": "baja"},
 "incluir": ["media", "alta"]}
```

→ `{"orden": ["T0002", ...], "repeticiones": ["T0005"],
"costo_total_m": 864.6, "unidad": "metros"}`.

## Métricas (para mostrar en UI)

Por modelo: `accuracy`, `precision_macro`, `recall_macro`, `f1_macro`,
`matriz_confusion` (filas=reales, columnas=predichas, orden baja/media/alta),
`baseline_accuracy`. Elegir modelos por `mejor_por_cv`, nunca por test.

## Errores (códigos estables)

| HTTP | `codigo` | Cuándo |
|---|---|---|
| 422 | `DATASET_INVALIDO` | fuente ilegible, esquema ≠ v1, invariantes |
| 422 | `EVALUACION_INVALIDA` | pocas filas, configs vacío, datos mal formados |
| 422 | `MODELO_DESCONOCIDO` | sklearn sin `filas_entrenamiento` / config rara |
| 422 | `PREDICCION_SIN_TRAMO` | salida del predictor inconsistente |
| 422 | `RECORRIDO_IMPOSIBLE` | selección vacía o subgrafo desconexo |
| 422 | validación Pydantic | forma inválida (falta campo, `longitud_m <= 0`, etc.) |

Forma: `{"detail": {"codigo": "...", "detalle": "..."}}`.

## Ejemplo mínimo (fixture local)

Ver `backend/tests/fixtures/` y `notebooks/12_arquitectura_backend.ipynb`.
Levantar: `uvicorn recoleccion.api:app --reload --app-dir backend/src`.
