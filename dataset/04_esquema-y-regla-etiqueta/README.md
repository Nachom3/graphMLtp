# 04 · Esquema final y regla de etiqueta

## `nodos.csv` (uno por intersección)

| Campo | Tipo | Significado | Origen |
|---|---|---|---|
| `nodo_id` | id (`N0001`…) | Identificador estable | Real-derivado IDE |
| `lon` | numérico | Longitud WGS84 (EPSG:4326) | Real-derivado IDE |
| `lat` | numérico | Latitud WGS84 (EPSG:4326) | Real-derivado IDE |

## `tramos.csv` (uno por tramo no dirigido; tabla de ML)

| Campo | Tipo | Significado | Origen |
|---|---|---|---|
| `tramo_id` | id (`reftramo` IDE; `T0001`… solo alias ilustrativo) | Identificador estable de arista; en el #9 `tramo_id = reftramo` | Real-derivado IDE |
| `nodo_origen` | id | Extremo 1 (FK a `nodos`) | Real-derivado IDE |
| `nodo_destino` | id | Extremo 2 (FK a `nodos`) | Real-derivado IDE |
| `longitud_m` | numérico | Largo geodésico (m, geodésica WGS84) | Real-derivado IDE |
| `nombre_calle` | texto (puede ser vacío) | Nombre IDE (`nombre`) si existe | Real-derivado IDE |
| `tipo_zona` | categórica | `residencial` / `comercial` / `industrial` | **Única simulada por diseño** (≈60/25/15), semilla en #9; en #10 OneHot dentro del pipeline, no ordinal |
| `cantidad_contenedores` | entero ≥ 0 | Contenedores del tramo por cercanía | Real-derivado (snap BasuraCero/Figshare, radio en #9) |
| `dias_desde_ultima_recoleccion` | entero ≥ 0 | Días desde última recolección en T0 | **Real** (BasuraCero `daysWithoutLift` agregado por tramo; agregación a fijar en #9) |
| `historico_quejas_vecinales` | entero ≥ 0 | Reclamos del tramo en ventana previa a T0 | **Real** (Por Mi Barrio, lista cerrada de categorías + deduplicación en #9) |
| `prioridad_recoleccion` | categórica | `baja` / `media` / `alta` (a predecir) | **Construida**, regla v1 |

Semántica: cada fila es un tramo en una foto de referencia T0 (fecha = `dateData` del snapshot BasuraCero que use el #9; hoy `2026-10-23 15:00`). Sin series temporales en v1. Cubre los 6 campos mínimos del
enunciado más los 3 del grafo (`nodo_origen`, `nodo_destino`, `longitud_m`).

## Regla de etiqueta v1 (construida, pública, no oficial)

```text
zona_w = 2 si comercial, 1 si industrial, 0 si residencial
score  = 2*dias_desde_ultima_recoleccion
       + 3*historico_quejas_vecinales
       + 1*cantidad_contenedores + zona_w
baja si score <= 10 | media si 11–16 | alta si score >= 17
```

Balance estimado por Monte Carlo (10.000 casos, supuesto simulado): ≈37 % baja, 34 % media,
29 % alta. Con `dias` real (cola 0–486) y quejas reales el balance puede diferir: si difiere mucho, el issue #9 recalibra umbrales y
registra valores + balance final. El modelo aprenderá esta regla: la métrica
no prueba utilidad operativa real y así debe decir el informe. Como la etiqueta es función exacta de 4 columnas, el #10 debe tratarla como leakage declarado (sin selección de features sobre todo el dataset, sin escalar antes del split).

## Ejemplos (verificados contra la regla)

| tramo | zona | cont. | días | quejas | score | prioridad |
|---|---|---|---|---|---|---|
| T0001 | residencial | 1 | 2 | 0 | 5 | baja |
| T0002 | comercial | 2 | 4 | 2 | 18 | alta |
| T0003 | industrial | 1 | 3 | 1 | 11 | media |
| T0004 | residencial | 0 | 0 | 0 | 0 | baja |
| T0005 | comercial | 3 | 6 | 3 | 26 | alta |

## Plan del script (issue #9, detalle; sin implementar acá)

Stack del curso (Intro-ML, sesiones 1–5): Python + numpy, pandas,
matplotlib y scikit-learn (`Intro-A-ML/requirements.txt`: solo esos 6 paquetes + jupyter; sin sqlalchemy/mysql/orm), con notebooks de referencia para
preprocesamiento, los 4 clasificadores y evaluación. Extras requeridos
por el TP (fuera del curso, justificados): manipulación geoespacial
mínima (p. ej. pyproj o parsing propio) y networkx para grafos.
Semilla fija y versionada. Pasos: 1) clip IDE al bbox y
construcción del grafo + componente conexo mayor; 2) snap de contenedores (radio + desempate + duplicados documentados); 3) `tipo_zona` única simulada + `dias` real agregado por tramo + `quejas` reales mapeadas y deduplicadas; 4) regla v1 y reporte
de balance; 5) escritura de `nodos.csv`/`tramos.csv` + `README` de
procedencia. Sin SQLAlchemy / sin ORM / sin MySQL en el camino crítico: CSV + pandas + sklearn.

## Camino crítico sklearn para el #10 (explícito, con evidencia del curso)

- Partición: `train_test_split(X, y, test_size=0.3, random_state=0, stratify=y)` (patrón de `clases/sesion-05-evaluacion-de-modelos/notebook-1-metricas.ipynb`, celda 4–5: "Usamos `stratify=y` para que los dos conjuntos tengan la misma proporción") + validación cruzada 5 folds (`cross_validate`/`cross_val_score` con `cv=5`, `clases/sesion-05-evaluacion-de-modelos/notebook-2-validacion-cruzada.ipynb`).
- Encoding: `tipo_zona` con OneHot dentro del pipeline (`ColumnTransformer` + `OneHotEncoder`), nunca ordinal 0/1/2. En clase el antecedente es `pd.get_dummies(autos, columns=["marca"])` (`clases/sesion-02-python-y-preprocesamiento/notebook-2-preprocesamiento.ipynb`, celda 8).
- Escalado: `StandardScaler` solo donde aplica — Logística/kNN/SVM — vía `make_pipeline`, no en el árbol. Duelo final del curso (`clases/sesion-04-arboles-knn-svm/notebook-2-knn-svm.ipynb`, celda 37–38): `{"Logística": make_pipeline(StandardScaler(), LogisticRegression()), "Árbol (depth=5)": DecisionTreeClassifier(...), "kNN (k=15)": make_pipeline(StandardScaler(), KNeighborsClassifier(...)), "SVM (rbf)": make_pipeline(StandardScaler(), SVC(...))}`; antecedente en `clases/sesion-05-evaluacion-de-modelos/notebook-1-metricas.ipynb`, celda 9: `logistica = make_pipeline(StandardScaler(), LogisticRegression())`.
- Anti-leakage: todo lo que aprende de los datos va adentro del pipeline (`clases/sesion-05-evaluacion-de-modelos/notebook-2-validacion-cruzada.ipynb`, celdas 26–27: `pipeline_honesto` y "todo va adentro del pipeline"). Prohibido `fit_transform` sobre todo `tramos.csv` antes del split.
- Métricas sesión 5 + baseline tonto: accuracy, precisión, recall, F1, `classification_report`, matriz de confusión (`ConfusionMatrixDisplay`) y `cross_validate(..., cv=5, scoring=[...])` + predecir-siempre-la-mayoría como referencia.
