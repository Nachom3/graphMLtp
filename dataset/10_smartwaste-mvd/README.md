# 10 · SmartWaste MVD (Mendeley, espejo académico)

## Fuente

- Dataset `Waste management routing example`, Ignacio Soler, Mendeley Data,
  DOI `10.17632/d2pw5j592y.1` (paper en Computers and Electrical Engineering).
- Descargado de `data.mendeley.com` (ese host sí responde): `README.md`
  (17.102 bytes) + `smartwaste-mvd-data.zip` (134.506.110 bytes, SHA-256
  `a1a147a8…`, coincide con la ficha). El ZIP queda ignorado por git;
  abajo lo extraído y versionado.
- Licencia: verificar en la ficha de Mendeley antes de redistribuir
  derivados. Datos base: portal de la IM + OSM; matrices vía OSRM propio.

## Lo extraído y por qué importa

- `smartwaste-mvd-data/data/processed/containers_wgs84.csv` (11.590 filas:
  10.937 `active`): `container_id, circuit_id, schedule, status, x_utm,
  y_utm, latitude, longitude, coord_valid, shift, collection_days`.
  **Es la frecuencia de recolección real por contenedor** (p. ej. lunes,
  miércoles y viernes, matutino) + circuito + coordenadas ya en WGS84.
- `circuits_enriched.json`: 134 circuitos con municipio, cantidad de
  contenedores, centroide, turno, días y zona.
- `docs/results/circuit_days_final.csv`: 657 circuit-días con distancias y
  tiempos baseline vs optimizados (referencia de costos de ruteo).
- `simulator/fill_model.py`, `zone_density.py`: modelo de llenado simulado
  calibrado (media 56 %) — metodología de referencia para simulaciones
  declaradas, no dato real.
- Matrices OSRM (`.cache/osrm-matrices/`): presentes en el ZIP, no
  extraídas (pesadas); ver `fetch_matrices.py` si hicieran falta.

## Uso en el TP

- Frecuencia y circuito por contenedor: reales (reemplazan supuestos).
- `containers_enriched.json`/`fixed_locations.json`: revisar en el #9.
- BasuraCero (`09_`) aporta la foto reciente de días sin levantar;
  SmartWaste aporta frecuencia programada y circuitos. Juntos cubren
  `cantidad_contenedores`, `dias_*` y validación del snap a tramos.
