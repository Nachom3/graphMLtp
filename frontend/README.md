# Frontend — demo de planificación

Demo Next.js con TypeScript, Tailwind, una frontera de mapa Leaflet y una feature de planificación organizada en dominio, aplicación, infraestructura y componentes. El árbol asigna prioridades y la API calcula el circuito; el navegador no entrena modelos ni optimiza recorridos.

## Desarrollo y pruebas

Desde `frontend/`:

```bash
npm ci
npm test
npm run build
npm run lint
npm run dev
```

Vitest valida las pruebas de `components/tests/` y `features/route-planning/tests/`. Playwright valida la página y el flujo punta a punta con la API v1 real; no reemplaza sus endpoints por mocks. La API debe estar iniciada antes de ejecutar `npm run test:e2e`.

## Demo con el backend real

En una terminal, desde la raíz del repo, inicia FastAPI usando el escenario de ciudad `dataset/salida-montevideo/` que carga la configuración predeterminada (si falta, generala con `python scripts/build_dataset.py --montevideo`):

```bash
uvicorn collection.api:app --reload --app-dir backend/src
```

El servicio usa `http://localhost:8000` y expone `/health`, `/scenario`, `/predictions:predict` y `/routes:plan`. La predicción requiere el artefacto ajustado del árbol en `backend/artifacts/arbol-montevideo.joblib`; si no está generado, la API responde con modelo no disponible y la demo lo muestra como error. Genera el artefacto offline con `python scripts/generate_arbol_artifact.py` (detalle en [`../backend/README.md`](../backend/README.md)); la interfaz nunca entrena. El artefacto histórico `arbol.joblib` del piloto solo queda como referencia de tests, no es el default de la demo.

En otra terminal, desde `frontend/`:

```bash
npm run dev
```

Abre `http://localhost:3000`. Para apuntar la demo y el e2e a otra URL de API, establece `NEXT_PUBLIC_API_BASE_URL` antes de iniciar Next.js y Playwright:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run test:e2e
```

Playwright levanta Next.js cuando no hay un servidor disponible. La prueba `app/tests/e2e/real-api.spec.ts` consulta el escenario, predicciones y plan directamente al backend real, y contrasta las estadísticas, el orden del circuito, el tránsito y su presentación en la página. Las teselas del mapa se bloquean en esta prueba, por lo que no dependen de servicios externos de mapas.

## Limitaciones de la demo

- La etiqueta que aprende el árbol es construida con una regla sintética; sus predicciones y métricas no demuestran desempeño operativo real. Consulta [`../backend/README.md`](../backend/README.md) y [`../docs/modelo-comparacion.md`](../docs/modelo-comparacion.md).
- El planificador interpreta las calles como aristas de un grafo no dirigido. La demo presenta el orden, las repeticiones, las distancias y la cobertura devueltos por el backend; no recalcula el costo ni afirma óptimo global del cartero rural.
- Los tramos con cero contenedores pueden aparecer como conexiones de tránsito para llegar a destinos obligatorios, pero no son destinos de recolección.

Más sobre límites de arquitectura: [`../docs/architecture/frontend.md`](../docs/architecture/frontend.md). Contrato API: [`../docs/contracts/api-v1.md`](../docs/contracts/api-v1.md).
