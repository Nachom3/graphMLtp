# Frontend — base issue #13

Frontend de Next.js con TypeScript, Tailwind y una frontera de mapa Leaflet aislada. La arquitectura organiza el código por componentes reutilizables y features; todavía no incluye una página de producto ni formularios finales.

## Estructura

```text
frontend/
  app/                              Next App Router, composición y pruebas de rutas
  components/                       primitivas compartidas, independientes de features
    operation-status/               EstadoVista compuesta con Alert + index.ts
    ui/alert/                        Alert, AlertDescription, AlertTitle + index.ts
    ui/badge/                        Badge + index.ts
    ui/skeleton/                     Skeleton + index.ts
  components/tests/                  pruebas de primitivas/utilidades compartidas
  lib/utils.ts                       cn de shadcn (clsx + tailwind-merge)
  components.json                    configuración shadcn para Next.js y Tailwind v4
  features/route-planning/          feature completa de planificación
    domain/                          modelos y reglas puras
    application/                     casos de uso + puerto ApiGateway
    infrastructure/                  adaptadores HTTP y fake
    components/                      presentación propia de la feature
      map-view/                      MapView + index.ts + view-model puro
      map-view-client/               MapViewCliente + index.ts (interno)
      priority-legend/               LeyendaPrioridades + index.ts
      route-summary/                 ResumenRecorrido + index.ts
      use-operation/                 hook de operación + index.ts
    tests/                           pruebas de la feature + fixtures compartidos
    index.ts                         API pública de la feature
  public/                            recursos estáticos de Next.js
```

Cada componente reutilizable o propio de una feature tiene su directorio y `index.ts`. Las rutas permanecen según la convención de Next.js. El alias `@/` apunta a la raíz de `frontend/`. Los componentes compartidos usan primitivas shadcn; `EstadoVista` conserva sus mensajes en español y el rol accesible `status`.

## Desarrollo y pruebas

Desde `frontend/`:

```bash
npm ci
npm test
npm run build
npm run lint
npm run test:e2e  # necesita el navegador de Playwright disponible
npm run dev
```

Vitest ejecuta las pruebas de cada `tests/`: `components/tests/` valida las utilidades compartidas y `features/route-planning/tests/` valida la feature. El smoke Playwright vive en `app/tests/e2e/`. La prueba de arquitectura está en `app/tests/architecture.test.ts`.

Detalles de límites y dependencias: [`../docs/architecture/frontend.md`](../docs/architecture/frontend.md). Contrato consumido por el adaptador: [`../docs/contracts/README.md`](../docs/contracts/README.md).
