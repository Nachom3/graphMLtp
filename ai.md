# IA en el proyecto

Utilize IA como un asistente senior, en donde cada duda o consulta que tenia la nutria de informacion(documentacion) y la bombardeaba a preguntas. Para luego ir a verificar lo que me dijo. A lo largo del proyecto la IA se equivoco muchas veces. Algunos ejemplos:

- Genero una regla ambigua(habia muchisimos contendores en bajo)
- Genera codigo ofuscado, dificil de interpretar
- No se dio cuenta que el modelo agrupaba todos los contendores en media y alta, si que estos tenian como minimo un contendor. num_Cont > 1 -> media o alta

## La IA nos ayudó a hacer

- La IA nos ayudó a escribir el `lineamentos.md` (tecnologías, arquitectura, etc.).
- La IA nos ayudó a configurar el GitHub Projects (columnas Todo, In Progress, In Review, Done, auto-add de Issues).
- La IA nos ayudó a crear el workflow que mueve el Issue a Done cuando se borra el branch.
- La IA nos ayudó a probar el flujo con los Issues #3 y #6 y los PRs #4, #5 y #7.
- La IA nos ayudó a sacar a Qodo como reviewer y dejar a Copilot.
- La IA nos ayudó a construir el dataset reproducible del issue #9: `scripts/build_dataset.py` (grafo, snap de contenedores, features reales y simuladas, regla v1 recalibrada, gates de calidad) y el README de procedencia.
- La IA nos ayudo en construir todos los tests que necesitabamos para construir el proyecto.
- La IA nos ayudó a detectar fallas en la clasificacion del arbol. El haber elegido un arbol nos permitio ver que por ejemplo, el modelo miraba tramos sin contendores y les otorgaba "medio" como prioridad, algo que claramente esta mal. 

## Lo hicimos sin IA

- Definir modelos en base a las comparaciones
- Definir la arquitectura del proyecto y tecnologias
- Entender las liberias y tecnicas de ML a utilizar
- Buscar el dataset

