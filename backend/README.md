# Backend (issue #12)

Arquitectura: ver `docs/architecture/backend.md`. Contrato API v1 (fuente
de verdad para el frontend #13): ver `docs/contracts/api-v1.md`.

## Instalación

```bash
pip install -r backend/requirements.txt
```

## Tests rápidos (presupuesto 10 s; medido ~2.2 s)

```bash
python -m pytest backend/tests/ -q
```

## Smoke del notebook (kernel limpio, assertions explícitas)

```bash
python -m pytest --nbval-lax notebooks/12_arquitectura_backend.ipynb -q
```

## Demostración reproducible: preparación → predicción (solo `arbol`)

La comparación de modelos vive en los notebooks con código sklearn propio
(`notebooks/10_entrenamiento_modelos.ipynb` y
`notebooks/comparacion_evaluacion.ipynb`): el backend no compara, no
optimiza hiperparámetros y no entrena a pedido; solo sirve el árbol ya
elegido.

```bash
python -m pytest --nbval-lax notebooks/10_entrenamiento_modelos.ipynb -q
```

Las etiquetas son sintéticas (regla #18 con quejas); las métricas miden
ajuste a esa regla, no desempeño operativo real. Ver
`docs/modelo-comparacion.md` para resultados, configuración y límites.

## Preparación reproducible para ML (#18)

`prepare_dataset` carga un CSV existente en memoria y devuelve features y
etiqueta alineadas, IDs, particiones auditables y un preprocesador sin ajustar.
No escribe en el CSV y no entrena un clasificador.

```python
import sys
from pathlib import Path

from sklearn.dummy import DummyClassifier
from sklearn.model_selection import cross_validate
from sklearn.pipeline import make_pipeline

sys.path.insert(0, str(Path("backend/src").resolve()))
from collection.adapters.datasets.ml_preparation import prepare_dataset

fixture = Path("backend/tests/fixtures/tramos.csv")
prepared = prepare_dataset(fixture, seed=0)
train = prepared.partitions["train"].indices
pipeline = make_pipeline(prepared.preprocessor, DummyClassifier())
# Ejemplo de API CV sobre fixture aislado: no es selección ni entrega de modelo.
results = cross_validate(
    pipeline,
    prepared.X.iloc[list(train)],
    prepared.y.iloc[list(train)],
    cv=2,
)
```

La preparación predeterminada sortea enteros `[0, 3]` anónimos por contenedor,
los suma por tramo y construye la etiqueta con peso 2 para quejas. Las particiones
mantienen el redondeo de `train_test_split` (60 % train y el resto en mitades):
si la estratificación estándar falla, una asignación determinista alternativa
conserva tamaños y cobertura por clase cuando es viable. Si no lo es, se usa un
reparto no estratificado y `metadata["stratification_limitation"]` explica la
limitación; `metadata["stratified"]` no lo presenta como estratificado. La etiqueta
anterior y la nueva son sintéticas; ver [`PLAN.md`](../PLAN.md) para los
parámetros y la distribución observada del CSV actual. En #10, el pipeline
completo se entregará sin ajustar a CV/GridSearchCV para que cada fold ajuste
sus transformaciones solo con su train.

## Datos e inferencia del árbol (#27)

Carga un directorio `v1` (`nodos.csv` + `tramos.csv`) con `CsvDatasetReader`
(stdlib `csv`, sin pandas) y predice con el árbol de #10 ya ajustado. La
comparación/selección es offline (#10); ningún request entrena.

```bash
python -m pytest backend/tests/test_data_inference.py -q
python -m pytest backend/tests/ -q
```

```python
sys.path.insert(0, str(Path("backend/src").resolve()))
from collection import composition

nodes, segments = composition.create_validate_load_dataset_use_case().execute(
    "backend/tests/fixtures", "v1"
)
use_case = composition.create_predict_priorities_use_case("arbol", pipeline=pipeline_ajustado)
predictions = use_case.execute("arbol", segments)  # 1:1 por tramo_id, en orden
```

Traducciones: `tipo_zona` ES<->EN (`residencial/comercial/industrial` <->
`residential/commercial/industrial`) y etiqueta ES<->EN
(`baja/media/alta` <-> `low/medium/high`) en los bordes CSV/dominio y
predictor. Las quejas se regeneran con semilla `0` por `tramo_id`
(`synthetic_complaints`, como #18); la columna del CSV, si existe, se
recalcula y `prioridad_recoleccion` se ignora al inferir. Los CSV solo se
leen. Errores: `INVALID_DATASET` (fuente/esquema/invariantes),
`ValueError` (modelo desconocido o tramo inválido) y
`PREDICTION_WITHOUT_SEGMENT` (salida sin 1:1).

Ejemplo histórico del piloto (no genera el artefacto predeterminado de ciudad):

Pipeline ajustado (identificación y carga): `model_id` `"arbol"` (elegido
en #10 por validación). Generación offline con la metodología #10
(`prepare_dataset` seed 0 -> `build_pipeline("arbol", ...)` con
`max_depth=None, min_samples_split=2` -> `fit` solo en train -> `joblib.dump`
a `backend/artifacts/arbol.joblib`, no versionado):

```bash
python - <<'PY'
from pathlib import Path
import sys
sys.path.insert(0, "backend/src")
from collection.adapters.datasets.ml_preparation import prepare_dataset
from collection.adapters.models.model_specs import build_pipeline
from collection.adapters.models.pipeline_store import save_pipeline
prepared = prepare_dataset("dataset/salida/tramos.csv", seed=0)
pipe = build_pipeline("arbol", prepared.preprocessor, seed=0)
pipe.set_params(decisiontreeclassifier__max_depth=None,
                decisiontreeclassifier__min_samples_split=2)
pipe.fit(prepared.X.iloc[list(prepared.partitions["train"].indices)],
         prepared.y.iloc[list(prepared.partitions["train"].indices)])
save_pipeline(pipe, "backend/artifacts/arbol.joblib")
PY
```

Carga con `joblib` (formato justificado: persistencia recomendada por
sklearn para pipelines con numpy, ya en `requirements.txt`); cualquier
objeto con `.predict` sirve (los tests inyectan fakes sin archivo). Si el
archivo falta: `FileNotFoundError` (modelo no disponible, con el comando
de generación); si no se puede leer o no tiene `predict`: `ValueError`
(modelo incompatible). La inferencia nunca llama a `fit` ni pide filas de
entrenamiento al cliente (el viejo `filas_entrenamiento` del contrato ya no
se usa en este camino).

Limitaciones: la etiqueta es construida (regla #18 con quejas y zona
sintéticas); las métricas de #10 miden ajuste a esa regla, no desempeño
operativo real. Ver `docs/modelo-comparacion.md` y `PLAN.md`.

## API v1 local

La API usa por defecto `dataset/salida-montevideo/`, con nodos, tramos y
`geometrias.geojson` generados con `python scripts/build_dataset.py --montevideo`.
La variable `COLLECTION_SCENARIO_SOURCE` permite apuntar explícitamente a otro
directorio compatible; no se sustituye por un fixture si faltan los datos.
La configuración vive en `src/collection/config.py`: además de la fuente,
`COLLECTION_SCENARIO_DEFAULT_LIMIT` (tope cuando el cliente no manda `limit`;
vacío = dataset completo) y `COLLECTION_SCENARIO_MAX_LIMIT` (tope de seguridad,
50000 por defecto).
`GET /scenario` acepta `sur/norte/oeste/este/limit` opcionales para cargar solo
una parte (misma validación que `GET /containers`; responde `total/limit/truncated`);
sin params devuelve todo. Devuelve las polilíneas IDE WGS84 `[lon, lat]` por `segment_id`
y responde `SCENARIO_UNAVAILABLE` si faltan o no coinciden con los tramos.
El modelo predeterminado es `backend/artifacts/arbol-montevideo.joblib`; se genera
con `python scripts/generate_arbol_artifact.py` sobre el CSV de ciudad. Las
métricas históricas del piloto no validan por sí solas ese árbol reentrenado.

La API expone predicción con el árbol ajustado y
planificación de recorridos. El contrato HTTP en inglés está en
[`docs/contracts/api-v1.md`](../docs/contracts/api-v1.md). Las rutas son
`GET /health`, `GET /scenario`, `POST /predictions:predict` y
`POST /routes:plan`. La predicción no recibe filas de entrenamiento y ningún
endpoint de visualización entrena modelos. En planificación, tramos con cero
contenedores pueden conectar destinos como tránsito, pero no se convierten en
destinos.

```bash
uvicorn collection.api:app --reload --app-dir backend/src
# OpenAPI: http://127.0.0.1:8000/openapi.json
# docs interactivas: http://127.0.0.1:8000/docs
```
