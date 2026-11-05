# 03 · Reclamos de Windsor (solo referencia de calibración)

## Fuente

- Ficha: `https://opendata.citywindsor.ca/details/171`
  (`Garbage Not Collected Service Requests`, ciudad de Windsor, Ontario).
- Archivo local: `Garbage_Not_Collected_2025.csv`, 278.071 bytes,
  SHA-256 `ffa713d17ee4b63a55d2030e5619624cbaca316f0a6c889ea0171f5f93499fbc`.
- Columnas: `Service Request Description`, `Department`, `Block/Address`,
  `Street`, `Ward`, `Method Received`, `Created Date`.

## Contenido (verificado por lectura directa)

- 2.465 filas de reclamos + encabezado, año 2025 (rango observado en el
  archivo: abr–sep 2025).
- 546 calles distintas. Reclamos por calle: mínimo 1, máximo 60
  (TECUMSEH), media 4,51, mediana 2. Top: TECUMSEH (60), WYANDOTTE (46),
  HALL (44), UNIVERSITY (39), LINCOLN (37).
- Fila de ejemplo: basura no recolectada, `Environmental Services`,
  calle PATRICE, WARD 6, canal Phone, 14-nov-2025.

## Advertencias de la propia fuente

- Son solicitudes iniciadas por vecinos (teléfono, mail, web, texto, app),
  **no** un registro verificado de recolecciones omitidas.
- La ciudad advierte que un reclamo puede resultar inválido al inspeccionarse
  y que puede haber **múltiples reportes del mismo caso**, lo que infla
  conteos. Un reclamo no confirma una recolección.
- Es **otra ciudad y otro país**: jamás deben presentarse estas filas como
  reclamos ocurridos en Montevideo ni unirse a sus calles.

## Uso permitido en este TP

- **Exclusivamente calibración agregada** de la simulación de
  `historico_quejas_vecinales`: con media 4,5 y mediana 2 por calle cada
  ~6 meses, un tramo (fracción de calle) simulado en una ventana de ~30 días
  queda bien modelado con valores 0–6 sesgados a 0–2.
- No se redistribuyen sus filas como parte del dataset sin antes verificar
  su licencia; aquí solo se reutilizan los estadísticos de arriba.
- La columna final de quejas del TP es **simulada con semilla** (issue #9),
  y así debe decir el informe.
