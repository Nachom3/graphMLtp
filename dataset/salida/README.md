# Salida del dataset (issue #9): nodos.csv + tramos.csv

Generados por `scripts/build_dataset.py` (reproducible, semilla fija). La foto
T0, semilla, versiones de archivos (sha256) y balance de clases están en
`metadata.json` (regenerado en cada corrida).

## Qué es

- `nodos.csv` — 209 nodos (intersecciones/extremos del grafo vial del piloto).
- `tramos.csv` — 297 tramos (aristas) con features reales-derivadas +
  `tipo_zona` simulada + `prioridad_recoleccion` construida con regla v1.

Esquema de `tramos.csv`: `tramo_id, nodo_origen, nodo_destino, longitud_m,
nombre_calle, tipo_zona, cantidad_contenedores, dias_desde_ultima_recoleccion,
prioridad_recoleccion`.

## Foto T0 y semilla

- **T0** = `2026-10-23` (dateData del snapshot de levantes, `09_levantes`).
- **Semilla** = `42` (controla solo `tipo_zona`, la única variable simulada).

## Pipeline (resumen)

1. **Grafo**: ejes IDE (`11_ejes-ide`, EWKB UTM 21S) → dedupe de reftramo
   (42.274 únicos; 3.126 filas eran duplicados exactos) → clip al bbox del
   piloto → nodos en intersecciones/extremos (split de cruces a media arista,
   snap 0,5 m) → componente conexo mayor (**297 aristas / 209 nodos**).
   `tramo_id` = `reftramo` (estable), `longitud_m` geodésica (Geod WGS84).
2. **cantidad_contenedores**: snap de **129 contenedores** (`09_levantes`,
   foto T0) al tramo más cercano. Radio **25 m**, desempate a igualdad por
   menor `tramo_id`. Validado con `circuitCode`: los 6 circuitos
   `CH_DU_RM_CL_*` coinciden con SmartWaste (131 cont., misma distribución).
3. **dias_desde_ultima_recoleccion**: real desde `daysWithoutLift`. Agregación
   por tramo = **máximo** (el contenedor más atrasado define la urgencia).
4. **tipo_zona**: simulada 60/25/15 con semilla 42 (única variable simulada
   por diseño).
5. **prioridad_recoleccion**: regla v1 recalibrada (abajo).

> Nota: `historico_quejas_vecinales` se **eliminó por decisión del equipo**
> (las quejas de Por Mi Barrio "no sirven"): la fuente termina en 2020 y no
> aportaba señal en la foto T0. Ver Log del feature doc.

## Regla de etiqueta (CSV actual = #18)

El builder escribe `prioridad_recoleccion` con la regla #18 (quejas sintéticas
en el score). Histórico: la recalibración #9 (sin quejas) quedó como paso
intermedio; ya no es el contenido del CSV.

```text
score = 2*dias + 1*contenedores + zona_w + 2*quejas
  (zona_w: comercial 2, industrial 1, residencial 0; quejas uniformes [0,3] por contenedor, seed 0)
baja ≤ 0 | media 1–2 | alta > 2
```

| Etapa | Balance baja / media / alta (piloto N=297) |
|---|---|
| Issue #8 (umbrales 10/16) | 99.7 / 0.3 / 0.0 |
| Regla #9 (sin quejas) | 43.4 / 42.1 / 14.5 |
| **CSV actual (#18)** | **43.4 / 31.3 / 25.3** (129 / 93 / 75) |

## Balance de clases (CSV actual)

- `tipo_zona`: residencial 62.3 % / comercial 24.6 % / industrial 13.1 %.
- `prioridad_recoleccion` (#18): baja 43.4 % / media 31.3 % / alta 25.3 %.

## No-asignados (cuarentena)

- Contenedores: **0** (todos < 11 m del eje más cercano).

## Trazabilidad (sha256 de fuentes)

| Archivo | bytes | sha256 |
|---|---|---|
| `11_ejes-ide/ejes_montevideo.csv` | 11.299.973 | `b2fa87f2…cb60b` |
| `09_levantes/containers.json` | 1.496.837 | `6da312ed…d8db8` |
| `10_smartwaste-mvd/…/containers_wgs84.csv` | 4.682.865 | `c4a46a9a…6ffb` |
| `10_smartwaste-mvd/…/circuits_enriched.json` | 68.486 | `b5073929…84f` |

Hashes completos en `metadata.json`.

## Reproducir

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/build_dataset.py
```

Regenera CSVs idénticos (semilla fija + orden determinista; los gates de
calidad fallan fuerte si algo no cierra).

## Limitaciones conocidas

- La prioridad es construida para enseñar; no es el criterio oficial del
  municipio.
- `dias_*` es real pero la foto es única (sin series temporales).
- Desfase temporal: red vial 2026, contenedores de instantáneas 2021–2026.

## Licencias / atribución

Ejes IDE Uruguay (catálogo nacional) + OSM Geofabrik (ODbL) de respaldo;
contenedores/levantes de la Intendencia de Montevideo (DAG-UY, espejo
BasuraCero); SmartWaste Mendeley DOI `10.17632/d2pw5j592y.1`. Atribución
completa en `dataset/README.md`.
