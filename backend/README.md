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

## API local

```bash
uvicorn recoleccion.api:app --reload --app-dir backend/src
# docs interactivas: http://127.0.0.1:8000/docs
```
