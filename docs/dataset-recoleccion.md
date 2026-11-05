# Dataset de recolección de residuos: definición (issue #8)

Decisión: dataset **mixto** en una zona piloto de Montevideo (diseño v2).

- Geometría y red vial: **real-derivada de ejes IDE Uruguay** (`dataset/11_ejes-ide/`), fuente primaria del grafo. OpenStreetMap vía Geofabrik (`dataset/01_red-vial-osm/`) queda solo como **respaldo / contingencia** con versión congelada (ver abajo).
- Contenedores por tramo: **real-derivados** de coordenadas públicas de contenedores de Montevideo (primario: snapshot operativo BasuraCero en `dataset/09_levantes/`; respaldo geográfico: Figshare en `dataset/02_contenedores-montevideo/`).
- Variables operativas: `dias_desde_ultima_recoleccion` **real** (BasuraCero, `daysWithoutLift` en la foto T0); `historico_quejas_vecinales` **real** (Por Mi Barrio en `dataset/07_reclamos-sur/`, ventana previa a T0); `tipo_zona` **única simulada** por diseño (regla + semilla reproducibles, issue #9).
- Etiqueta (`prioridad_recoleccion`): **construida** con una regla pública v1. No es una prioridad oficial del municipio.
- Windsor: agregado histórico de calibración, sin filas en el dataset; no es fuente vigente.

## Zona piloto v1

Bbox WGS84 (EPSG:4326): oeste `-56.16`, sur `-34.915`, este `-56.15`, norte `-34.905` (Montevideo, ~1 km × ~1.1 km).

Criterio: en este recorte hay 196 coordenadas de contenedores (Figshare) y 129 contenedores del snapshot BasuraCero; 138 registros viales OSM cuyo bbox intersecta la zona y 304 segmentos IDE que tocan el bbox (conteos aproximados por intersección de bbox, no segmentación final). Es un tamaño apto para enseñar clasificación + Hierholzer/cartero chino. Si en el issue #9 el componente conexo mayor queda con menos de ~100 aristas, ampliar al recorte medio documentado en el log de verificación.

## Fuentes verificadas

| Fuente | Qué aporta | Verificación local |
|---|---|---|
| IDE Uruguay `Ejes de vías de circulación - MONTEVIDEO [CSV]` (`dataset/11_ejes-ide/ejes_montevideo.csv`) | **Fuente primaria del grafo**: 45.400 ejes, UTM 21S (SRID 32721), `reftramo` estable como `tramo_id` real | 11.299.973 bytes; SHA-256 `b2fa87f24a029849bb00a186b6a61e9a4803221ea8bed9078cc14e52f79cb60b`; latin-1; detalle en `dataset/11_ejes-ide/README.md` |
| Geofabrik Uruguay `uruguay-latest-free.shp.zip` (respaldo) | Red vial (`gis_osm_roads_free_1.*`), PRJ WGS84. **Solo respaldo / contingencia** si IDE cae; versión congelada | 80,527,570 bytes; SHA-256 `37fd738ab8780a0b67add69a2f839fd7d7efd8fc65d0581651d38e3283ea411b`; Last-Modified servidor: Thu, 05 Nov 2026 01:14:17 GMT |
| BasuraCero `containers.json` (`dataset/09_levantes/`) | Foto operativa real: `dateData`, `circuitCode`, `daysWithoutLift` → `dias_*` real; coords WGS84 | 1.496.837 bytes; 10.458 contenedores (100 % con circuito), `daysWithoutLift` 0–486; foto p. ej. `2026-10-23 15:00`; detalle en `dataset/09_levantes/README.md` |
| Por Mi Barrio `pormibarrio_reports.csv` (`dataset/07_reclamos-sur/`) | Reportes ciudadanos reales con coords → `historico_quejas_vecinales` real | 4.863 reportes con `latitude/longitude`; categorías de residuos a mapear en #9; detalle en `dataset/07_reclamos-sur/README.md` |
| Figshare `Montevideo Garbage Containers` (Toyos; Vallcorba, 2021), DOI `10.6084/m9.figshare.17126738.v1`, archivo `coordenadasContenedores.csv` (respaldo geográfico) | 11,556 coordenadas (lon,lat), sin encabezado; 11,458 pares únicos. Respaldo si el ZIP oficial de la IM falla | 612,468 bytes; SHA-256 `9b893afb5b6515b55c10e0904980a42c02fe7d9`; MD5 `20f6ae05b23b0dc4a3be43318e9a4c11` (coincide con Figshare) |
| SmartWaste MVD, Mendeley DOI `10.17632/d2pw5j592y.1` (`dataset/10_smartwaste-mvd/`) | Frecuencia y circuitos reales por contenedor (`containers_wgs84.csv`, `circuits_enriched.json`); referencia de costos (`circuit_days_final.csv`) | ZIP 134.506.110 bytes (ignorado por git); extraído versionado; detalle en `dataset/10_smartwaste-mvd/README.md` |
| Windsor `Garbage_Not_Collected_2025.csv` (histórico, sin filas) | Solo **agregado histórico de calibración** ya registrado (2.465 filas; 546 calles; media 4.51, mediana 2, máx. 60 por calle; abr–sep 2025). **No es fuente vigente ni se une a Montevideo** | Carpeta eliminada; estadísticos ya documentados; SHA-256 `ffa713d17ee4b63a55d2030e5619624cbaca316f0a6c889ea0171f5f93499fbc` |
| Referencia `Gtoyos/RecoleccionBasura-GA`, `scripts/conversionCoordenadas.py` | Confirma conversión original X,Y (EPSG:31981, SIRGAS2000 UTM 21S) → lon/lat (EPSG:4326) | Revisado por lectura; el CSV Figshare ya viene como lon,lat en WGS84 |

Licencias y atribución: IDE Uruguay (verificar ficha del catálogo antes de redistribuir derivados; uso académico con atribución); OSM/Geofabrik exige ODbL con atribución a OpenStreetMap y sus contribuyentes (aplica al respaldo y a SmartWaste, que deriva de OSM); Figshare declara CC BY 4.0 y origen en datos abiertos de la Intendencia de Montevideo (licencia DAG-UY); datos operativos IM/BasuraCero bajo DAG-UY con crédito a IM + BasuraCero como espejo; Mendeley/SmartWaste verificar ficha antes de redistribuir. El dataset derivado deberá publicarse con atribución a estas fuentes y, por el componente OSM/IDE que corresponda, bajo la licencia que exija la fuente primaria (a confirmar en el issue #9 antes de redistribuir artefactos). De Windsor solo quedan estadísticos agregados históricos, sin filas.

## Esquema

### `nodos.csv` (uno por intersección)

| Campo | Tipo | Significado | Origen |
|---|---|---|---|
| `nodo_id` | id (`N0001`…) | Identificador estable del nodo | Real-derivado IDE |
| `lon` | numérico | Longitud WGS84 (EPSG:4326) | Real-derivado IDE |
| `lat` | numérico | Latitud WGS84 (EPSG:4326) | Real-derivado IDE |

### `tramos.csv` (uno por tramo no dirigido; tabla principal de ML)

| Campo | Tipo | Significado | Origen |
|---|---|---|---|
| `tramo_id` | id (`reftramo` IDE; `T0001`… solo como alias ilustrativo) | Identificador estable de la arista; en el #9 `tramo_id = reftramo` (con sufijo si un eje se parte al crear nodos) | Real-derivado IDE |
| `nodo_origen` | id | Extremo 1 (FK a `nodos`) | Real-derivado IDE |
| `nodo_destino` | id | Extremo 2 (FK a `nodos`) | Real-derivado IDE |
| `longitud_m` | numérico | Largo geodésico del tramo en metros (geodésica WGS84, no euclídea en grados) | Real-derivado IDE |
| `nombre_calle` | texto (puede ser vacío) | Nombre IDE (`nombre`) si existe | Real-derivado IDE |
| `tipo_zona` | categórica | `residencial` / `comercial` / `industrial` | **Única simulada por diseño**, regla + semilla en #9 (≈60/25/15); encoding OneHot en #10, no ordinal |
| `cantidad_contenedores` | entero ≥ 0 | Contenedores asignados al tramo por cercanía | Real-derivado (snap de coordenadas al tramo más cercano; radio y desempates en #9) |
| `dias_desde_ultima_recoleccion` | entero ≥ 0 | Días desde la última recolección en la foto T0 | **Real** (BasuraCero `daysWithoutLift` agregado por tramo; agregación máx vs media a fijar en #9; auditar cola 0–486) |
| `historico_quejas_vecinales` | entero ≥ 0 | Reclamos del tramo en la ventana previa a T0 | **Real** (Por Mi Barrio, lista cerrada de categorías de residuos + deduplicación en #9) |
| `prioridad_recoleccion` | categórica | `baja` / `media` / `alta`; variable a predecir | **Construida** por la regla v1 de abajo; no oficial |

Semántica temporal: cada fila es un tramo en una foto de referencia T0 (fecha = `dateData` del snapshot BasuraCero que use el #9; hoy `2026-10-23 15:00`, a re-descargar foto fresca y registrarla). `dias_*` y `historico_*` miran hacia atrás desde T0. No hay series temporales en v1.

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

Justificación: con las distribuciones previstas (días uniforme 0–7; quejas sesgadas a 0–2; contenedores por tramo mayormente 0–2; zonas 60/25/15), una simulación Monte Carlo de 10,000 casos da ≈37% baja / 34% media / 29% alta. Con datos reales (`dias` 0–486 con cola alta, quejas reales) el balance puede diferir: si difiere mucho, el issue #9 podrá recalibrar los umbrales, pero deberá registrar los valores finales y el balance obtenido. El modelo aprenderá esta regla; una buena métrica no prueba utilidad operativa real.

Nota de leakage para el #10 (obligatoria): la etiqueta es función exacta de 4 columnas, así que no vale hacer selección de features mirando todo el dataset ni escalar antes del split. Todo lo que aprende de los datos va adentro del `Pipeline` (curso Intro-A-ML, `clases/sesion-05-evaluacion-de-modelos/notebook-2-validacion-cruzada.ipynb`, celdas 26–27: `pipeline_honesto` vs accuracy con leakage y remate "todo va adentro del pipeline"). En el #10: `train_test_split(..., stratify=y, random_state=0)` (patrón de `clases/sesion-05-evaluacion-de-modelos/notebook-1-metricas.ipynb`, celda 4–5: "Usamos `stratify=y` para que los dos conjuntos tengan la misma proporción") + validación cruzada de 5 folds (`cross_validate`/`cross_val_score` con `cv=5`, sesión 5) porque con ~100–200 aristas un solo split varía una barbaridad; `OneHotEncoder` para `tipo_zona` dentro del pipeline (no ordinal 0/1/2; en clase `pd.get_dummies(autos, columns=["marca"])`, `clases/sesion-02-python-y-preprocesamiento/notebook-2-preprocesamiento.ipynb`, celda 8); `StandardScaler` solo donde aplica (Logística/kNN/SVM, no árbol) vía `make_pipeline` (duelo final de `clases/sesion-04-arboles-knn-svm/notebook-2-knn-svm.ipynb`, celda 37–38); métricas de sesión 5 (accuracy, precisión, recall, F1, `classification_report`, matriz de confusión) + baseline tonto (predecir siempre la mayoría).

## Ejemplos ilustrativos (coherentes con la regla v1)

| `tramo_id` | `nodo_origen` | `nodo_destino` | `longitud_m` | `tipo_zona` | `cantidad_contenedores` | `dias_desde_ultima_recoleccion` | `historico_quejas_vecinales` | `score` | `prioridad_recoleccion` |
|---|---|---|---|---|---|---|---|---|---|
| T0001 | N0001 | N0002 | 85.5 | residencial | 1 | 2 | 0 | 5 | baja |
| T0002 | N0002 | N0003 | 120.0 | comercial | 2 | 4 | 2 | 18 | alta |
| T0003 | N0003 | N0004 | 96.3 | industrial | 1 | 3 | 1 | 11 | media |
| T0004 | N0001 | N0005 | 74.2 | residencial | 0 | 0 | 0 | 0 | baja |
| T0005 | N0005 | N0006 | 142.8 | comercial | 3 | 6 | 3 | 26 | alta |

## Qué queda para los issues #9 y #10 (sin implementar acá)

- #9 (script reproducible, sin entrenar): fijar T0 = `dateData` del snapshot BasuraCero usado (hoy `2026-10-23 15:00`; re-descargar foto fresca y registrarla); ventana de quejas `[T0−30d, T0)`; lista cerrada de categorías Por Mi Barrio que cuentan como queja (con 5 ejemplos auditados a mano); agregación de `daysWithoutLift` por tramo (propuesta: máx, con media como auxiliar; la cola 0–486 exige aislar fuera de servicio); radio de snap contenedor→tramo + regla de desempate + tratamiento de duplicados (11.556 filas vs 11.458 únicos) + CRS (UTM 21S SRID 32721 → WGS84) + fórmula de `longitud_m` geodésica; `tramo_id = reftramo`; `tipo_zona` simulada con semilla 0; regla v1 + balance final; partición documentada con `stratify` + semilla 0.
- #10 (modelado sklearn del curso, sin SQLAlchemy/ORM/MySQL): `train_test_split(..., stratify=y, random_state=0)` + CV 5 folds; `OneHotEncoder` para `tipo_zona` dentro del pipeline; `StandardScaler` solo en Logística/kNN/SVM vía `make_pipeline` (no en árbol); anti-leakage estricto; métricas sesión 5 + baseline tonto; las predicciones alimentan la selección de tramos y el circuito (Hierholzer / cartero chino).

## Limitaciones conocidas

- La prioridad es construida para enseñar; no representa el criterio real del municipio.
- `dias_*` es real BasuraCero (con cola 0–486 a auditar) y `historico_*` es real Por Mi Barrio (un solo canal, a deduplicar); solo `tipo_zona` es simulada por diseño.
- Foto única: no mide generalización temporal.
- Piloto pequeño (~100–200 aristas esperadas): suficiente para el TP, no para producción.
- Hay un desfase temporal entre coordenadas (instantánea 2021 o anterior) y la red vial (2026); se documenta y se acepta para el TP.
