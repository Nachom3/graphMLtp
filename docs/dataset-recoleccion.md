# Dataset de recolección de residuos: definición (issue #8)

Decisión: dataset **mixto** en una zona piloto de Montevideo.

- Geometría y red vial: **real-derivada** de OpenStreetMap (extracto Geofabrik Uruguay).
- Contenedores por tramo: **real-derivados** de coordenadas públicas de contenedores de Montevideo.
- Variables operativas (`tipo_zona`, `dias_desde_ultima_recoleccion`, `historico_quejas_vecinales`): **simuladas** con reglas y semilla reproducibles (issue #9).
- Etiqueta (`prioridad_recoleccion`): **construida** con una regla pública v1. No es una prioridad oficial del municipio.

## Zona piloto v1

Bbox WGS84 (EPSG:4326): oeste `-56.16`, sur `-34.915`, este `-56.15`, norte `-34.905` (Montevideo, ~1 km × ~1.1 km).

Criterio: en este recorte hay 196 coordenadas de contenedores y 138 registros viales cuyo bbox intersecta la zona (conteos aproximados por intersección de bbox, no segmentación final). Es un tamaño apto para enseñar clasificación + Hierholzer/cartero chino. Si en el issue #9 el componente conexo mayor queda con menos de ~100 aristas, ampliar al recorte medio documentado en el log de verificación.

## Fuentes verificadas

| Fuente | Qué aporta | Verificación local |
|---|---|---|
| Geofabrik Uruguay `uruguay-latest-free.shp.zip` | Red vial (`gis_osm_roads_free_1.*`), PRJ WGS84 | 80,527,570 bytes; SHA-256 `37fd738ab8780a0b67add69a2f839fd7d7efd8fc65d0581651d38e3283ea411b`; Last-Modified servidor: Thu, 05 Nov 2026 01:14:17 GMT |
| Figshare `Montevideo Garbage Containers` (Toyos; Vallcorba, 2021), DOI `10.6084/m9.figshare.17126738.v1`, archivo `coordenadasContenedores.csv` | 11,556 coordenadas (lon,lat), sin encabezado; 11,458 pares únicos | 612,468 bytes; SHA-256 `9b893afb5b6515b55c10e0904980a42c02fe7d9`; MD5 `20f6ae05b23b0dc4a3be43318e9a4c11` (coincide con Figshare) |
| Windsor `Garbage_Not_Collected_2025.csv` | Solo **calibración agregada** de la simulación de quejas; sus filas **no** se unen a Montevideo | 278,071 bytes; SHA-256 `ffa713d17ee4b63a55d2030e5619624cbaca316f0a6c889ea0171f5f93499fbc`; 2,465 filas; 546 calles; media 4.51, mediana 2, máx. 60 por calle; rango abr–sep 2025 |
| Referencia `Gtoyos/RecoleccionBasura-GA`, `scripts/conversionCoordenadas.py` | Confirma conversión original X,Y (EPSG:31981, SIRGAS2000 UTM 21S) → lon/lat (EPSG:4326) | Revisado por lectura; el CSV Figshare ya viene como lon,lat en WGS84 |

Licencias y atribución: OSM exige ODbL con atribución a OpenStreetMap y sus contribuyentes; Figshare declara CC BY 4.0 y origen en datos abiertos de la Intendencia de Montevideo. El dataset derivado deberá publicarse con atribución a ambas fuentes y, por el componente OSM, bajo ODbL (a confirmar en el issue #9 antes de redistribuir artefactos). De Windsor solo se reutilizan estadísticos agregados, no filas.

## Esquema

### `nodos.csv` (uno por intersección)

| Campo | Tipo | Significado | Origen |
|---|---|---|---|
| `nodo_id` | id (`N0001`…) | Identificador estable del nodo | Real-derivado OSM |
| `lon` | numérico | Longitud WGS84 (EPSG:4326) | Real-derivado OSM |
| `lat` | numérico | Latitud WGS84 (EPSG:4326) | Real-derivado OSM |

### `tramos.csv` (uno por tramo no dirigido; tabla principal de ML)

| Campo | Tipo | Significado | Origen |
|---|---|---|---|
| `tramo_id` | id (`T0001`…) | Identificador estable de la arista | Real-derivado OSM |
| `nodo_origen` | id | Extremo 1 (FK a `nodos`) | Real-derivado OSM |
| `nodo_destino` | id | Extremo 2 (FK a `nodos`) | Real-derivado OSM |
| `longitud_m` | numérico | Largo geodésico del tramo en metros | Real-derivado OSM |
| `nombre_calle` | texto (puede ser vacío) | Nombre OSM si existe | Real-derivado OSM |
| `tipo_zona` | categórica | `residencial` / `comercial` / `industrial` | Simulado, regla + semilla en #9 (≈60/25/15) |
| `cantidad_contenedores` | entero ≥ 0 | Contenedores asignados al tramo por cercanía | Real-derivado (snap de coordenadas al tramo más cercano; radio y desempates en #9) |
| `dias_desde_ultima_recoleccion` | entero 0–7 | Días desde la última recolección en la foto T0 | Simulado, RNG con semilla en #9 |
| `historico_quejas_vecinales` | entero ≥ 0 | Reclamos del tramo en la ventana previa a T0 | Simulado, calibrado con agregados de Windsor; no son reclamos reales de Montevideo |
| `prioridad_recoleccion` | categórica | `baja` / `media` / `alta`; variable a predecir | **Construida** por la regla v1 de abajo; no oficial |

Semántica temporal: cada fila es un tramo en una foto de referencia T0 (fecha a fijar en el issue #9). `dias_*` y `historico_*` miran hacia atrás desde T0. No hay series temporales en v1.

## Regla de etiqueta v1 (construida, pública)

```text
zona_w = 2 si comercial, 1 si industrial, 0 si residencial
score  = 2 * dias_desde_ultima_recoleccion
       + 3 * historico_quejas_vecinales
       + 1 * cantidad_contenedores
       + zona_w
baja  si score <= 10
media si 11 <= score <= 16
alta  si score >= 17
```

Justificación: con las distribuciones previstas (días uniforme 0–7; quejas sesgadas a 0–2; contenedores por tramo mayormente 0–2; zonas 60/25/15), una simulación Monte Carlo de 10,000 casos da ≈37% baja / 34% media / 29% alta. Si el balance real del piloto difiere mucho, el issue #9 podrá recalibrar los umbrales, pero deberá registrar los valores finales y el balance obtenido. El modelo aprenderá esta regla; una buena métrica no prueba utilidad operativa real.

## Ejemplos ilustrativos (coherentes con la regla v1)

| `tramo_id` | `nodo_origen` | `nodo_destino` | `longitud_m` | `tipo_zona` | `cantidad_contenedores` | `dias_desde_ultima_recoleccion` | `historico_quejas_vecinales` | `score` | `prioridad_recoleccion` |
|---|---|---|---|---|---|---|---|---|---|
| T0001 | N0001 | N0002 | 85.5 | residencial | 1 | 2 | 0 | 5 | baja |
| T0002 | N0002 | N0003 | 120.0 | comercial | 2 | 4 | 2 | 18 | alta |
| T0003 | N0003 | N0004 | 96.3 | industrial | 1 | 3 | 1 | 11 | media |
| T0004 | N0001 | N0005 | 74.2 | residencial | 0 | 0 | 0 | 0 | baja |
| T0005 | N0005 | N0006 | 142.8 | comercial | 3 | 6 | 3 | 26 | alta |

## Qué queda para los issues #9 y #10

- #9: script reproducible con semilla; clip OSM al bbox; construcción del grafo y componente conexo; snap de contenedores; generación de variables simuladas; aplicación de la regla y balance final; partición documentada.
- #10: comparación de clasificadores con test separado; las predicciones alimentan la selección de tramos y el circuito (Hierholzer / cartero chino).

## Limitaciones conocidas

- La prioridad es construida para enseñar; no representa el criterio real del municipio.
- Quejas y días son simulados; no confirman recolecciones omitidas.
- Foto única: no mide generalización temporal.
- Piloto pequeño (~100–200 aristas esperadas): suficiente para el TP, no para producción.
- Hay un desfase temporal entre coordenadas (instantánea 2021 o anterior) y la red vial (2026); se documenta y se acepta para el TP.
