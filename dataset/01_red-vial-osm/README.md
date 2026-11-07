# 01 · Red vial (OpenStreetMap vía Geofabrik)

## Fuente

- Descarga: `https://download.geofabrik.de/south-america/uruguay-latest-free.shp.zip`
- Portal: `https://download.geofabrik.de/south-america/uruguay.html`
- Licencia: Open Database License (ODbL) de la OpenStreetMap Foundation:
  permite copiar, adaptar y redistribuir exigiendo atribución a OpenStreetMap
  y sus contribuyentes, y misma licencia para la base derivada.
  Ver `https://www.openstreetmap.org/copyright`.
- Fecha de descarga: 05/11/2026. Last-Modified del servidor:
  Thu, 05 Nov 2026 01:14:17 GMT. Datos OSM al 04/11/2026 aprox.
- Archivo local: `uruguay-latest-free.shp.zip`, 80.527.570 bytes,
  SHA-256 `37fd738ab8780a0b67add69a2f839fd7d7efd8fc65d0581651d38e3283ea411b`.

## Contenido del ZIP

Shapefiles por capa (formato ESRI). La que nos interesa:

- `gis_osm_roads_free_1.*` (`.shp` 34.939.508 bytes + `.dbf` 24.520.524 bytes
  + `.shx` + `.prj` + `.cpg`): 133.990 registros viales de todo Uruguay,
  geometría PolyLine (shape type 13), bbox global lon −58.56…−53.06,
  lat −35.02…−29.95.
- El resto (edificios, usos de suelo, agua, etc.) no se usa en v1.

Sistema de referencia: el `.prj` declara `GCS_WGS_1984` (grados decimales).
Todo el trabajo geoespacial del TP es en WGS84 (EPSG:4326).

## Zona piloto y conteos

Bbox v1 (lon/lat): oeste `-56.16`, sur `-34.915`, este `-56.15`,
norte `-34.905` (Montevideo, ~1 km × ~1.1 km).

Registros viales cuyo bbox intersecta cada recorte (aproximación por
intersección de bbox, no segmentación final):

| Recorte | Bbox (o,s,e,n) | Viales intersectados | Contenedores dentro |
|---|---|---|---|
| v1 pequeña | −56.16,−34.915,−56.15,−34.905 | 138 | 196 |
| media (reserva) | −56.17,−34.92,−56.14,−34.90 | 895 | 788 |
| grande (reserva) | −56.18,−34.925,−56.13,−34.895 | 1945 | 1125 |

Se eligió la pequeña: ~100–200 aristas esperadas tras el clip, ideal para
entrenar un clasificador demo y visualizar Hierholzer. Si el componente
conexo mayor queda con menos de ~100 aristas, el issue #9 amplía al recorte
medio y lo registra.

## Cómo se usará (issue #9)

1. Extraer `gis_osm_roads_free_1.*` del ZIP.
2. Recortar al bbox v1 y construir el grafo: nodos en intersecciones y
   extremos recortados, aristas por tramo entre nodos.
3. Quedarse con el componente conexo mayor; numerar `N0001…` y `T0001…`.
4. Calcular `longitud_m` geodésica por arista y copiar `nombre_calle` OSM
   cuando exista (puede quedar vacío).
5. Registrar versión del extracto, bbox, conteos y semilla en la salida.

## Reproducibilidad

El ZIP no se versiona en git (ver `dataset/.gitignore`): cualquiera lo
re-descarga de la URL de arriba y verifica el SHA-256. Si Geofabrik publica
un extracto nuevo, el issue #9 anota la fecha y decide si se congela esta
versión o se actualiza (los conteos pueden variar levemente).
