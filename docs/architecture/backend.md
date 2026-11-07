# Arquitectura del backend (issue #12)

v1: Python, CSV, pandas/scikit-learn y FastAPI; sin base de datos ni ORM.
Jupyter y la API son puntos de entrada al mismo código reutilizable
(`backend/src/collection/`); no dos implementaciones diferentes.

## Capas y dependencias permitidas

```text
Jupyter / FastAPI  (puntos de entrada, sin lógica de negocio)
        ↓
composición        (arma casos de uso con adaptadores concretos)
        ↓
aplicación         (casos de uso + Protocol; solo conoce dominio)
        ↓
dominio            (tipos, regla v1, invariantes; Python puro)
        ↑
adaptadores        (CSV, sklearn, networkx, artefactos; implementan Protocols)
```

Reglas:

- Las dependencias de código apuntan hacia dominio/aplicación.
- Dominio y aplicación **no** importan FastAPI, pandas, sklearn ni networkx.
- Todo lo científico queda detrás de los contratos, en `adaptadores.py`.
- Sin objetos HTTP ni estructuras del framework dentro del dominio.

## Responsabilidades

| Capa | Responsabilidad | No hace |
|---|---|---|
| dominio (`dominio.py`) | ids estables, `Prioridad`/`TipoZona`, regla v1, invariantes, asociación inequívoca predicción↔tramo | I/O, HTTP, ML |
| aplicación (`aplicacion/`) | 4 casos de uso con contratos abstractos y ejecuciones concretas bajo `casos_uso/`; puertos `LectorDataset`, `EvaluadorModelos`, `PredictorPrioridades`, `PlanificadorRecorrido` | I/O, HTTP, sklearn, grafos concretos |
| adaptadores (`adaptadores.py`) | `CsvLectorDataset`, `SklearnEvaluador`, `SklearnPredictor`, `PredictorReglaV1`, `NetworkxPlanificador`, `guardar_registro` | decidir políticas (solo ejecutan) |
| composición (`composicion.py`) | inyección explícita por función (`cargar_dataset_v1`, `comparar_demos`, `predecir_con`, `planificar`) | lógica de negocio |
| transporte (`api.py`) | validación de formas (Pydantic), traducción a dominio, códigos de error del contrato | entrenar fuera de lo pedido, lógica de negocio |

## Casos de uso (resumen verificable)

Los casos de uso se organizan bajo `collection.application.use_cases`.
Su implementación e integración se completan en los issues correspondientes.

| Caso de uso | Entrada → salida | Errores |
|---|---|---|
| Validar/cargar dataset | fuente + versión esquema → nodos y tramos válidos | `DATASET_INVALIDO` (fuente ilegible, esquema incompatible, invariantes) |
| Comparar modelos | filas + configs + protocolo → métricas, baseline y registro | `ValueError` (pocas filas, configs vacío); `EVALUACION_INVALIDA` en API |
| Predecir prioridades | modelo_id + features válidas → prioridad por tramo | `PREDICCION_SIN_TRAMO` / `MODELO_DESCONOCIDO` |
| Planificar recolección | grafo + prioridades + config → orden, repeticiones, costo | `RECORRIDO_IMPOSIBLE` (vacío, desconexo) |

Separación offline/inferencia: comparar/entrenar es **offline**; una consulta
de visualización (`GET /salud`, predecir, planificar) jamás entrena.

## Cada abstracción y su sustitución concreta

- `LectorDataset`: `CsvLectorDataset` ↔ `LectorFalso` (tests) sin tocar el caso de uso.
- `EvaluadorModelos`: `SklearnEvaluador` ↔ `EvalFalso` (tests, sin sklearn).
- `PredictorPrioridades`: `SklearnPredictor` ↔ `PredictorReglaV1` (sin entrenar) ↔ `PredictorFalso`.
- `PlanificadorRecorrido`: `NetworkxPlanificador` ↔ `PlanificadorFalso`.
- Los puertos siguen siendo `Protocol` estrechos; los casos de uso tienen
  contratos abstractos explícitos y sus implementaciones se pueden ejercitar
  directamente con fakes, sin sklearn ni NetworkX.

## Evaluación reproducible (objetivo #18 y #10)

**Estado:** #18 y #10 están implementados. #18 vive en
`collection.adapters.datasets.ml_preparation`; #10 en
`collection.adapters.models` (`model_specs`, `sklearn_evaluator`,
`sklearn_predictor`) con protocolo, métricas y comparación en
`collection.application.models` y delegación en
`application.use_cases.compare_models`. `EvaluationProtocol.test_size`
queda como alias legado: el reparto real es el 60/20/20 de #18.

1. **#18:** `prepare_dataset(source, seed=0)` lee el CSV sin modificarlo,
   valida y prepara en memoria quejas sintéticas anónimas por contenedor,
   etiqueta construida, `X`/`y`, particiones 60/20/20 con IDs/distribuciones y
   `ColumnTransformer` sin ajustar. En el CSV actual: 178/59/60 filas.
2. **#10:** `SklearnEvaluator.evaluate` compara con validación cruzada
   estratificada solo dentro del train (5 pedidos; `cv_folds_usados` según la
   clase menos frecuente; error si no hay al menos 2 folds) y `GridSearchCV`
   con grilla pequeña en esos folds, sin tocar validación ni test. En el CSV
   actual: pedidos 5, usados 5. Elegido por validación: `arbol`
   (val F1 1.0 vs 0.9268 de `logistica`); test un solo uso en
   `evaluate_final_on_test` (arbol acc/F1 1.0). Detalle:
   `docs/modelo-comparacion.md`.
3. Usar el 20 % de validación para contrastar y elegir el modelo. Evaluar el
   modelo elegido **una sola vez** con el 20 % de test; no volver a ajustar
   decisiones mirando ese resultado.

El dataset base del #9 tiene 297 tramos y 43 de prioridad alta (14.5 %).
Con la etiqueta sintética nueva de #18 y seed 0, la distribución observada es
129 baja (43.4 %), 93 media (31.3 %) y 75 alta (25.3 %). #10 debe recalcular
su `cv_folds_usados` según la clase menos frecuente del train.

Toda transformación que aprenda de los datos va dentro del `Pipeline` y se
ajusta solo con el entrenamiento de cada fold. Usar `OneHotEncoder` para
`tipo_zona` y `StandardScaler` solo cuando el modelo lo requiera; dejar una
transformación sin ajustar disponible para CV. Reportar accuracy,
precisión/recall/F1 macro, matriz de confusión y una línea base de mayoría.
Registrar dataset, particiones, semilla, folds usados, resultados y versiones.

### Introducción a pipelines de scikit-learn

Un `Pipeline` encadena pasos de preparación y, cuando corresponda, un modelo.
Permite ajustar esos pasos con los datos de entrenamiento y repetir la misma
preparación al evaluar. Para este TP, el flujo previsto es:

```text
X: cantidad_contenedores, dias_desde_ultima_recoleccion,
   tipo_zona, historico_quejas_vecinales
  → ColumnTransformer
      tipo_zona → OneHotEncoder(handle_unknown="ignore")
      numéricas → pasan sin cambios
  → clasificador (#10)
```

`ColumnTransformer` permite tratar cada columna según su tipo. El encoder
aprende las categorías presentes durante el ajuste; si luego aparece una que
no vio, `handle_unknown="ignore"` la representa con ceros en sus columnas
codificadas. El escalado, si un modelo lo necesita, también va dentro del
pipeline; no se aplica indiscriminadamente.

En #18 se deja disponible el preprocesamiento **sin ajustar** y se puede usar
una copia ajustada solo con entrenamiento para transformar validación y,
cuando corresponda la evaluación final, test. En #10 se conecta un clasificador
al preprocesamiento y se entrega el pipeline completo **sin ajustar** a la
validación cruzada o a `GridSearchCV`. Así cada fold ajusta sus transformaciones
solo con su propia parte de entrenamiento, no con todos los datos.

## La etiqueta es construida (aviso obligatorio)

La etiqueta anterior del #9 y la nueva de #18 son sintéticas/construidas, no
prioridades operativas. #18 usa sorteos anónimos enteros `[0, 3]` por
contenedor representado con seed 0; score `2*dias + contenedores + zona_w +
2*quejas`; `zona_w={residencial: 0, industrial: 1, comercial: 2}`; baja `<=0`,
media `1..2`, alta `>2`. El modelo aprende esa regla: **una buena métrica no
demuestra utilidad operativa real**. La generalización temporal no se mide con
una única foto T0.

## Datos e inferencia del árbol (#27)

Carga e inferencia usan el árbol elegido en #10; comparar/entrenar sigue
siendo offline. `CsvDatasetReader` (stdlib `csv`, sin pandas) lee el
directorio `v1` (`nodos.csv` + `tramos.csv`), valida sin inventar valores
y traduce al dominio (`tipo_zona` ES->EN); las quejas se regeneran con
semilla 0 por `tramo_id` como en #18 (la columna del CSV se recalcula y la
etiqueta se ignora al inferir). `ValidateLoadDataset` delega al lector;
`PredictPriorities` valida con `validate_segment_features`, exige el
`model_id` del predictor y verifica el 1:1 con `associate_predictions`
(orden preservado; `PREDICTION_WITHOUT_SEGMENT` si se pierde o mezcla).
`SklearnPredictor` traduce EN->ES solo en el borde y nunca llama a `fit`.

Artefacto: `model_id` `"arbol"`, archivo local no versionado
`backend/artifacts/arbol.joblib` (joblib, justificado por ser la
persistencia recomendada por sklearn y estar en requirements). Generación
offline documentada en `backend/README.md` (#10 en train, elección en
validación, test un solo uso). Carga (`pipeline_store.load_pipeline`):
falta -> `FileNotFoundError` (no disponible, con el comando); ilegible o
sin `predict` -> `ValueError` (incompatible). Los tests inyectan el
pipeline o fakes (sin archivo ni filas de entrenamiento del cliente).

No toca el planificador (#28 paralelo): `create_plan_route_use_case` y el
grafo siguen intactos; los contratos abstractos no cambian.

## Decisiones descartadas

- DB/ORM (incluido SQLite): CSV + pandas alcanza en v1; sin SQLAlchemy/MySQL.
- Contenedor DI, factories abstractas, repositorios genéricos: composición
  explícita por función (KISS/YAGNI).
- Escalar antes del split / selección de features mirando todo el dataset:
  prohibido (leakage); todo dentro del pipeline.
- Entrenar desde endpoints de visualización: prohibido.
- OSM/Leaflet en el backend: el dato vial viene de IDE (respaldo OSM) y
  Leaflet solo visualiza (ver `PLAN.md`).

## Tests y presupuesto

- `backend/tests/`: unitarios (dominio, aplicación con fakes), integración
  (adaptadores con fixture de 12 filas, API con `TestClient`). Sin red ni HTTP.
- Presupuesto suite unitaria: **10 s** (medido: ~1.4 s; ver `backend/pytest.ini`).
- Smoke de notebook con `nbval` desde kernel limpio y assertions explícitas.
- Experimentos completos (#9/#10 con datos reales) viven fuera de la suite
  rápida y se documentan en su issue.

## Puntos de integración

- #9: script reproducible + `nodos.csv`/`tramos.csv` finales reemplazan el
  fixture; el lector y los invariantes no cambian.
- #10: entrenamiento/comparación sobre dataset final con los mismos casos
  de uso y protocolo (solo cambian configs y datos).
- Frontend (#13): contrato en `docs/contracts/api-v1.md` (fuente de verdad v1).
