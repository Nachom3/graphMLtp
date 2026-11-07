# Backend (issue #12)

Arquitectura: ver `docs/architecture/backend.md`. Contrato API v1 (fuente
de verdad para el frontend #13): ver `docs/contracts/api-v1.md`.

## Instalación

```bash
pip install -r backend/requirements.txt
```

## Tests rápidos (presupuesto 10 s; medido ~1.4 s)

```bash
python -m pytest backend/tests/ -q
```

## Smoke del notebook (kernel limpio, assertions explícitas)

```bash
python -m pytest --nbval-lax notebooks/12_arquitectura_backend.ipynb -q
```

## Demostración reproducible: sklearn → prioridades → recorrido

La prueba `backend/tests/test_flujo_integrado.py` sirve como demo end-to-end
sin levantar servidor ni frontend. Entrena el predictor `arbol` con el fixture
de tramos, envía sus predicciones a `/recorridos:planificar`, cambia las
features de `T0001` por las de un ejemplo de prioridad alta, y vuelve a
predecir y planificar. La prueba verifica que la prioridad de ese tramo cambia
de baja a alta y que el resultado/costo de la ruta también cambia.

Ejecutar la demo:

```bash
PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -c backend/pytest.ini backend/tests/test_flujo_integrado.py -p no:cacheprovider
```

Las etiquetas de entrenamiento del fixture de integración se construyen con
la regla pública anterior `etiqueta_v1`; no son mediciones operativas ni
evidencia de exactitud o utilidad del modelo en el mundo real.

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
los suma por tramo y construye la etiqueta con peso 2 para quejas. La etiqueta
anterior y la nueva son sintéticas; ver [`PLAN.md`](../PLAN.md) para los
parámetros y la distribución observada del CSV actual. En #10, el pipeline
completo se entregará sin ajustar a CV/GridSearchCV para que cada fold ajuste
sus transformaciones solo con su train.

## API local

```bash
uvicorn recoleccion.api:app --reload --app-dir backend/src
# docs interactivas: http://127.0.0.1:8000/docs
```
