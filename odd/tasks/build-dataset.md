# Build del dataset final (issue #9)

Construir `nodos.csv` + `tramos.csv` reproducibles con `scripts/build_dataset.py`
(semilla fija), clip del grafo al piloto, features reales-derivadas + `tipo_zona`
simulada, regla v1 de etiqueta, gates de calidad y README de procedencia. Cada
tarea = un commit.

## Specs

S1 — Script reproducible: "Script reproducible con semilla fija (p. ej. scripts/build_dataset.py) que genere nodos.csv y tramos.csv desde cero."
S2 — Grafo: "clip al bbox del piloto, nodos en intersecciones/extremos, componente conexo mayor, longitud_m geodésica, tramo_id desde reftramo, nombre_calle."
S3 — Contenedores: "cantidad_contenedores: snap de contenedores al tramo más cercano (radio y desempates documentados); validar con circuitCode."
S4 — Días: "dias_desde_ultima_recoleccion: real desde daysWithoutLift (definir agregación por tramo: máx/media, y documentarla)."
S5 — Quejas: "historico_quejas_vecinales: categorías de residuos de Por Mi Barrio en ventana [T0−30d, T0); deduplicar antes de asignar; no-asignados en cuarentena (se reportan, no se inventan)."
S6 — Zona: "tipo_zona: simulada 60/25/15 con semilla registrada."
S7 — Prioridad: "prioridad_recoleccion: aplicar regla v1; si el balance real difiere mucho del 37/34/29 estimado, recalibrar umbrales y registrar valores + balance final."
S8 — Gates: "Gates de calidad que fallen fuerte: validación de esquema, auditoría de categorías con revisión de ejemplos, cobertura de coordenadas, reporte de no-asignados."
S9 — Registro: "Registrar foto T0, semilla, versiones de archivos y balance de clases."

Decisión (L2): `historico_quejas_vecinales` usa el histórico real completo de Por
Mi Barrio (2014–2020). La ventana [T0−30d, T0) es vacía porque la fuente termina
en 2020-04; brecha temporal documentada como limitación. No se simulan quejas.

Fuera de scope: entrenar/comparar modelos (#10), backend/API/frontend, nuevas
fuentes, reescribir datos reales (solo `tipo_zona` es simulada por diseño).

## Tasks

T1 (S1) — chore: entorno reproducible (`requirements.txt` + `.gitignore`). commit 1.
T2 (S2) — grafo: EWKB → clip bbox → nodos intersecciones/extremos → CC mayor → `longitud_m` → `tramo_id`=reftramo → `nombre_calle`. commit 2.
T3 (S3) — `cantidad_contenedores`: snap + radio/desempate + validación `circuitCode`. commit 3.
T4 (S4) — `dias_desde_ultima_recoleccion`: real desde `daysWithoutLift`, agregación documentada. commit 4.
T5 (S5) — `historico_quejas_vecinales`: real 2014–2020 + dedup + cuarentena de no-asignados. commit 5.
T6 (S6) — `tipo_zona`: 60/25/15 con semilla. commit 6.
T7 (S7) — `prioridad_recoleccion`: regla v1 + recalibración + balance. commit 7.
T8 (S8) — gates de calidad (esquema, categorías, cobertura, no-asignados). commit 8.
T9 (S9) — registro T0/semilla/versiones/balance + README de procedencia + `ai.md`. commit 9.

## Log

L1 — Request original (issue #9, verbatim):
"Para @renzo23rc: construir el dataset final (nodos.csv + tramos.csv) con un script reproducible, a partir de lo definido en el issue #8. Toda la investigación previa está en la PR vinculada: docs/dataset-recoleccion.md, dataset/README.md (trazabilidad con hashes), PLAN.md y READMEs por fuente en dataset/.
Punto de partida (ya verificado): Grafo: dataset/11_ejes-ide/ejes_montevideo.csv (45.400 ejes oficiales, UTM 21S, reftramo estable; 304 tocan el piloto). Contenedores + días reales: dataset/09_levantes/containers.json (10.458 contenedores, daysWithoutLift, circuitCode, foto 2026-10-23). Frecuencia y circuitos reales: dataset/10_smartwaste-mvd/. Quejas reales: dataset/07_reclamos-sur/pormibarrio_reports.csv (4.863 reportes con lat/lon; ~1.700 de residuos). Regla de etiqueta v1: dataset/04_esquema-y-regla-etiqueta/README.md.
Tareas: 1) Script reproducible con semilla fija. 2) Grafo: clip al bbox, nodos en intersecciones/extremos, componente conexo mayor, longitud_m geodésica, tramo_id desde reftramo, nombre_calle. 3) cantidad_contenedores: snap con radio y desempates documentados; validar con circuitCode. 4) dias_desde_ultima_recoleccion: real desde daysWithoutLift (agregación documentada). 5) historico_quejas_vecinales: categorías de residuos en ventana [T0−30d, T0); deduplicar; no-asignados en cuarentena. 6) tipo_zona: simulada 60/25/15 con semilla registrada. 7) prioridad_recoleccion: regla v1; recalibrar umbrales si el balance difiere. 8) Gates de calidad que fallen fuerte. 9) Registrar foto T0, semilla, versiones y balance.
Fuera de scope: entrenar modelos (#10), backend/API/frontend, nuevas fuentes, reescribir datos reales. Mínimo: script que corre de cero con una semilla y regenera CSVs idénticos; procedencia documentada; valores y distribución verificados; conteos trazables. Archivos: scripts/build_dataset.py (nuevo), dataset/salida/nodos.csv y tramos.csv, README de procedencia."

L2 — 2026-11-06: decisión `historico_quejas_vecinales` = histórico real completo (2014–2020), no simulado; brecha temporal documentada. (Elegido por @renzo23rc.)

L3 — 2026-11-06: "@renzo23rc: avancemos" (autorización para implementar commit a commit).

L4 — 2026-11-06: T2 grafo (commit `8230474`). 297 tramos / 209 nodos, componente conexo unico. Dedupe 3.126 reftramos. 2 T-junctions nodificadas (split+snap 0.5 m).

L5 — 2026-11-06: T3 contenedores (commit `e722131`). Snap 129 contenedores (09_levantes), radio 25 m, desempate menor tramo_id. 129/129 asignados, 0 no-asignados, dist 1.7–11.0 m, 87 tramos con contenedores (dist 0→210, 1→51, 2→30, 3→6). Cross-check SmartWaste: 131 cont / mismos 6 circuitos CH_*.

L6 — 2026-11-06: T4 dias (commit `3205dbf`). Real desde daysWithoutLift, agregación máximo por tramo (el contenedor más atrasado define la urgencia). 275 tramos con 0 días, 22 con 1.

L7 — 2026-11-06: T5 quejas (commit `78eaa19`). Histórico real completo 2014–2020, taxonomía 36 categorías, 1.840 reportes; dedup 19 filas, 19 coords inválidas, 1 fuera de radio → cuarentena. 29 quejas en 22 tramos.

L8 — 2026-11-06: T6 tipo_zona (commit `6b6a1ef`). Simulada 60/25/15 con seed 42. Realizado 62.3/24.6/13.1 (n=297).

L9 — 2026-11-06: T7 prioridad (commit `057de96`). Regla v1 recalibrada: baja≤0, media 1–2, alta≥3 (original ≤10/11-16/≥17 daba 99.7% baja; score real max 14). Balance final 41.8/37.4/20.9.

L10 — 2026-11-06: T8 gates (commit `7069b15`). Esquema, auditoría de categorías (con ejemplos), cobertura bbox, reporte de no-asignados; fallan fuerte.

L11 — 2026-11-06: T9 README + registro (commit `7d8546e`). `dataset/salida/metadata.json` (T0, semilla, sha256, balance), `dataset/salida/README.md` de procedencia, `ai.md`.

L12 — 2026-11-06: decisión @renzo23rc: "vamos a hacer una cosa, borra todas las quejas, no sirven". Se elimina `historico_quejas_vecinales` del esquema y del script. La regla v1 pasa a `score = 2*dias + 1*contenedores + zona_w` (sin 3*quejas), umbrales baja≤0/media 1-2/alta≥3, balance final 43.4/42.1/14.5. La decisión L2 (quejas histórico real) queda revertida.
