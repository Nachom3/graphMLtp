# IA en el proyecto

Utilicé la IA como asistente senior: cada duda la nutrí con información (documentación) y la bombardeé a preguntas, para luego ir a verificar lo que me dijo. A lo largo del proyecto la IA se equivocó muchas veces. Algunos ejemplos:

- Generó una regla ambigua (había muchísimos contenedores en baja).
- Generó código ofuscado, difícil de interpretar.
- No advirtió que, con `SCORE_LOW_MAX = 0`, todo tramo con al menos un contenedor queda en media o alta (`cont >= 1 -> media/alta`); solo un tramo 0/0/0 residencial puede ser baja.

## La IA nos ayudó a hacer

- La IA nos ayudó a escribir el `lineamientos.md` (tecnologías, arquitectura, etc.).
- La IA nos ayudó a configurar el GitHub Projects (columnas Todo, In Progress, In Review, Done, auto-add de Issues).
- La IA nos ayudó a crear el workflow que mueve el Issue a Done cuando se borra el branch.
- La IA nos ayudó a probar el flujo con los Issues #3 y #6 y los PRs #4, #5 y #7.
- La IA nos ayudó a sacar a Qodo como reviewer y dejar a Copilot.
- La IA nos ayudó a construir el dataset reproducible del issue #9: `scripts/build_dataset.py` (grafo, snap de contenedores, features reales y simuladas, regla v1 recalibrada, gates de calidad) y el README de procedencia.
- La IA nos ayudó a construir todos los tests que necesitábamos para el proyecto.
- La IA nos ayudó a detectar fallas en la clasificación del árbol. Haber elegido un árbol nos permitió ver, con el prompt `Revisa las respuestas generadas por el arbol y busca inconsistencias`, dos caras del mismo defecto de etiqueta #18 (`score = 2*dias + contenedores + zona_w + 2*quejas`, `zona_w = {residencial: 0, industrial: 1, comercial: 2}`, `baja <= 0, media <= 2`):
  1. Tramos sin contenedores en `media`: con 0/0/0 las quejas son 0 por construcción, pero `zona_w` sola ya da score 1-2, así que industrial/comercial 0/0 quedan en `media` (ej. `743988` RAMON MASINI, industrial, 0 cont., 0 días). Operativamente incorrecto: sin contenedor no hay recolección.
  2. `baja` nunca ruteable (`SCORE_LOW_MAX = 0`): como todos los términos son >= 0, `baja` exige 0/0/0 residencial. En el piloto las 129 `baja` tienen 0 contenedores, por lo que `include = (baja)` da selección vacía (`ImpossibleRoute`) en `PlanRoute`/`NetworkxRoutePlanner` (`container_count > 0` obligatorio). No es bug del planificador, es consecuencia del umbral.
  La regla no se corrigió (exigiría regenerar CSVs y re-correr `prepare+compare`); se contuvo en grafos y se documentó en el informe.

## Lo hicimos sin IA

- Definir modelos en base a las comparaciones.
- Definir la arquitectura del proyecto y tecnologías.
- Entender las librerías y técnicas de ML a utilizar.
- Buscar el dataset.

