# 09 · Levantes (snapshot operativo real vía BasuraCero)

## Origen

- Repo: `matof12/basura-cero-mvd` (MIT implícito civic-tech; app en
  `https://basuracero.vercel.app`, stack React + react-leaflet + **Leaflet**).
- Su `scripts/sync.js` (GitHub Actions cada hora) descarga el CSV oficial
  `https://ckan-data.montevideo.gub.uy/vistas/levantes-contenedores?format=csv`
  y publica `apps/web/public/data/containers.json`.
- Archivo local: `containers.json` (1.496.837 bytes, descargado de GitHub
  el 05/11/2026 porque el servidor de la IM no responde a nadie ahora mismo).
- Licencia de los datos: DAG-UY (Intendencia de Montevideo). Crédito:
  IM + BasuraCero como espejo.

## Columnas (reveladas por `sync.js`, verificadas en el JSON)

| Campo | Significado |
|---|---|
| `dateData` | Foto, p. ej. `2026-10-23 15:00` |
| `circuitCode` | Código de recorrido, p. ej. `A_DU_RM_CL_105` (**todos** lo traen) |
| `position` | Posición en el recorrido |
| `daysWithoutLift` | **Días sin levantar: nuestro `dias_desde_ultima_recoleccion` real** |
| `long`, `lat` | Ya en grados decimales WGS84 (rango lon −56.29…−56.04, lat −34.93…−34.78) |

## Contenido verificado

10.458 contenedores, 100 % con circuito; `daysWithoutLift` 0–486
(verificar cola alta en el #9: puede haber contenedores fuera de servicio).
129 caen en el bbox piloto.

## Uso en el TP

- `dias_desde_ultima_recoleccion` pasa de **simulada a real** (foto T0 =
  `dateData` del snapshot que use el #9, que deberá re-descargar una foto
  fresca y registrarla).
- `circuitCode` permite validar el snap contenedor→tramo contra circuitos.
- Figshare (`02_`) queda como respaldo geográfico; la geometría oficial de
  circuitos sigue pendiente de los ZIP de la IM.
