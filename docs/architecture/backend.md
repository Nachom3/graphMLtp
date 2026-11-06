# Arquitectura del backend (issue #12)

v1: Python, CSV, pandas/scikit-learn y FastAPI; sin base de datos ni ORM.
Jupyter y la API son puntos de entrada al mismo código reutilizable
(`backend/src/recoleccion/`); no dos implementaciones diferentes.

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
| aplicación (`aplicacion.py`) | 4 casos de uso: validar/cargar dataset, comparar modelos, predecir prioridades, planificar recolección; contratos `LectorDataset`, `EvaluadorModelos`, `PredictorPrioridades`, `PlanificadorRecorrido` | I/O, HTTP, sklearn, grafos concretos |
| adaptadores (`adaptadores.py`) | `CsvLectorDataset`, `SklearnEvaluador`, `SklearnPredictor`, `PredictorReglaV1`, `NetworkxPlanificador`, `guardar_registro` | decidir políticas (solo ejecutan) |
| composición (`composicion.py`) | inyección explícita por función (`cargar_dataset_v1`, `comparar_demos`, `predecir_con`, `planificar`) | lógica de negocio |
| transporte (`api.py`) | validación de formas (Pydantic), traducción a dominio, códigos de error del contrato | entrenar fuera de lo pedido, lógica de negocio |

## Casos de uso (resumen verificable)

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
- `Protocol` o funciones donde alcanza; las pruebas de contrato son las mismas
  para cada par (LSP).

## Evaluación reproducible

- Holdout estratificado `train_test_split(test_size=0.25, stratify=y,
  random_state=0)`; CV sobre **entrenamiento** (`cv=5` pedido, ajustado al
  mínimo real por clase en fixtures chicos y registrado como `cv_folds_usados`).
- Todo lo que aprende de los datos va dentro del `Pipeline`: `OneHotEncoder`
  para `tipo_zona` siempre; `StandardScaler` solo en logística (no en árbol).
- Métricas multiclase sobre test separado: accuracy, precisión/recall/F1 macro,
  matriz de confusión + baseline tonto (predecir siempre la mayoría).
- `mejor_por_cv` sale del CV-train; **no se selecciona ajustándose al test**.
- `registro`: n de filas, partición, semilla, folds, medias CV, baseline y
  versiones (python, sklearn, pandas). Se guarda con `guardar_registro`.

## La etiqueta es construida (aviso obligatorio)

La prioridad se calcula con la regla v1 sobre 4 columnas; el modelo aprende
esa regla. **Una buena métrica no demuestra utilidad operativa real.**
Declararlo en el informe; la generalización temporal no se mide en v1
(foto única T0).

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
