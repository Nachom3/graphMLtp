# TP Machine Learning + Grafos — Recolección de residuos (Montevideo)

Demo: un árbol de decisión asigna prioridades a tramos de calle y la API v1
planifica el circuito de recolección sobre un grafo. El frontend solo visualiza.

## Cómo correrlo (desde la raíz)

No existe carpeta `source`/`soruce`: el proyecto se corre desde la **raíz del repo**.

```bash
npm run install:all   # una vez: npm ci (frontend) + pip install (backend)
npm run dev           # levanta backend :8000 + frontend :3000 juntos
```

Abrí `http://localhost:3000`. El script genera solo el artefacto offline
`backend/artifacts/arbol.joblib` si falta (ver `backend/README.md`, sección #27).

Por separado:

```bash
npm run dev:backend    # uvicorn collection.api:app --reload --app-dir backend/src
npm run dev:frontend   # next dev (desde frontend/)
```

## Comandos útiles (raíz)

| Comando | Qué hace |
| --- | --- |
| `npm run build` | `next build` del frontend |
| `npm run lint` | eslint del frontend |
| `npm run test` | vitest (frontend) + pytest (backend) |
| `npm run test:e2e` | Playwright contra la API v1 real (requiere `npm run dev:backend` aparte si no hay servidor en :3000; levanta Next solo) |
| `npm run artifact` | regenera `backend/artifacts/arbol.joblib` |

## Estructura

- `frontend/` — demo Next.js (mapa Leaflet, feature `route-planning`). Detalles en `frontend/README.md`.
- `backend/` — FastAPI v1 (`/health`, `/scenario`, `/predictions:predict`, `/routes:plan`). Detalles en `backend/README.md`.
- `scripts/` — `build_dataset.py`, `train_compare.py`, `generate_arbol_artifact.py`, `dev.sh`.
- `dataset/` — fuentes y `dataset/salida/` (tramos/nodos v1).
- `docs/` — arquitectura, contrato API v1, comparación de modelos.

Documentación de fondo: `PLAN.md`, `ai.md`, `lineamentos.md`, `readme/`.
