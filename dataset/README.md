# Dataset del TP: recolección de residuos (issue #8)

Definición completa en `docs/dataset-recoleccion.md`. Esta carpeta contiene las
fuentes descargadas, su documentación y el plan de construcción. Generar los
CSV finales (`nodos.csv`, `tramos.csv`) corresponde al issue #9.

## Decisión

Dataset **mixto** en una zona piloto de Montevideo (diseño v2):

- Real-derivado: geometría vial (**fuente primaria ejes IDE Uruguay**) + contenedores por tramo (primario BasuraCero en `09_levantes/`; respaldo geográfico Figshare/IM en `02_contenedores-montevideo/`).
- `dias_desde_ultima_recoleccion` **real** (BasuraCero, foto T0); `historico_quejas_vecinales` **real** (Por Mi Barrio en `07_reclamos-sur/`, ventana previa a T0).
- **Única simulada por diseño**: `tipo_zona` (con semilla, issue #9).
- Etiqueta construida: `prioridad_recoleccion` con regla pública v1 (no oficial). OSM Geofabrik queda solo como respaldo / contingencia con versión congelada.

Zona piloto v1 (WGS84): oeste `-56.16`, sur `-34.915`, este `-56.15`,
norte `-34.905`. Recorte chico (~1 km × ~1.1 km) con 196 contenedores Figshare (129 del snapshot BasuraCero en el mismo bbox) y
304 segmentos IDE que tocan el bbox (~138 registros viales OSM intersectados): tamaño apto para clasificar y correr
Hierholzer / cartero chino. Si el componente conexo mayor queda con menos de
~100 aristas, se amplía al recorte medio (ver `11_ejes-ide/README.md`).

## Mapa de carpetas

| Carpeta | Contenido |
|---|---|
| `01_red-vial-osm/` | ZIP de Geofabrik Uruguay (80 MB, **respaldo / contingencia con versión congelada**) — la fuente primaria es `11_ejes-ide/` |
| `02_contenedores-montevideo/` | `coordenadasContenedores.csv` (11.556 puntos lon,lat) + descripción (respaldo geográfico; primario: `09_levantes/`) |
| `07_reclamos-sur/` | `pormibarrio_reports.csv` (4.863 reportes reales) → `historico_quejas` real |
| ~~`03_reclamos-windsor-referencia/`~~ | Eliminada: era otra ciudad; sus agregados ya quedaron documentados |
| `11_ejes-ide/` | `ejes_montevideo.csv` (11.299.973 bytes, SHA-256 `b2fa87f24a029849bb00a186b6a61e9a4803221ea8bed9078cc14e52f79cb60b`) + metadatos + descripción |
| `04_esquema-y-regla-etiqueta/` | Esquema `nodos.csv`/`tramos.csv`, regla de etiqueta v1, ejemplos, plan del script + camino crítico sklearn del #10 |
| `09_levantes/` | `containers.json` (10.458 contenedores, foto operativa real) → `dias_*` real + validación del snap por `circuitCode` |
| `10_smartwaste-mvd/` | Espejo académico Mendeley (frecuencia y circuitos reales, referencia de costos) |

## Trazabilidad de lo descargado

| Archivo | Tamaño (bytes) | SHA-256 |
|---|---|---|
| `01_red-vial-osm/uruguay-latest-free.shp.zip` | 80527570 | `37fd738ab8780a0b67add69a2f839fd7d7efd8fc65d0581651d38e3283ea411b` |
| `02_contenedores-montevideo/coordenadasContenedores.csv` | 612468 | `9b893afb5b6515b55c11b6f0f8fb382f95917c09cd582e0904980a42c02fe7d9` |

Verificar con: `sha256sum dataset/*/*`. Servidor Geofabrik: Last-Modified
Thu, 05 Nov 2026 01:14:17 GMT. Figshare MD5 `20f6ae05b23b0dc4a3be43318e9a4c11`
(coincide con la ficha del dataset).

## Esquema final (resumen)

`nodos.csv`: `nodo_id`, `lon`, `lat`.
`tramos.csv`: `tramo_id`, `nodo_origen`, `nodo_destino`, `longitud_m`,
`nombre_calle`, `tipo_zona`, `cantidad_contenedores`,
`dias_desde_ultima_recoleccion`, `historico_quejas_vecinales`,
`prioridad_recoleccion`. Detalle campo por campo en
`04_esquema-y-regla-etiqueta/README.md`.

## Regla de etiqueta v1 (resumen)

```text
score = 2*dias + 3*quejas + 1*contenedores + zona_w  (comercial 2, industrial 1, residencial 0)
baja si score <= 10 | media si 11-16 | alta si score >= 17
```

Balance estimado ≈37/34/29. Es una etiqueta **construida para enseñar**; el
modelo aprenderá esta regla y la métrica no prueba utilidad operativa real.

## Plan del script (issue #9)

Script Python reproducible con semilla fija que:

1. Lee `11_ejes-ide/ejes_montevideo.csv` (45.400 ejes, UTM 21S) y lo recorta al bbox.
2. Construye el grafo (nodos = intersecciones, aristas = tramos) y se queda
   con el componente conexo mayor; calcula `longitud_m` geodésica.
3. Asigna cada contenedor al tramo más cercano (radio y desempates
   documentados; `circuitCode` de BasuraCero valida el snap) → `cantidad_contenedores`.
4. `tipo_zona` única simulada (≈60/25/15, RNG sembrado semilla 0); `dias` real agregado por tramo desde `daysWithoutLift` (auditar cola 0–486); `quejas` reales desde Por Mi Barrio (lista cerrada de categorías + deduplicación).
5. Aplica la regla v1, reporta balance por clase y escribe
   `nodos.csv` + `tramos.csv` con versiones y semilla registradas.

## Licencias

- OSM/Geofabrik (respaldo): ODbL, exige atribución a OpenStreetMap y contribuyentes y
  misma licencia al redistribuir la base derivada.
- IDE Uruguay: verificar ficha del catálogo antes de redistribuir derivados; uso académico con atribución.
- Figshare (Toyos; Vallcorba): CC BY 4.0, con origen en datos abiertos de la
  Intendencia de Montevideo (licencia DAG-UY).
- Datos operativos IM / BasuraCero: DAG-UY; crédito a IM + BasuraCero como espejo.
- SmartWaste Mendeley: verificar ficha antes de redistribuir derivados.
- Windsor (carpeta eliminada): solo agregados históricos ya registrados, sin filas; no es fuente vigente.

## Git

Los binarios grandes (`*.zip`, `*.shp`, etc.) están ignorados por
`dataset/.gitignore`: se descargan/reproducen, no se versionan. Los CSV
chicos y todos los README sí se versionan.

## Anexo: barrido final del catálogo (todo Montevideo, 05/11/2026)

Vía API del catálogo (`package_search?q=contenedores` → 7 datasets,
`q=residuos recoleccion` → 6). Todo lo útil es Intendencia de Montevideo
bajo Licencia DAG de Uruguay. Veredicto: **nos quedamos con 5 + ejes IDE** (OSM queda de respaldo).

### Nos quedamos ✅

| # | Dataset | Rol en el TP | Estado |
|---|---|---|---|
| 1 | Ubicación + circuitos + frecuencia (`Contenedores_domiciliarios.zip` + `Circuitos_recoleccion.zip`, UTM 21S, diario) | Base: coordenadas, circuito y frecuencia programada por contenedor | Por descargar (navegador) |
| 2 | Levantes 2024–2026 (cuatrimestres de ~130–150 MB + 24 h horario) | Estado operativo actual por contenedor (foto 6 AM diaria) | Por descargar (un cuatrimestre basta) |
| 3 | Estado de recolección 2017–2020 (7 archivos, 0,3–82 MB) | Serie histórica levantado/no por contenedor-viaje → `dias_*` real | Por descargar (metadata + un semestre) |
| 4 | Viajes y peso 2021–2022 (755/435 KB + `trayectos.csv` 129 KB) | Demanda real por circuito-día; `trayectos.csv` puede mapear circuito→tramos | Por descargar (liviano) |
| 5 | Reclamos SUR (2016–hoy, ZIP mensual) | `historico_quejas` real si filtra por residuos y geolocaliza | Por verificar columnas |
| 6 | Ejes IDE Montevideo (ya en `11_ejes-ide/`, 45.400 ejes, 304 en piloto) | Geometría oficial para el grafo | ✅ Descargado |
| 7 | OSM Geofabrik (en `01_red-vial-osm/`) | Respaldo de geometría | ✅ Descargado |

Plan de unión: 1 (id + circuito + coords) ⋈ 2/3 (id + fecha + levantado)
→ última recolección por contenedor → snap a tramo → features por tramo.
4 aporta demanda por circuito; 5, quejas reales por tramo si integra.

### Descartamos ❌

- Residuos secos en supermercados/complejos, especiales JC Decaux
  (pilas/latas/vidrio) y ¿Dónde Reciclo?: **otro circuito de recolección**,
  no el domiciliario puerta a puerta del TP.
- Figshare coordenadas: queda como respaldo (ya descargado) si el ZIP
  oficial falla; si no, se usa el oficial.
- Windsor: otra ciudad, carpeta eliminada; sus agregados históricos ya
  quedaron registrados en `docs/dataset-recoleccion.md` como
  agregado histórico (no fuente vigente), sin filas en el dataset.
- Residuos en playas (kg/mes): fuera del circuito domiciliario. ❌

### En evaluación (barrido por keywords 05/11/2026)

- **Áreas Liberadas** (IM, 2022–2024, SHP+CSV 3,2 MB): residuos recogidos en
  sitios de disposición informal, geolocalizado. Candidato como señal
  auxiliar por tramo (basurales). Falta descargar y ver columnas.
- **Solicitudes al COM / Montevideo más verde** (IM, 2023–2026, ~100–200 MB
  por año): solicitudes de limpieza al Centro Operativo. Candidata como
  fuente alternativa o complemento al SUR para quejas. Falta metadata y
  verificar solape con SUR.
