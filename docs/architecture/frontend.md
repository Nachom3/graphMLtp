# Arquitectura del frontend

El frontend se organiza por componentes y features. `app/` conserva únicamente la responsabilidad especial de Next.js; el resto del código vive en componentes compartidos o junto a la feature que lo necesita. No hay capas globales que obliguen a cada cambio a atravesar una estructura ajena al dominio.

## Mapa rápido

```text
frontend/
  app/                              rutas y composición Next.js
  components/                       piezas genéricas reutilizables
  features/route-planning/          planificación de recorridos
  public/                            recursos servidos como estáticos
```

- `app/` contiene páginas, layouts y configuración de pruebas propias de las rutas.
- `components/` contiene componentes compartidos independientes de features. Cada componente tiene su propio directorio y `index.ts`; las primitivas shadcn `Alert`, `Badge` y `Skeleton` viven en `components/ui/`.
- `features/<nombre>/` contiene la lógica y presentación de una capacidad. Cada feature publica su API mediante `index.ts`; la aplicación importa desde esa entrada, no desde carpetas internas.
- `public/` es la ubicación reservada por Next.js para recursos estáticos. No se agregan ejemplos artificiales para llenar el directorio.
- `@/` resuelve desde la raíz `frontend/`. `components.json` configura shadcn para Next.js, React 19 y Tailwind CSS v4; los tokens de tema están en `app/globals.css`.

## Dependencias de una feature

La feature `route-planning` usa subestructura solo donde separa responsabilidades reales:

| Área | Responsabilidad | Dependencias principales |
|---|---|---|
| `domain/` | Tipos del escenario, prioridades, recorrido y reglas puras | TypeScript sin React, Next ni HTTP |
| `application/` | Casos de uso, estado de solicitudes y contrato `ApiGateway` | Dominio y su puerto |
| `infrastructure/` | Adaptadores HTTP y fake; serialización y traducción de errores | Contrato de aplicación y dominio |
| `components/` | Mapa, hook de operación, leyenda y resumen propios de la feature | API interna de la feature y React/Next cuando corresponde |
| `index.ts` | Contrato público para el resto de la aplicación | Reexporta solo la superficie ofrecida |

Los componentes compartidos no importan de `features/`. Cada componente React reutilizable o propio de una feature tiene su directorio y `index.ts`; esto incluye `map-view-client/MapViewCliente`, cuya entrada es privada y no se reexporta desde la API de la feature. Las páginas de `app/` componen interfaces mediante APIs públicas; no acceden a implementaciones internas de una feature. La lógica de dominio no depende de React, Next.js, HTTP o Leaflet.

## Contratos y comportamiento preservado

- `ApiGateway` es un puerto pequeño; `crearHttpGateway` contiene las llamadas HTTP y el mapeo de errores api-v1. `FakeGateway` permite pruebas controladas.
- Los pasos conservan el orden y las apariciones repetidas devueltas por el backend. Las prioridades mantienen su asociación por `segment_id`.
- El costo del recorrido es opaco y se presenta tal como lo informa el backend; el frontend no lo recalcula.
- El view-model del mapa es puro. Leaflet se carga solo en cliente y recibe el modelo de vista, no entidades del backend.
- Los componentes compartidos y específicos tienen entradas locales `index.ts`; la feature publica su API desde `features/route-planning/index.ts`. `EstadoVista` compone la primitiva shadcn `Alert` sin cambiar sus mensajes en español ni el rol accesible `status`. La utilidad estándar `cn` está en `lib/utils.ts` y combina `clsx` con `tailwind-merge`.

## Pruebas

Cada feature o zona con pruebas tiene su carpeta `tests/`: `components/tests/` valida utilidades compartidas; `features/route-planning/tests/` concentra pruebas de dominio, casos de uso, adaptadores y componentes de la feature junto a sus fixtures; `app/tests/` contiene la prueba de arquitectura, el setup de Vitest y `e2e/` con los smoke tests de rutas. `app/tests/architecture.test.ts` verifica el layout público, sus entradas y las carpetas `tests/`. Vitest no requiere backend, modelos ni teselas externas. Playwright requiere que su navegador esté instalado en la ubicación elegida por el entorno.

Comandos habituales desde `frontend/`: `npm test`, `npm run build`, `npm run lint` y `npm run test:e2e`.
