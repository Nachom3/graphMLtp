# Plan del TP: recolección de residuos

## Objetivo

Sistema que predice la prioridad de recolección de cada tramo de calle
(alta / media / baja) y calcula con grafos el circuito del camión que cubra
los tramos prioritarios. Decisiones ya tomadas y pendientes, con su issue.

## Datos (issue #8, definido)

- Dataset **mixto** (diseño v2) en zona piloto de Montevideo. Detalle completo:
  `docs/dataset-recoleccion.md`; fuentes y archivos: `dataset/README.md`.
- Geometría vial real-derivada de ejes IDE Uruguay (**fuente primaria**; OSM Geofabrik queda solo como respaldo / contingencia con versión congelada) + contenedores reales por cercanía (primario BasuraCero, respaldo Figshare);
  `dias_*` real (BasuraCero) y `tipo_zona` simulada. El dataset del #9 no
  incluye quejas; #18 agrega `historico_quejas_vecinales` simulado en memoria.
  La etiqueta es **construida**: el modelo aprenderá la regla, no
  una prioridad operativa real.
- IDE/OSM y Leaflet no se pisan: el dato vial viene de IDE (respaldo OSM); Leaflet
  (abajo) solo lo visualiza.

## Preparación reproducible (issue #9, cerrado)

El script `scripts/build_dataset.py` genera `nodos.csv` y `tramos.csv` con
semilla fija: clip IDE al bbox → grafo y componente conexo → snap de
contenedores → `tipo_zona` simulada y `dias` real agregado → regla v1 y
balance reportado. T0, radio de snap y agregación de `dias` se documentan en
el #9.

## Preparación para ML (issue #18, implementado)

`backend/src/collection/adapters/datasets/ml_preparation.py` expone
`prepare_dataset(source, seed=0)`. Lee el CSV del #9 sin escribirlo, valida
columnas/IDs/categorías/valores, conserva la etiqueta #9 en
`prioridad_recoleccion_original` y entrega `X`, `y`, `tramo_ids`, particiones
con índices/IDs/distribuciones y un `ColumnTransformer` categórico sin ajustar.

- Las quejas son enteros **sintéticos**, no reclamos reales ni identificadores
  de contenedores. Por cada unidad de `cantidad_contenedores` se hace un sorteo
  anónimo uniforme `[0, 3]`; se suman por tramo y cero contenedores da cero.
  Semilla predeterminada: `0`; cada sorteo se deriva establemente de semilla y
  `tramo_id`, por lo que el orden de filas no lo altera.
- La etiqueta nueva también es sintética: `score = 2*dias + contenedores +
  zona_w + 2*quejas`, `zona_w={residencial: 0, industrial: 1, comercial: 2}`;
  baja `score <= 0`, media `1..2`, alta `>2`. Dataset real leído (297 tramos,
  seed 0): baja 129 (43.4 %), media 93 (31.3 %), alta 75 (25.3 %). La etiqueta
  sintética anterior del #9 tenía 43.4/42.1/14.5 %. Ninguna es una prioridad
  operativa medida.
- `X`: `cantidad_contenedores`, `dias_desde_ultima_recoleccion`, `tipo_zona`,
  `historico_quejas_vecinales`; `y`: `prioridad_recoleccion`; `tramo_id` solo
  para trazabilidad. Split por semilla 0 y estratificación cuando viable:
  178/59/60 filas en este CSV; primero 60 % train y luego el resto dividido
  por mitades, con los IDs y distribución de cada partición registrados.
- #18 no entrena ni selecciona clasificadores. #10 ajusta el pipeline completo
  dentro de CV/GridSearchCV, contrasta en validación y usa test una sola vez.
  `tipo_zona` usa OneHot con `handle_unknown="ignore"`; las numéricas pasan
  intactas. Dependencias ya declaradas en `backend/requirements.txt`.

## Modelo (issue #10, pendiente)

Comparar `DecisionTreeClassifier` (sesión 4) contra al menos otro del curso
(`LogisticRegression`, `KNeighborsClassifier` o `SVC`). Sobre el **60 % de
entrenamiento**, solicitar validación cruzada estratificada de 5 folds. Si la
clase menos frecuente tiene menos ejemplos, reducir los folds a ese mínimo y
registrar `cv_folds_usados`; si no son viables al menos 2 folds estratificados,
informar el problema. Usar `GridSearchCV` con una grilla pequeña de
hiperparámetros en los folds de ese 60 %, sin usar el 20 % de validación
reservado ni el test. Usar la validación reservada para
contrastar y elegir el modelo, y evaluar el elegido una sola vez sobre test.

OneHot para `tipo_zona` y cualquier transformación que aprenda de los datos
van dentro del pipeline de cada fold. Usar `StandardScaler` solo cuando el
modelo lo requiera. Reportar métricas multiclase y una línea base, sin elegir
el modelo con los resultados de test. Referencias: sesión 5, diapositivas 24,
30–32 y `clases/sesion-05-evaluacion-de-modelos/notebook-2-validacion-cruzada.ipynb`.

Predicciones → selección de tramos (p. ej. media o alta) → Hierholzer; si no
es euleriano, cartero chino (Dijkstra + emparejamiento mínimo).

## Frontend (decidido: Leaflet)

- Librería: [Leaflet](https://leafletjs.com/) para el mapa en el navegador.
- Muestra: grafo de calles con tramos coloreados por prioridad predicha,
  recorrido paso a paso (incluyendo tramos repetidos) y costo total.
- Rol claro: Leaflet **visualiza** lo que el backend calcula; no provee
  datos viales ni ejecuta los algoritmos.

## Backend y arquitectura

FastAPI (ver `lineamentos.md`): expone preparación, modelo y grafos por API;
el frontend consume esa API. Camino crítico: CSV + pandas + sklearn, FastAPI solo como API, sin DB en v1; sin SQLAlchemy / sin ORM / sin MySQL. Atribución obligatoria: IDE Uruguay + OpenStreetMap (ODbL, respaldo) +
Figshare CC BY 4.0 + IM/BasuraCero (DAG-UY).

Issue #12: capas en `docs/architecture/backend.md`, contrato
API v1 en `docs/contracts/api-v1.md`, código en `backend/src/collection/`,
notebook en `notebooks/12_arquitectura_backend.ipynb`. Ejecución: ver
`backend/README.md`.

## Orden de trabajo pendiente

1. #18 Revisar y entregar la preparación de datos para ML en el backend.
2. #10 Entrenar, comparar y conectar predicciones → grafo → API → Leaflet.
