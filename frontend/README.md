# Frontend — base issue #13 (sin UI completa)

Stack: Next.js + TypeScript + Tailwind + componentes mínimos estilo
shadcn + Leaflet aislado (`react-leaflet` instalado, frontera cliente vía
view-model puro). Sin API routes, sin store global.

## Estructura

```text
frontend/src/
  domain/          tipos y reglas de presentación (puros)
  application/     casos de uso + contrato ApiGateway + RequestStore
  infrastructure/  httpGateway (fetch) + fakeGateway (memoria)
  presentation/    hook useOperacion + vistas de estados + leyenda/resumen
  map/             MapView (dynamic ssr:false) + mapViewModel puro
frontend/tests/
  fixtures.ts      escenario piloto + recorrido con tramo repetido
  dominio.test.ts, usecases.test.ts, httpGateway.test.ts,
  mapViewModel.test.ts, estados.test.tsx
  e2e/smoke.spec.ts  smoke Playwright separado (home carga)
```

## Comandos (desde `frontend/`)

```bash
npm install
npm run test        # Vitest unitario: sin red, sin teselas, sin modelos (<10s)
npm run test:e2e    # Playwright smoke (requiere browsers instalados)
npm run dev         # Next dev en http://localhost:3000
npm run build
```

Docs: `docs/architecture/frontend.md` (capas y frontera Leaflet),
`docs/contracts/README.md` (consume api-v1 del #12; comparación offline).

## Limitaciones conocidas (base #13)

- Sin página de recorrido ni formularios (trabajo posterior).
- `next build` (Turbopack) falla en este sandbox (sale 135 sin salida);
  `next dev`, `tsc` y la suite Vitest pasan. Verificar build en CI/otra máquina.
- El smoke Playwright está configurado y separado, pero en este sandbox
  el loopback devuelve `ERR_CONNECTION_RESET`; correr `npm run test:e2e`
  fuera del sandbox.
