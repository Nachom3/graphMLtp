# Preparación de datos ML — issue #18
Objetivo: actualizar #18 y #10 y completar la preparación reproducible para #10.
Rama: `18-preparar-datos-ml` | Entrega: `feature-branch-chain` | Pruebas: `pytest --config-file=backend/pytest.ini backend/tests/ --quiet -p no:cacheprovider`

## Specs

- **S1:** «Exclenete, actualiza los issues con toda la informacion detallada. Ahora nosotros tenemos que terminar el issue 18. Para dar paso al 10»
- **S2:** «Si, osea, el historico quejas vecinales es un campo necesario a agregar. Porque lo pide el enunciado, y es de tipo number. Osea es un numero de quejas asociadas a cada contendor. AHORA. LO vamos a generar nosotros a ese number, ok?»
- **S3:** «Si, obvio que tiene que influir.. Ademas el script es un generador de numeros, nada mas... UN script boludo. MOdiifca el plan y pasame el final resumido»
- **S4:** «60/20/20 + CV estratificada solo en el 60% + GridSearchCV con grilla chica + contraste en validación + test una sola vez. Son complementarios, no alternativas.» «F1 macro además de accuracy: correcto con 43.4/42.1/14.5.» La distribución citada corresponde al dataset anterior a la nueva regla.
- **S5:** «Pipeline: ColumnTransformer(tipo_zona->OneHot(handle_unknown="ignore"), numéricas passthrough) sin ajustar en #18, pipeline completo sin ajustar a cross_validate/GridSearchCV en #10. Así cada fold ajusta solo con su train.»
- **S6:** «Ojo con n=297: alta ~43 casos, en train 60% ~26, en 5 folds ~5 por fold. Mantén el fallback a cv_folds_usados que ya documentaste.» Esos conteos corresponden a la etiqueta anterior y deben recalcularse al incluir quejas.
- **S7:** Issue #18: «Leer el CSV existente con pandas, validar columnas obligatorias, identificadores únicos, categorías y ausencia de valores faltantes en las columnas usadas; si los datos no cumplen, informar el problema sin inventar valores ni modificar el archivo fuente.» «Separar explícitamente las variables `X` y la etiqueta `y`, manteniendo cada fila y su `tramo_id` alineados para auditoría.» «No reescribir ni regenerar el CSV fuente como efecto de la preparación.»
- **S8:** Issue #18: «Comprobar que las tres particiones sean disjuntas y que juntas cubran todos los tramos originales. Registrar la semilla, los tamaños, la distribución por clase y los IDs o índices necesarios para reproducir el reparto.» «Agregar pruebas rápidas y deterministas de la preparación, documentar cómo ejecutarla y declarar las dependencias necesarias en el entorno del proyecto.»
- **S9:** Issue #18: «Una interfaz reutilizable o script documentado recibe el dataset existente y deja `X`, `y`, las tres particiones y la preparación categórica disponibles para #10, sin entrenar clasificadores.» «Las pruebas cubren entrada inválida o incompleta y confirman que el CSV original permanece sin cambios.»
- **S10:** «Move el .worktrees afuera en documentos/ y crea un folder worktrees/ o algo asi..»
- **S11:** «Also, rebase the branch»
- **S12:** «Me teacher uses make_pipeline, not pipeline»

## Tasks

- T1 [S1–S9] ruta: inline; estado: completado; commit: n/a — Actualizar los issues #18 y #10 conservando su alcance y separando preparación de entrenamiento.
- T4 [S10] ruta: inline; estado: completado; commit: n/a — Trasladar el worktree con Git preservando rama y cambios.
- T2 [S2–S9, S12] ruta: delegado (context backstop) + ajuste inline; estado: completado; commit: `4d083e8`, `e2960dd` — Implementar generación simple, preparación y pruebas con documentación de uso.
- T5 [S11] ruta: inline; estado: completado; commit: n/a — Rebasar la rama sobre `main`, preservando los cambios.
- T3 [S2–S9, S11–S12] ruta: verificación según riesgo; estado: completado; commit: `e2960dd` y cierre de seguimiento — Verificar el comportamiento público, el CSV original y la suite; cerrar el trabajo.

## Log

- L1: «Exclenete, actualiza los issues con toda la informacion detallada. Ahora nosotros tenemos que terminar el issue 18. Para dar paso al 10»
- L2: «Si, osea, el historico quejas vecinales es un campo necesario a agregar. Porque lo pide el enunciado, y es de tipo number. Osea es un numero de quejas asociadas a cada contendor. AHORA. LO vamos a generar nosotros a ese number, ok?»
- L3: «Si, obvio que tiene que influir.. Ademas el script es un generador de numeros, nada mas... UN script boludo. MOdiifca el plan y pasame el final resumido»
- L4: «Move el .worktrees afuera en documentos/ y crea un folder worktrees/ o algo asi..»
- L5: Las ediciones de #18 y #10 terminaron con código 0. El trabajo y sus cambios siguen en el worktree original.
- L6: La herramienta de archivos rechazó `/home/nacho/Documentos/worktrees` por estar fuera del proyecto y señaló `~/.config/lean-ctx/config.toml`.
- L7: El usuario autorizó «Sí, habilitá esa ruta» para agregar únicamente `/home/nacho/Documentos/worktrees` a la configuración y continuar con el traslado.
- L8: La ruta fue agregada conservando la configuración previa. `lean-ctx doctor` indica que `/home/nacho/Documentos/worktrees` no coincide por ruta inexistente; la herramienta sigue rechazando el destino. La comprobación con `python3 -c` fue bloqueada permanentemente por la política de intérpretes y no se reintentó.
- L9: «go on»
- L10: «go on»
- L11: El usuario eligió «Temporarily allow the parent»: habilitar temporalmente `/home/nacho/Documentos` solo para crear el directorio destino y retirar después ese permiso más amplio.
- L12: Traslado realizado con `git worktree move` a `/home/nacho/Documentos/worktrees/18-preparar-datos-ml`. Se conservaron la rama `18-preparar-datos-ml`, el HEAD `d7a6614`, el estado, el hash del diff (`cff85e2a4a681b5bda513151c7eabb0bd6fbc977fac9710f3b6ac43af3da9fa0`) y el hash del documento de tareas. El permiso amplio de `/home/nacho/Documentos` fue retirado.
- L13: El checkout principal `main` registraba el camino anterior como gitlink en el commit local `d495704`. Tras el traslado apareció una eliminación sin stage de ese gitlink; no se realizó stage ni commit por esta sesión. Posteriormente `main` y `origin/main` coinciden en `d60ea85` y la eliminación ya no aparece.
- L14: «Also, rebase the branch»
- L15: «Me teacher uses make_pipeline, not pipeline»
- L16: El worker informó RED observado, 9 pruebas focalizadas y 10 de backend aprobadas, y CSV sin cambios. `assess` nativo informó `unassessable` por archivos no rastreados sin declarar; su plan no agregó verificador independiente sin un ítem de alto riesgo.
- L17: Se eliminó el ensamblador `Pipeline(...)` y el wrapper redundante; los ejemplos y tests usan `sklearn.pipeline.make_pipeline`. La prueba focalizada pasó con 9 tests usando el ejecutable `pytest`. No había un RED útil para el cambio de estilo; sí se preservó el RED original del worker. La herramienta bloqueó dos invocaciones `python3 -m pytest` por confundir opciones de pytest con flags del intérprete; se usó el ejecutable de pytest sin ejecutar código inline.
- L18: Los issues #18 y #10 se actualizaron para mencionar `make_pipeline`; ambos pedidos terminaron con código 0.
- L19: `git rebase --autostash main` terminó correctamente en `d60ea85`. Se comprobaron el mismo diff rastreado, estado y hashes de los cuatro archivos no rastreados antes y después; el autostash fue aplicado.
- L20: Después del rebase, la suite de backend pasó con 10 pruebas; `git diff --check` pasó y el hash del CSV coincide con `main`. Al revisar la validación, se observó que acepta cadenas numéricas, pero podría entregarlas como predictoras no numéricas; se reabre T2 para comprobar y corregir ese caso.
- L21: RED observado por `ValueError` al procesar `"0.0"`; tras normalizar las columnas validadas sobre una copia, la prueba focalizada pasó y la suite completa pasó con 11 pruebas. `git diff --check` y la comprobación del CSV original también pasaron.
- L22: El diff completo suma 877 líneas agregadas o eliminadas, incluidas pruebas, documentación y seguimiento. La estrategia `ask-on-risk` requirió elegir la forma de entrega antes del primer commit; no se hizo commit ni push.
- L23: El usuario eligió «Feature-branch chain (recommended)» (`chain_strategy=feature-branch-chain`); la elección no autoriza push ni creación de PR.
- L24: Cortes previstos: (1) generador sintético y sus pruebas autónomas; (2) preparación integrada, pruebas restantes y documentación de uso. El segundo corte puede superar 400 líneas porque su código, pruebas y documentación forman una unidad; no se dividirán artificialmente.
- L25: Las dos pruebas del generador se separaron en `backend/tests/test_synthetic_complaints.py`: ambas pasaron; la suite completa pasó con 11 pruebas y el CSV sigue sin cambios.
- L26: Primer corte `4d083e8`: 136 líneas agregadas; la suite en una copia aislada del índice pasó con 3 pruebas. `assess` para ese commit informó riesgo medio y `reviewDue=false` tras declarar en el índice los archivos nuevos del siguiente corte; no hubo push ni PR.
- L27: El issue #10 y la documentación ahora exigen `GridSearchCV` con grilla pequeña, en línea con S4. No se inició el entrenamiento de #10.
- L28: Segundo corte `e2960dd`: 756 líneas cambiadas. La suite de su índice aislado pasó con 11 pruebas; `git diff --check` pasó y el objeto del CSV coincide con `main`. `assess` informó riesgo medio y `reviewDue=false`; no se inició revisión nativa.
- L29: El segundo corte requiere una excepción de tamaño para su futura revisión si se conserva cohesivo; no se hizo push ni se creó PR. Los issues siguen abiertos.
