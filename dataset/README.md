# Dataset del TP: recolección de residuos (issue #8)

Definición completa en `docs/dataset-recoleccion.md`. Esta carpeta contiene las
fuentes descargadas, su documentación y el plan de construcción. Generar los
CSV finales (`nodos.csv`, `tramos.csv`) corresponde al issue #9.

## Decisión

Dataset **mixto** en una zona piloto de Montevideo:

- Real-derivado: geometría vial (ejes IDE Uruguay) + contenedores por tramo (Figshare/IM).
- Simulado reproducible: `tipo_zona` (con semilla, issue #9).
- Etiqueta construida: `prioridad_recoleccion` con regla pública v1 (no oficial).

> `historico_quejas_vecinales` se eliminó del esquema (decisión de equipo): la
> fuente Por Mi Barrio termina en 2020 y no aporta señal en la foto T0.

Zona piloto v1 (WGS84): oeste `-56.16`, sur `-34.915`, este `-56.15`,
norte `-34.905`. Recorte chico (~1 km × ~1.1 km) con 196 contenedores y
~138 registros viales intersectados: tamaño apto para clasificar y correr
Hierholzer / cartero chino. Si el componente conexo mayor queda con menos de
~100 aristas, se amplía al recorte medio (ver `11_ejes-ide/README.md`).

## Mapa de carpetas

| Carpeta | Contenido |
|---|---|
| `01_red-vial-osm/` | ZIP de Geofabrik Uruguay (80 MB, respaldo) — la fuente primaria es `11_ejes-ide/` |
| `02_contenedores-montevideo/` | `coordenadasContenedores.csv` (11.556 puntos lon,lat) + descripción |
| ~~`03_reclamos-windsor-referencia/`~~ | Eliminada: era otra ciudad; sus agregados ya quedaron documentados |
| `11_ejes-ide/` | `ejes_montevideo.csv` (11.299.973 bytes, SHA-256 `b2fa87f24a029849bb00a186b6a61e9a4803221ea8bed9078cc14e52f79cb60b`) + metadatos + descripción |
| `04_esquema-y-regla-etiqueta/` | Esquema `nodos.csv`/`tramos.csv`, regla de etiqueta v1, ejemplos, plan del script |

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
`dias_desde_ultima_recoleccion`, `prioridad_recoleccion`. Detalle campo por
campo en `04_esquema-y-regla-etiqueta/README.md`.

## Regla de etiqueta v1 (resumen)

```text
score = 2*dias + 1*contenedores + zona_w  (comercial 2, industrial 1, residencial 0)
baja si score <= 0 | media si 1-2 | alta si score >= 3
```

Balance real ≈43/42/15 (recalibrado en #9 sin quejas). Es una etiqueta
**construida para enseñar**; el modelo aprenderá esta regla y la métrica no
prueba utilidad operativa real.

## Plan del script (issue #9)

Script Python reproducible con semilla fija que:

1. Lee `11_ejes-ide/ejes_montevideo.csv` (45.400 ejes, UTM 21S) y lo recorta al bbox.
2. Construye el grafo (nodos = intersecciones, aristas = tramos) y se queda
   con el componente conexo mayor; calcula `longitud_m` geodésica.
3. Asigna cada contenedor al tramo más cercano (radio y desempates
   documentados) → `cantidad_contenedores`.
4. Genera `tipo_zona` (≈60/25/15) con RNG sembrado y calcula `dias` real
   desde levantes.
5. Aplica la regla v1, reporta balance por clase y escribe
   `nodos.csv` + `tramos.csv` con versiones y semilla registradas.

## Licencias

- OSM/Geofabrik: ODbL, exige atribución a OpenStreetMap y contribuyentes y
  misma licencia al redistribuir la base derivada.
- Figshare (Toyos; Vallcorba): CC BY 4.0, con origen en datos abiertos de la
  Intendencia de Montevideo.
- Windsor (carpeta eliminada): solo se reutilizaron sus estadísticos
  agregados históricos; sin filas en el dataset.

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
  calibración de la simulación, sin filas en el dataset.
- Residuos en playas (kg/mes): fuera del circuito domiciliario. ❌

### En evaluación (barrido por keywords 05/11/2026)

- **Áreas Liberadas** (IM, 2022–2024, SHP+CSV 3,2 MB): residuos recogidos en
  sitios de disposición informal, geolocalizado. Candidato como señal
  auxiliar por tramo (basurales). Falta descargar y ver columnas.
- **Solicitudes al COM / Montevideo más verde** (IM, 2023–2026, ~100–200 MB
  por año): solicitudes de limpieza al Centro Operativo. Candidata como
  fuente alternativa o complemento al SUR para quejas. Falta metadata y
  verificar solape con SUR.
