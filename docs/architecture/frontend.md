# Arquitectura del frontend (issue #13)

Base de pruebas independiente del backend. Sin UI completa en este issue:
lógica + tests; `react-leaflet` instalado pero aislado tras un view-model
comprobable sin mapa real.

## Capas y dependencias permitidas

```text
presentación (React) → aplicación (casos de uso) → gateway (contrato API)
mapa (Leaflet) ← view-model puro ← dominio/presentación
```

| Capa | Contenido | Puede importar | No puede importar |
|---|---|---|---|
| `domain` (tipos y reglas de presentación) | `frontend/src/domain/*`: prioridades, tramos, escenario, comparación, recorrido, costo opaco, estados, view-model del mapa | nada (solo TS puro) | React, HTTP, Leaflet |
| `application` (casos de uso) | `frontend/src/application/*`: 5 casos de uso, guarda de `requestId`, fuente de verdad de solicitudes | `domain`, contrato `gateway` | React, `fetch`, Leaflet |
| `infrastructure` (adaptadores) | `frontend/src/infrastructure/*`: `httpGateway` (fetch + DTO→dominio + errores), `fakeGateway` (memoria con latencia/fallos controlables) | `domain`, contrato | componentes React |
| `presentation` | `frontend/src/presentation/*`: hooks y componentes de estados (carga/vacío/éxito/error), leyenda no solo color | `domain`, `application` | Leaflet directo |
| `map` (frontera cliente) | `frontend/src/map/*`: `MapView` (client-only, `dynamic` + `ssr:false`) alimentado por view-model puro | view-model | casos de uso directo |

Reglas:

- Casos de uso independientes de componentes React (testeables en Node/Vitest).
- Nada de `fetch` disperso: todo pasa por el `ApiGateway` (pequeño, sustituible).
- Sin backend adicional en Next.js (sin API routes), sin store global.
  Fuente de verdad: un `RequestStore` mínimo por solicitud vigente
  (`requestId` monótono + `AbortController`); las respuestas viejas no
  sobrescriben la selección vigente (la semántica de orden/versiones la
  define el backend, ver `docs/contracts/README.md`).
- Costo y validación de selecciones: los define el backend; el frontend
  solo presenta el `costo` opaco y los errores tipados (sin recalcular ML
  ni optimización).

## Principios aplicados

- **SRP:** tipos (qué se muestra), casos de uso (qué se pide), gateway
  (cómo se pide), presentación (cómo se ve), mapa (dónde se ve).
- **DIP/ISP:** la aplicación depende del contrato pequeño `ApiGateway`;
  ningún consumidor conoce `fetch`. Contratos por rol, no un cliente dios.
- **Composición:** construcción e inyección explícita (el hook recibe el
  gateway; los tests inyectan el fake).
- Funciones/tipos por defecto; clases solo donde encapsulan estado útil
  (`FakeGateway`, `RequestStore`). Sin factories abstractas ni DI framework.

## Casos de uso (5)

| Caso de uso | Resultado esperado |
|---|---|
| Cargar escenario | grafo, datos y metadatos consistentes |
| Consultar comparación de modelos | resultados ya calculados + configuración |
| Solicitar prioridades | selección válida → prioridades por tramo |
| Solicitar recorrido | secuencia + repeticiones + costo del backend |
| Explorar resultados | selección tramo/paso ↔ mapa + resumen textual |

Cada uno define estados: carga, vacío, éxito, error. Accesibilidad: la
prioridad nunca se comunica solo con color (leyenda con etiqueta + patrón).

## Frontera Leaflet / Next.js

- Leaflet solo corre en cliente: `next/dynamic(ssr:false)` + `MapView`.
- El mapa nunca recibe entidades del backend directamente: recibe el
  `MapViewModel` (marcadores, polilíneas por tramo, paso actual), función
  pura `toMapViewModel(resultado)` testeable sin JSDOM ni Leaflet.
- `react-leaflet` + `leaflet` instalados desde este issue; sin página demo
  (acordado: sin UI). El smoke Playwright verifica que la home carga y que
  los componentes de estado renderizan sin mapa real.
- Tiles: en tests, ninguna baldosa externa (jsdom + fake; Playwright
  contra `page.tsx` por defecto sin teselas).

## Pruebas

- **Vitest (unidad, <10s, sin red/modelos/teselas):** transformaciones,
  gateway fake, `requestId` (respuesta tardía no reemplaza), fixture con
  tramo repetido que conserva orden y duplicados, costo opaco sin
  recalcular, tipos coherentes con el contrato.
- **Testing Library:** componentes de estados con datos controlados
  (carga, vacío, parámetros inválidos, fallo de red, recorrido imposible).
- **Playwright (smoke separado):** la app levanta y la home responde;
  no abre mapa real en este issue.

## Lo que NO es este issue

- Sin página de recorrido completa ni formularios finales (trabajo posterior).
- Sin contrato definitivo: `docs/contracts/README.md` es stub
  frontend-only; el contrato canónico lo define la sesión del #12
  (backend). Tipos TS derivan de ese stub + IDs del dataset (#8, leído
  por referencia sin mergear).
- Sin shadcn CLI completo: base compatible (utils `cn` + componentes
  mínimos estilo shadcn); el sistema de diseño completo es posterior.
