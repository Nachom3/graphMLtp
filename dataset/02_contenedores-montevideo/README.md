# 02 · Contenedores de Montevideo (coordenadas) — respaldo geográfico

> En el diseño v2 la capa primaria de contenedores es el snapshot operativo BasuraCero (`dataset/09_levantes/`, con `circuitCode` + `daysWithoutLift` + coords). Este CSV Figshare queda como respaldo geográfico si el ZIP oficial de la IM falla.

## Fuente

- Dataset: `Montevideo Garbage Containers`, Toyos, Guillermo; Vallcorba,
  Federico (2021). Figshare, DOI `10.6084/m9.figshare.17126738.v1`.
  Ficha: `https://figshare.com/articles/dataset/Montevideo_Garbage_Containers/17126738`.
- Licencia de la ficha: CC BY 4.0 (`https://creativecommons.org/licenses/by/4.0/`).
  La descripción indica que las coordenadas provienen del dataset abierto de
  la Intendencia de Montevideo (licencia DAG de Uruguay).
- Repositorio de referencia del mismo proyecto: `Gtoyos/RecoleccionBasura-GA`
  (algoritmo evolutivo para rutas de recolección, UDELAR 2021). Su script
  `scripts/conversionCoordenadas.py` documenta la conversión original de
  X,Y (SIRGAS2000 ITRF2000, UTM 21S, EPSG:31981) a lon/lat (EPSG:4326).
- Archivo local: `coordenadasContenedores.csv`, 612.468 bytes,
  SHA-256 `9b893afb5b6515b55c11b6f0f8fb382f95917c09cd582e0904980a42c02fe7d9`,
  MD5 `20f6ae05b23b0dc4a3be43318e9a4c11` (coincide con el MD5 de Figshare).

## Formato (verificado por lectura directa)

- CSV **sin encabezado**, 11.556 filas, 2 columnas: `longitud,latitud`
  (en ese orden), WGS84 (EPSG:4326). Ejemplo real:
  `-56.15141666,-34.91994405`.
- 11.458 pares únicos: hay coordenadas repetidas, así que **no** debe
  asumirse que cada fila es un contenedor distinto sin más análisis.
- No trae identificadores, fechas, calles, levantamientos, reclamos ni
  prioridades. Es solo la capa geográfica de contenedores.

## Cobertura temporal y limitaciones

- Instantánea de 2021 o anterior (publicado dic-2021, modificado may-2023).
  Hay desfase con la red vial IDE (2026) y con la foto operativa BasuraCero; se acepta para el TP como respaldo y se declara.
- No informa estado de llenado ni última recolección por sí solo: por eso `cantidad_contenedores` es un conteo por cercanía (snap) y `dias_*` viene de BasuraCero (`09_`), no de este CSV.
- Los duplicados de coordenadas se resuelven en el issue #9 (criterio de
  conteo por tramo a documentar, p. ej. contar filas o colapsar duplicados).

## Cómo se usará (issue #9)

Cada coordenada se asigna al tramo más cercano de la zona piloto (snap con
radio máximo y regla de desempate documentadas). El conteo por tramo es la
columna `cantidad_contenedores` (origen: real-derivado). Atribución obligada
en informe y dataset: OpenStreetMap + Toyos/Vallcorba (Figshare, CC BY 4.0)
+ Intendencia de Montevideo (fuente original).
