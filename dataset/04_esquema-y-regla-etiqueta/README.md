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
| `tramo_id` | id (`reftramo`) | Identificador estable de arista | Real-derivado IDE |
| `nodo_origen` | id | Extremo 1 (FK a `nodos`) | Real-derivado IDE |
| `nodo_destino` | id | Extremo 2 (FK a `nodos`) | Real-derivado IDE |
| `longitud_m` | numérico | Largo geodésico (m) | Real-derivado IDE |
| `nombre_calle` | texto (puede ser vacío) | Nombre de la vía | Real-derivado IDE |
| `tipo_zona` | categórica | `residencial` / `comercial` / `industrial` | Simulado (60/25/15), semilla en #9 |
| `cantidad_contenedores` | entero ≥ 0 | Contenedores del tramo por cercanía | Real-derivado (snap, radio en #9) |
| `dias_desde_ultima_recoleccion` | entero ≥ 0 | Días desde última recolección en T0 | Real (levantes, `daysWithoutLift`) |
| `prioridad_recoleccion` | categórica | `baja` / `media` / `alta` (a predecir) | **Construida**, regla v1 |

Semántica: cada fila es un tramo en una foto de referencia T0 (`2026-10-23`).
Sin series temporales en v1.

> `historico_quejas_vecinales` se **eliminó** (decisión de equipo, issue #9):
> la fuente Por Mi Barrio termina en 2020 y no aporta señal en la foto T0.

## Regla de etiqueta v1 (construida, pública, no oficial)

```text
zona_w = 2 si comercial, 1 si industrial, 0 si residencial
score  = 2*dias_desde_ultima_recoleccion
       + 1*cantidad_contenedores + zona_w
baja si score <= 0 | media si 1-2 | alta si score >= 3
```

La regla original (issue #8) incluía `3*historico_quejas_vecinales` y umbrales
`baja ≤ 10, media 11–16, alta ≥ 17`; con los datos reales daba 99.7 % "baja".
Sin quejas, umbrales recalibrados → balance **43.4 % baja / 42.1 % media /
14.5 % alta**. El modelo aprenderá esta regla: la métrica no prueba utilidad
operativa real y así debe decir el informe.

## Ejemplos (verificados contra la regla)

| tramo | zona | cont. | días | score | prioridad |
|---|---|---|---|---|---|
| T0001 | residencial | 0 | 0 | 0 | baja |
| T0002 | residencial | 1 | 0 | 1 | media |
| T0003 | industrial | 0 | 0 | 1 | media |
| T0004 | comercial | 1 | 0 | 3 | alta |
| T0005 | residencial | 2 | 1 | 4 | alta |

## Plan del script (issue #9, detalle)

Stack del curso (Intro-ML, sesiones 1–5): Python + numpy, pandas,
matplotlib y scikit-learn, con notebooks de referencia para
preprocesamiento, los 4 clasificadores y evaluación. Extras requeridos
por el TP (fuera del curso, justificados): manipulación geoespacial
mínima (p. ej. pyproj o parsing propio) y networkx para grafos.
Semilla fija y versionada. Pasos: 1) clip al bbox y
construcción del grafo + componente conexo mayor; 2) snap de contenedores;
3) `dias_desde_ultima_recoleccion` real; 4) `tipo_zona` simulada; 5) regla v1
y reporte de balance; 6) escritura de `nodos.csv`/`tramos.csv` + `README` de
procedencia. La partición train/test (sesión 2: `train_test_split`,
encoding de `tipo_zona` con lo visto en clase) y las métricas
(sesión 5: accuracy/precisión/recall/F1, matriz, validación cruzada)
son del issue #10.
