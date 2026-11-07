# Plan del TP: recolección de residuos

## Objetivo

Sistema que predice la prioridad de recolección de cada tramo de calle
(alta / media / baja) y calcula con grafos el circuito del camión que cubra
los tramos prioritarios. Decisiones ya tomadas y pendientes, con su issue.

## Datos (issue #8, definido)

- Dataset **mixto** en zona piloto de Montevideo. Detalle completo:
  `docs/dataset-recoleccion.md`; fuentes y archivos: `dataset/README.md`.
- Geometría vial real-derivada de ejes IDE Uruguay + contenedores reales por cercanía;
  operativas simuladas con semilla; etiqueta **construida** con regla v1
  (el modelo aprenderá esa regla: declararlo en el informe).
- OSM y Figshare/Leaflet no se pisan: el dato vial viene de OSM; Leaflet
  (abajo) solo lo visualiza.

## Preparación reproducible (issue #9, pendiente)

Script Python con semilla fija: clip OSM al bbox → grafo + componente conexo
→ snap de contenedores → variables simuladas → regla v1 → `nodos.csv` +
`tramos.csv` con balance reportado. Partición train/test documentada.

## Modelo (issue #10, pendiente)

Comparar `DecisionTreeClassifier` (sesión 4) contra al menos otro del curso
(`LogisticRegression` multiclase OvR/softmax de sesión 3, `KNeighborsClassifier`
o `SVC` de sesión 4), con `make_pipeline`+`StandardScaler` donde aplique.
Métricas de sesión 5 sobre test separado: accuracy, precisión, recall, F1,
matriz de confusión (+ validación cruzada). Predicciones →
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
el frontend consume esa API. Atribución obligatoria: OpenStreetMap (ODbL) +
Figshare CC BY 4.0.

Issue #12: capas en `docs/architecture/backend.md`, contrato
API v1 en `docs/contracts/api-v1.md`, código en `backend/src/recoleccion/`,
notebook en `notebooks/12_arquitectura_backend.ipynb`. Ejecución: ver
`backend/README.md`.

## Orden de trabajo

1. #8 Cerrar definición (este plan + `dataset/` + revisión pendiente).
2. #9 Script reproducible y CSV finales.
3. #10 Entrenar, comparar y conectar predicciones → grafo → API → Leaflet.
