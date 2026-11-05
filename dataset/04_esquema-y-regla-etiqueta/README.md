# 04 · Esquema final y regla de etiqueta

## `nodos.csv` (uno por intersección)

| Campo | Tipo | Significado | Origen |
|---|---|---|---|
| `nodo_id` | id (`N0001`…) | Identificador estable | Real-derivado OSM |
| `lon` | numérico | Longitud WGS84 (EPSG:4326) | Real-derivado OSM |
| `lat` | numérico | Latitud WGS84 (EPSG:4326) | Real-derivado OSM |

## `tramos.csv` (uno por tramo no dirigido; tabla de ML)

| Campo | Tipo | Significado | Origen |
|---|---|---|---|
| `tramo_id` | id (`T0001`…) | Identificador estable de arista | Real-derivado OSM |
| `nodo_origen` | id | Extremo 1 (FK a `nodos`) | Real-derivado OSM |
| `nodo_destino` | id | Extremo 2 (FK a `nodos`) | Real-derivado OSM |
| `longitud_m` | numérico | Largo geodésico (m) | Real-derivado OSM |
| `nombre_calle` | texto (puede ser vacío) | Nombre OSM si existe | Real-derivado OSM |
| `tipo_zona` | categórica | `residencial` / `comercial` / `industrial` | Simulado (≈60/25/15), semilla en #9 |
| `cantidad_contenedores` | entero ≥ 0 | Contenedores del tramo por cercanía | Real-derivado (snap, radio en #9) |
| `dias_desde_ultima_recoleccion` | entero 0–7 | Días desde última recolección en T0 | Simulado (uniforme, semilla en #9) |
| `historico_quejas_vecinales` | entero ≥ 0 | Reclamos del tramo en ventana previa a T0 | Simulado (calibrado Windsor, semilla en #9) |
| `prioridad_recoleccion` | categórica | `baja` / `media` / `alta` (a predecir) | **Construida**, regla v1 |

Semántica: cada fila es un tramo en una foto de referencia T0 (fecha a fijar
en el issue #9). Sin series temporales en v1. Cubre los 6 campos mínimos del
enunciado más los 3 del grafo (`nodo_origen`, `nodo_destino`, `longitud_m`).

## Regla de etiqueta v1 (construida, pública, no oficial)

```text
zona_w = 2 si comercial, 1 si industrial, 0 si residencial
score  = 2*dias_desde_ultima_recoleccion
       + 3*historico_quejas_vecinales
       + 1*cantidad_contenedores + zona_w
baja si score <= 10 | media si 11–16 | alta si score >= 17
```

Balance estimado por Monte Carlo (10.000 casos): ≈37 % baja, 34 % media,
29 % alta. Si el piloto real difiere mucho, el issue #9 recalibra umbrales y
registra valores + balance final. El modelo aprenderá esta regla: la métrica
no prueba utilidad operativa real y así debe decir el informe.

## Ejemplos (verificados contra la regla)

| tramo | zona | cont. | días | quejas | score | prioridad |
|---|---|---|---|---|---|---|
| T0001 | residencial | 1 | 2 | 0 | 5 | baja |
| T0002 | comercial | 2 | 4 | 2 | 18 | alta |
| T0003 | industrial | 1 | 3 | 1 | 11 | media |
| T0004 | residencial | 0 | 0 | 0 | 0 | baja |
| T0005 | comercial | 3 | 6 | 3 | 26 | alta |

## Plan del script (issue #9, detalle)

Lenguaje: Python (pandas + numpy; geoespacial a definir según librerías
disponibles). Semilla fija y versionada. Pasos: 1) clip OSM al bbox y
construcción del grafo + componente conexo mayor; 2) snap de contenedores;
3) generación simulada (`tipo_zona`, `dias`, `quejas`); 4) regla v1 y reporte
de balance; 5) escritura de `nodos.csv`/`tramos.csv` + `README` de
procedencia. La partición train/test y las métricas son del issue #10.
