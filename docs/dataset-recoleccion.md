# Dataset de recolección de residuos: definición (issue #8)

Decisión: dataset **mixto** en una zona piloto de Montevideo.

- Geometría y red vial: **real-derivada** de OpenStreetMap (extracto Geofabrik Uruguay).
- Contenedores por tramo: **real-derivados** de coordenadas públicas de contenedores de Montevideo.
- Variables operativas: `dias_desde_ultima_recoleccion` real (levantes, foto T0), `tipo_zona` simulada con semilla (#9) y `historico_quejas_vecinales` **sintético** (#18). No hay registros históricos reales de quejas para estos tramos: se generan conteos anónimos por contenedor representado, sin IDs individuales.
- Etiqueta (`prioridad_recoleccion`): **construida y sintética**. La regla #9 y la regla #18 son etiquetas derivadas, no prioridades oficiales del municipio.

> #18 prepara en memoria el CSV existente, sin reescribirlo. La etiqueta
> original del #9 se conserva como `prioridad_recoleccion_original`; para ML
> se usa la nueva regla con quejas sintéticas descrita abajo.

## Zona piloto v1

Bbox WGS84 (EPSG:4326): oeste `-56.16`, sur `-34.915`, este `-56.15`, norte `-34.905` (Montevideo, ~1 km × ~1.1 km).

Criterio: en este recorte hay 196 coordenadas de contenedores y 138 registros viales cuyo bbox intersecta la zona (conteos aproximados por intersección de bbox, no segmentación final). Es un tamaño apto para enseñar clasificación + Hierholzer/cartero chino. Si en el issue #9 el componente conexo mayor queda con menos de ~100 aristas, ampliar al recorte medio documentado en el log de verificación.

## Fuentes verificadas

| Fuente                                                                                                                                          | Qué aporta                                                                                      | Verificación local                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geofabrik Uruguay `uruguay-latest-free.shp.zip`                                                                                                 | Red vial (`gis_osm_roads_free_1.*`), PRJ WGS84                                                  | 80,527,570 bytes; SHA-256 `37fd738ab8780a0b67add69a2f839fd7d7efd8fc65d0581651d38e3283ea411b`; Last-Modified servidor: Thu, 05 Nov 2026 01:14:17 GMT                              |
| Figshare `Montevideo Garbage Containers` (Toyos; Vallcorba, 2021), DOI `10.6084/m9.figshare.17126738.v1`, archivo `coordenadasContenedores.csv` | 11,556 coordenadas (lon,lat), sin encabezado; 11,458 pares únicos                               | 612,468 bytes; SHA-256 `9b893afb5b6515b55c10e0904980a42c02fe7d9`; MD5 `20f6ae05b23b0dc4a3be43318e9a4c11` (coincide con Figshare)                                                 |
| Windsor `Garbage_Not_Collected_2025.csv`                                                                                                        | Solo **calibración agregada** de la simulación de quejas; sus filas **no** se unen a Montevideo | 278,071 bytes; SHA-256 `ffa713d17ee4b63a55d2030e5619624cbaca316f0a6c889ea0171f5f93499fbc`; 2,465 filas; 546 calles; media 4.51, mediana 2, máx. 60 por calle; rango abr–sep 2025 |
| Referencia `Gtoyos/RecoleccionBasura-GA`, `scripts/conversionCoordenadas.py`                                                                    | Confirma conversión original X,Y (EPSG:31981, SIRGAS2000 UTM 21S) → lon/lat (EPSG:4326)         | Revisado por lectura; el CSV Figshare ya viene como lon,lat en WGS84                                                                                                             |

Licencias y atribución: OSM exige ODbL con atribución a OpenStreetMap y sus contribuyentes; Figshare declara CC BY 4.0 y origen en datos abiertos de la Intendencia de Montevideo. El dataset derivado deberá publicarse con atribución a ambas fuentes y, por el componente OSM, bajo ODbL (a confirmar en el issue #9 antes de redistribuir artefactos). De Windsor solo se reutilizan estadísticos agregados, no filas.

## Esquema

### `nodos.csv` (uno por intersección)

| Campo     | Tipo          | Significado                    | Origen            |
| --------- | ------------- | ------------------------------ | ----------------- |
| `nodo_id` | id (`N0001`…) | Identificador estable del nodo | Real-derivado OSM |
| `lon`     | numérico      | Longitud WGS84 (EPSG:4326)     | Real-derivado OSM |
| `lat`     | numérico      | Latitud WGS84 (EPSG:4326)      | Real-derivado OSM |

### `tramos.csv` (uno por tramo no dirigido; tabla principal de ML)

| Campo                           | Tipo                    | Significado                                    | Origen                                                                             |
| ------------------------------- | ----------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `tramo_id`                      | id (`T0001`…)           | Identificador estable de la arista             | Real-derivado OSM                                                                  |
| `nodo_origen`                   | id                      | Extremo 1 (FK a `nodos`)                       | Real-derivado OSM                                                                  |
| `nodo_destino`                  | id                      | Extremo 2 (FK a `nodos`)                       | Real-derivado OSM                                                                  |
| `longitud_m`                    | numérico                | Largo geodésico del tramo en metros            | Real-derivado OSM                                                                  |
| `nombre_calle`                  | texto (puede ser vacío) | Nombre OSM si existe                           | Real-derivado OSM                                                                  |
| `tipo_zona`                     | categórica              | `residencial` / `comercial` / `industrial`     | Simulado, regla + semilla en #9 (≈60/25/15)                                        |
| `cantidad_contenedores`         | entero ≥ 0              | Contenedores asignados al tramo por cercanía   | Real-derivado (snap de coordenadas al tramo más cercano; radio y desempates en #9) |
| `dias_desde_ultima_recoleccion` | entero ≥ 0              | Días desde la última recolección en la foto T0 | Real (levantes, `daysWithoutLift`)                                                 |
| `historico_quejas_vecinales`    | entero ≥ 0              | Suma sintética de sorteos anónimos por contenedor representado | En memoria (#18), no se escribe al CSV fuente; no son quejas observadas ni IDs individuales |
| `prioridad_recoleccion`         | categórica              | `baja` / `media` / `alta`; variable a predecir | Etiqueta #9 en fuente; #18 la sustituye en memoria con regla sintética            |

Semántica temporal: cada fila es un tramo en una foto de referencia T0 (fecha a fijar en el issue #9). `dias_*` mira hacia atrás desde T0. No hay series temporales en v1.

## Etiquetas sintéticas: regla #9 anterior y regla #18 nueva

La etiqueta #9 se construyó sin quejas: `score = 2*dias + contenedores +
zona_w`, con `zona_w={comercial: 2, industrial: 1, residencial: 0}` y umbrales
baja `<=0`, media `1..2`, alta `>=3`. Su balance en 297 tramos fue 43.4 % baja,
42.1 % media y 14.5 % alta. No son valores observados de prioridad.

Para #18, cada contenedor representado recibe un entero sintético uniforme
`[0, 3]` (seed predeterminada `0`); se agregan los sorteos por tramo. Si el
conteo de contenedores es cero, las quejas son cero. No existen IDs de
contenedor en la entrada, por lo que esos sorteos no se pueden identificar
individualmente. Nueva regla sintética:

```text
score = 2*dias + 1*contenedores + zona_w + 2*quejas
baja si score <= 0 | media si 1..2 | alta si > 2
```

En el CSV actual, con seed `0`, la nueva etiqueta da 129/297 baja (43.4 %),
93/297 media (31.3 %) y 75/297 alta (25.3 %). El modelo aprende esta regla
construida; ninguna etiqueta ni métrica demuestra utilidad operativa real.

## Ejemplos ilustrativos del dataset base #9 (regla sin quejas)

| `tramo_id` | `nodo_origen` | `nodo_destino` | `longitud_m` | `tipo_zona` | `cantidad_contenedores` | `dias_desde_ultima_recoleccion` | `score` | `prioridad_recoleccion` |
| ---------- | ------------- | -------------- | ------------ | ----------- | ----------------------- | ------------------------------- | ------- | ----------------------- |
| T0001      | N0001         | N0002          | 85.5         | residencial | 0                       | 0                               | 0       | baja                    |
| T0002      | N0002         | N0003          | 120.0        | residencial | 1                       | 0                               | 1       | media                   |
| T0003      | N0003         | N0004          | 96.3         | industrial  | 0                       | 0                               | 1       | media                   |
| T0004      | N0001         | N0005          | 74.2         | comercial   | 1                       | 0                               | 3       | alta                    |
| T0005      | N0005         | N0006          | 142.8        | residencial | 2                       | 1                               | 4       | alta                    |

## Preparación y siguiente paso

- #9 genera el CSV fuente reproducible. #18 lo lee sin modificarlo, agrega en memoria la queja sintética, valida, crea `X`/`y`, las particiones 60/20/20 reproducibles y un `ColumnTransformer` sin ajustar.
- #10 ajusta la preparación dentro de cada fold, compara clasificadores con CV solo en train, contrasta en validación y evalúa test una sola vez; las predicciones alimentan selección de tramos y circuito (Hierholzer / cartero chino).

## Limitaciones conocidas

- La prioridad es construida para enseñar; no representa el criterio real del municipio.
- `dias_*` es real (levantes, foto única); no confirma recolecciones omitidas.
- Foto única: no mide generalización temporal.
- Piloto pequeño (~100–200 aristas esperadas): suficiente para el TP, no para producción.
- Hay un desfase temporal entre coordenadas (instantánea 2021 o anterior) y la red vial (2026); se documenta y se acepta para el TP.
