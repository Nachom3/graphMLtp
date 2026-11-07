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

Las etiquetas de entrenamiento del fixture de pruebas se construyen con la
regla pública `etiqueta_v1`; no son mediciones operativas ni evidencia de
exactitud o utilidad del modelo en el mundo real.

## API local

```bash
uvicorn recoleccion.api:app --reload --app-dir backend/src
# docs interactivas: http://127.0.0.1:8000/docs
```
