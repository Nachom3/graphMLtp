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
| `historico_quejas_vecinales` | entero ≥ 0 | Suma de conteos anónimos por contenedor | Sintético en memoria (#18); no se escribe al CSV fuente |
| `prioridad_recoleccion` | categórica | `baja` / `media` / `alta` (a predecir) | Etiqueta #9 en fuente; #18 la reemplaza en memoria con regla sintética |

Semántica: cada fila es un tramo en una foto de referencia T0 (`2026-10-23`).
Sin series temporales en v1.

> El CSV fuente #9 no incluye `historico_quejas_vecinales`: la fuente Por Mi
> Barrio termina en 2020. #18 genera en memoria conteos **sintéticos** por cada
> contenedor representado, los suma por tramo y calcula una nueva etiqueta; no
> escribe estos campos en el CSV. No existen IDs de contenedor para identificar
> los sorteos individualmente.

## Regla anterior del #9 (construida y sintética, no oficial)

```text
zona_w = 2 si comercial, 1 si industrial, 0 si residencial
score  = 2*dias_desde_ultima_recoleccion
       + 1*cantidad_contenedores + zona_w
baja si score <= 0 | media si 1-2 | alta si score >= 3
```

En 297 tramos, el balance de esta etiqueta #9 fue **43.4 % baja / 42.1 % media /
14.5 % alta**. La nueva etiqueta de #18 es también sintética y reemplaza esta
etiqueta solo en la preparación en memoria.

## Regla sintética de #18

Con seed predeterminada `0`, cada contenedor representado recibe un sorteo
uniforme `[0, 3]`; se suman por tramo y cero contenedores produce cero quejas.
La etiqueta usa `score=2*dias + contenedores + zona_w + 2*quejas`, con
`zona_w={residencial: 0, industrial: 1, comercial: 2}`; baja `<=0`, media `1..2`,
alta `>2`. En el CSV actual la distribución resultante es 129/297 baja (43.4 %),
93/297 media (31.3 %) y 75/297 alta (25.3 %). Ninguna etiqueta es una prioridad
operativa observada, y una buena métrica no demuestra utilidad operativa real.

## Ejemplos de la etiqueta fuente #9 (verificados contra la regla anterior)

| tramo | zona | cont. | días | score | prioridad |
|---|---|---|---|---|---|
| T0001 | residencial | 0 | 0 | 0 | baja |
| T0002 | residencial | 1 | 0 | 1 | media |
| T0003 | industrial | 0 | 0 | 1 | media |
| T0004 | comercial | 1 | 0 | 3 | alta |
| T0005 | residencial | 2 | 1 | 4 | alta |


