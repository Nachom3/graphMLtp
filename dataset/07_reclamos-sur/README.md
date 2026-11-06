# 07 · Reclamos reales (Por Mi Barrio + SUR pendiente)

## Por Mi Barrio `pormibarrio_reports.csv` ✅ descargado

- Fuente: dataset `Reportes y totales de reclamos en Por Mi Barrio`
  (Data Uruguay), CSV `reports.csv` de 1.836.062 bytes servido desde el
  dominio del catálogo (ese sí responde). Son reportes ciudadanos con estado.
- Columnas: `category, confirmed, detail, external_id, id, lastupdate,
  lastupdate_council, latitude, longitude, name, postcode, state, title,
  whensolent→whensent`.
- Contenido verificado: 4.863 reportes, todos con `latitude/longitude`.
  Categorías de residuos (conteos exactos a validar contra taxonomía):
  Residuo fuera del contenedor 581, Levante basurales 393, Traslado de
  contenedor 204, Contenedor roto 122, Falta barrido 95, Residuos fuera del
  contenedor 84, Basural de grandes dimensiones 63, Contenedor lleno 29,
  Residuos fuera por capacidad insuficiente 28, Contenedor lleno o
  desbordado 27, Residuos en la vía pública 24, Presencia de basural 22,
  Falta de levante manual 21, más solicitudes de contenedores/escombros.
  Resto: alumbrado, baches, poda, etc. (no residuos).
- Uso: es la fuente real para `historico_quejas_vecinales` (con coordenadas
  propias, sin depender del SUR). Caveats: un solo canal (app), no todos los
  reclamos; auditar duplicados y categorías antes de contar (reglas del
  mapeo SUR valen igual acá).

## SUR oficial (pendiente, servidor caído)

- `reclamos.zip` (~44 MB) + `metadata.txt`: con el mapeo de los 3
  exploradores listo (keywords, estados, join por snap). Reintentar cuando
  la IM levante el servidor; el SUR trae más volumen y la taxonomía
  área/grupo/tipo.
