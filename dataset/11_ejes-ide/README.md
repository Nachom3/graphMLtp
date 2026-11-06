# 11 · Ejes oficiales de calles (IDE Uruguay) — fuente primaria del grafo

## Fuente

- Dataset `Ejes de vías de circulación`, Infraestructura de Datos Espaciales
  (IDE Uruguay), en el catálogo nacional.
- Recurso `Ejes de vías de circulación - MONTEVIDEO [CSV]`, 11.299.973 bytes,
  servido desde el dominio del catálogo (ese sí responde).
- Metadatos: `metadatos.json` (2.160 bytes, incluido).
- Licencia: la del catálogo para datos IDE (verificar en la ficha antes de
  redistribuir derivados; uso académico con atribución).

## Formato (verificado por lectura directa)

- 45.400 filas, codificación **latin-1**, columnas:
  `reftramo` (id estable de tramo), `geom` (EWKB hex, MultiLineString,
  **SRID 32721 = UTM 21S**), `idcalle`, `nombre`, `tipo_vialidad`, `fuente`,
  `localidad`, `departamento`.
- Nombres reales (p. ej. `21 DE SETIEMBRE`, `AVENIDA BRASIL`,
  `BULEVAR ESPAÑA`); `tipo_vialidad` (calle, pasaje, avenida…).
- Conversión a WGS84 verificada con PROJ (punto de control cae en
  Montevideo). OSM Geofabrik (`01_`) queda solo como respaldo / contingencia con versión congelada (SHA `37fd73...`, Last-Modified Thu 05 Nov 2026).

## Cobertura del piloto

304 segmentos tocan el bbox (−56.16, −34.915, −56.15, −34.905): más de lo
necesario (~100–200 aristas). Cada fila trae su `reftramo` estable, ideal
como `tramo_id` real (reemplaza IDs sintéticos T0001…).

## Uso en el TP (issue #9)

Clip al bbox → nodos en extremos/intersecciones → componente conexo mayor →
`longitud_m` geodésica (WGS84, no euclídea en grados). `nombre` alimenta `nombre_calle` y el frontend.
`tipo_vialidad`/`idcalle` ayudan a depurar el snap contenedor→tramo.
`tramo_id = reftramo` (con sufijo si un eje se parte al crear nodos; reemplaza IDs sintéticos `T0001…`).
