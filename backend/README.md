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

## Demostración reproducible: preparación → comparación → predicción

El script `scripts/train_compare.py` usa la preparación #18 tal cual y
compara `arbol` vs `logistica` con la misma metodología (CV solo en train,
grilla chica, contraste en validación, test un solo uso). El notebook
`notebooks/10_entrenamiento_modelos.ipynb` llama al mismo código.

```bash
python scripts/train_compare.py
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

## API local

```bash
uvicorn recoleccion.api:app --reload --app-dir backend/src
# docs interactivas: http://127.0.0.1:8000/docs
```
