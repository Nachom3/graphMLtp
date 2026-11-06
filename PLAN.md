# Plan del TP: recolección de residuos

## Objetivo

Sistema que predice la prioridad de recolección de cada tramo de calle
(alta / media / baja) y calcula con grafos el circuito del camión que cubra
los tramos prioritarios. Decisiones ya tomadas y pendientes, con su issue.

## Datos (issue #8, definido)

- Dataset **mixto** (diseño v2) en zona piloto de Montevideo. Detalle completo:
  `docs/dataset-recoleccion.md`; fuentes y archivos: `dataset/README.md`.
- Geometría vial real-derivada de ejes IDE Uruguay (**fuente primaria**; OSM Geofabrik queda solo como respaldo / contingencia con versión congelada) + contenedores reales por cercanía (primario BasuraCero, respaldo Figshare);
  `dias_*` real (BasuraCero) + `historico_quejas` real (Por Mi Barrio); **única simulada: `tipo_zona`**; etiqueta **construida** con regla v1
  (el modelo aprenderá esa regla: declararlo en el informe).
- IDE/OSM y Leaflet no se pisan: el dato vial viene de IDE (respaldo OSM); Leaflet
  (abajo) solo lo visualiza.

## Preparación reproducible (issue #9, pendiente)

Script Python con semilla fija (sin implementar acá): clip IDE al bbox → grafo + componente conexo
→ snap de contenedores (radio + desempates + duplicados documentados) → `tipo_zona` única simulada + `dias` real agregado + `quejas` reales mapeadas → regla v1 → `nodos.csv` +
`tramos.csv` con balance reportado. Partición train/test documentada (`stratify`, semilla 0). T0, ventana de quejas, radio de snap y agregación de `dias` se fijan en el #9.

## Modelo (issue #10, pendiente)

Comparar `DecisionTreeClassifier` (sesión 4) contra al menos otro del curso
(`LogisticRegression` multiclase OvR/softmax de sesión 3, `KNeighborsClassifier`
o `SVC` de sesión 4). Camino crítico sklearn (Intro-A-ML):
`train_test_split(..., stratify=y, random_state=0)` (`clases/sesion-05-evaluacion-de-modelos/notebook-1-metricas.ipynb`, celda 4–5) + CV 5 folds (`cross_validate`/`cross_val_score`, sesión 5);
OneHot para `tipo_zona` dentro del pipeline (no ordinal; antecedente `pd.get_dummies(autos, columns=["marca"])` en `clases/sesion-02-python-y-preprocesamiento/notebook-2-preprocesamiento.ipynb`, celda 8);
`StandardScaler` solo donde aplica (Logística/kNN/SVM, no árbol) vía `make_pipeline` (duelo final en `clases/sesion-04-arboles-knn-svm/notebook-2-knn-svm.ipynb`, celda 37–38);
anti-leakage: todo lo que aprende de los datos adentro del pipeline (`clases/sesion-05-evaluacion-de-modelos/notebook-2-validacion-cruzada.ipynb`, celdas 26–27);
métricas de sesión 5 sobre test separado: accuracy, precisión, recall, F1,
matriz de confusión + baseline tonto (predecir siempre la mayoría) (+ validación cruzada). Predicciones →
selección de tramos (p. ej. media o alta) → Hierholzer; si no es euleriano,
cartero chino (Dijkstra + emparejamiento mínimo).

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

Issue #12 (esta branch): capas en `docs/architecture/backend.md`, contrato
API v1 en `docs/contracts/api-v1.md`, código en `backend/src/recoleccion/`,
notebook en `notebooks/12_arquitectura_backend.ipynb`. Ejecución: ver
`backend/README.md`.

## Orden de trabajo

1. #8 Cerrar definición (este plan + `dataset/` + revisión pendiente).
2. #9 Script reproducible y CSV finales.
3. #10 Entrenar, comparar y conectar predicciones → grafo → API → Leaflet.
