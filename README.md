# TP Machine Learning + Grafos — Recolección de residuos (Montevideo)

Demo: un árbol de decisión asigna prioridades a tramos de calle y la API v1
planifica el circuito de recolección sobre un grafo. El frontend solo visualiza.

## Informe

Leé primero el informe del TP: [`readme/informe-tp.pdf`](readme/informe-tp.pdf)
(fuente LaTeX en `docs/informe-tp.tex`). Ahí está la visión de conjunto:
problema, dataset, modelo, grafos, API, capturas y uso de IA.

Para **ampliar** lo del informe, el repo tiene markdowns de detalle alrededor
del proyecto (no hace falta leerlos todos de entrada):

- [`docs/dataset-recoleccion.md`](docs/dataset-recoleccion.md) — fuentes, esquema, regla de etiqueta
- [`docs/modelo-comparacion.md`](docs/modelo-comparacion.md) — protocolo ML, métricas, escala
- [`docs/comparacion-evaluacion/CONCLUSION.md`](docs/comparacion-evaluacion/CONCLUSION.md) — auditoría de evaluación
- [`docs/contracts/api-v1.md`](docs/contracts/api-v1.md) — contrato HTTP
- [`docs/architecture/`](docs/architecture/) — backend / frontend
- [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md)
- [`ai.md`](ai.md) — uso de IA (complemento de la sección del informe)
- [`dataset/*/README.md`](dataset/) — READMEs de cada fuente/salida

## Cómo correrlo (desde la raíz)

No existe carpeta `source`/`soruce`: el proyecto se corre desde la **raíz del repo**.

```bash
npm run install:all                 # dependencias frontend, backend y generador geoespacial
python scripts/build_dataset.py --montevideo  # genera dataset de ciudad (puede demorar)
npm run dev                        # backend :8000 + frontend :3000
```

Abrí `http://localhost:3000`. El escenario predeterminado se lee de
`dataset/salida-montevideo/` y contiene geometrías IDE en WGS84; no se sustituye
por el fixture si falta. `npm run dev` genera el artefacto por defecto
`backend/artifacts/arbol-montevideo.joblib` si falta (vía `scripts/generate_arbol_artifact.py`).
Si cambian los datos, regeneralo con `npm run artifact`.
Las métricas publicadas para el piloto no son automáticamente métricas del
modelo reentrenado con la ciudad. El artefacto histórico `arbol.joblib` del piloto
solo queda como referencia, no es el default.

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
| `npm run artifact` | regenera `backend/artifacts/arbol-montevideo.joblib` desde el dataset de ciudad |

## Estructura

- `frontend/` — demo Next.js (mapa Leaflet, feature `route-planning`). Detalles en `frontend/README.md`.
- `backend/` — FastAPI v1 (`/health`, `/scenario`, `/predictions:predict`, `/routes:plan`). Detalles en `backend/README.md`.
- `scripts/` — `build_dataset.py`, `generate_arbol_artifact.py`, `dev.sh`.
- `dataset/` — fuentes, `salida/` piloto y `salida-montevideo/` de ciudad (tramos, nodos y polilíneas IDE).
- `docs/` — fuente LaTeX/figs del informe, arquitectura, contrato API v1, comparación de modelos.
- `readme/` — enunciado e informe PDF (`Enunciado.pdf`, `informe-tp.pdf`).
- `notebooks/` — comparación de modelos (`10_entrenamiento_modelos.ipynb`); el backend solo sirve el árbol.
