# Entrenamiento y comparación de clasificadores (issue #10)

Compara los 4 modelos del curso —`DecisionTreeClassifier` (sesión 4,
`notebook-1-arboles-decision`), `LogisticRegression` multiclase (sesión 3,
`notebook-2-logistica`; sesión 5, `notebook-1-metricas` celda 9 y
`notebook-2-validacion-cruzada` celda 28), `KNeighborsClassifier` y `SVC`
RBF (sesión 4)— sobre la preparación reutilizable de #18, sin duplicarla ni
reescribir el CSV.

Ejecución reproducible (desde la raíz):

```bash
python scripts/train_compare.py
```

El notebook `notebooks/10_entrenamiento_modelos.ipynb` llama al mismo
código del backend; no es una segunda implementación.

En el afán de conseguir el mejor modelo se testearon **todos los del
curso** (árbol, logística, knn y svc) con la misma metodología y los
mismos datos; el elegido fue el **árbol, por su representabilidad**:
es el único que deja ver y explicar qué está decidiendo en cada caso,
que es lo que el curso pide para esta etapa.

## Cómo se evaluó (introducción didáctica)

La idea es comparar modelos sin hacer trampa, en 4 pasos que van de lo
general a lo particular:

1. **Separar antes de mirar.** El dataset se parte en tres con semilla
   fija: 60% para entrenar, 20% para validar y 20% para test. El test
   queda guardado bajo llave hasta el final: se usa una sola vez, solo
   con el modelo ya elegido. Si eligiéramos mirando el test, las
   métricas mentirían.
2. **Practicar dentro del entrenamiento.** Con el 60% de train se hace
   validación cruzada estratificada de 5 folds: se entrena en 4/5 y se
   prueba en 1/5, rotando. Así cada modelo muestra su rendimiento
   promedio y su estabilidad, sin tocar validación ni test.
3. **Probar pocos ajustes, siempre adentro.** Cada modelo prueba una
   grilla pequeña de hiperparámetros (`GridSearchCV`) dentro del train.
   Todo lo que aprende de los datos (escalado, codificación) viaja
   dentro del pipeline de cada fold, para que ningún fold espíe datos
   que no le corresponden (sin fuga).
4. **Elegir en validación y confirmar en test.** Los ganadores de cada
   grilla se contrastan en el 20% de validación reservada; se elige por
   F1 macro. Recién ahí, el elegido se evalúa una sola vez en test.
   Además se reporta un baseline tonto (predecir siempre la mayoría)
   para saber el piso: cualquier modelo útil tiene que superarlo.

Para saber *dónde* se equivoca cada modelo se usa la matriz de
confusión (filas = prioridad real, columnas = predicha) desglosada por
clase en VP (aciertos), FP (falsas alarmas), FN (casos perdidos) y VN
(descartes correctos), más precisión/recall por clase.

## Metodología (la del ticket + curso, misma para todos)

- Particiones de #18 con semilla `0`: 178 train (60%) / 59 validación
  (20%) / 60 test (20%), estratificadas. Distribución real con seed 0:
  train 77 baja / 56 media / 45 alta; validación 26/18/15; test 26/19/15;
  total 129/93/75.
- Validación cruzada estratificada **solo dentro del train**
  (`StratifiedKFold`, shuffle, semilla 0). Pedidos 5, usados 5 (la clase
  menos frecuente del train tiene 45 ejemplos). Si tuviera menos, se
  reduce a ese conteo y se registra `cv_folds_pedidos` / `cv_folds_usados`;
  con menos de 2 folds se informa como inviable (`ValueError`).
- `GridSearchCV` con grilla pequeña, siempre dentro de train (scoring
  F1 macro, refit). Grillas: árbol `max_depth [None, 3, 5]` ×
  `min_samples_split [2, 5]`; logística `C [0.5, 1.0, 2.0]`;
  knn `n_neighbors [3, 5, 7]`; svc RBF `C [0.5, 1.0]`.
- Pipelines completos **sin ajustar** vía `make_pipeline` antes de
  `cross_validate` / `GridSearchCV`: el árbol usa el `ColumnTransformer`
  de #18 tal cual; la logística usa su gemelo con `StandardScaler` solo
  en numéricas (curso sesión 4, celdas 37-38: árbol sin escala, resto con
  escala; sesión 5, celdas 26-27: todo lo que aprende va adentro).
  `OneHotEncoder(handle_unknown="ignore")` mapea zonas no vistas a ceros.
- Contraste en validación reservada, elección por F1 macro (desempate:
  accuracy, luego orden de configs). Test reservado y usado **una sola
  vez** al final, solo para el elegido.
- Métricas: accuracy y F1 macro como mínimo, más precisión/recall macro,
  matriz de confusión (orden baja/media/alta) y baseline tonto
  (predecir siempre la mayoría).

## Resultados (semilla 0, CSV real de 297 tramos)

| Modelo | CV acc | CV F1 | Val acc | Val F1 | Mejor grilla |
|---|---|---|---|---|---|
| arbol | 0.9944 ± 0.0111 | 0.9932 ± 0.0136 | 1.0000 | 1.0000 | max_depth=None, min_samples_split=2 |
| logistica | 0.9660 ± 0.0331 | 0.9619 ± 0.0367 | 0.9322 | 0.9268 | C=0.5 |
| knn | 0.9775 ± 0.0276 | 0.9743 ± 0.0315 | 0.9661 | 0.9680 | n_neighbors=7 |
| svc (RBF) | 0.9776 ± 0.0324 | 0.9733 ± 0.0390 | 1.0000 | 1.0000 | C=1.0 |
| baseline (mayoría) | — | — | 0.4407 | 0.2039 | — |

Validación (orden baja/media/alta, n=59):

- árbol: `[[26, 0, 0], [0, 18, 0], [0, 0, 15]]`, precisión/recall 1.0.
- logística: `[[26, 0, 0], [2, 16, 0], [0, 2, 13]]`, precisión 0.9392,
  recall 0.9185.
- knn: `[[26, 0, 0], [2, 16, 0], [0, 0, 15]]`, precisión 0.9762,
  recall 0.9630.
- svc: `[[26, 0, 0], [0, 18, 0], [0, 0, 15]]`, precisión/recall 1.0.

VP/VN/FP/FN por clase en validación (uno-vs-resto, filas=true, cols=pred):

- árbol: baja VP 26 FP 0 FN 0 VN 33; media VP 18 FP 0 FN 0 VN 41;
  alta VP 15 FP 0 FN 0 VN 44. No se equivoca en nada.
- svc: idéntico al árbol (todo ceros fuera de la diagonal).
  Empate perfecto en validación.
- knn: baja VP 26 FP 2 FN 0 VN 31; media VP 16 FP 0 FN 2 VN 41;
  alta VP 15 FP 0 FN 0 VN 44. El error son 2 medias reales
  predichas baja (FN de media = FP de baja).
- logística: baja VP 26 FP 2 FN 0 VN 31; media VP 16 FP 2 FN 2 VN 39;
  alta VP 13 FP 0 FN 2 VN 44. Confunde medias↔altas vecinas:
  2 medias → baja, 2 altas → media.

Elegido por validación: **arbol**. Test un solo uso (arbol):
acc 1.0000, precisión/recall/F1 1.0000,
matriz `[[26, 0, 0], [0, 19, 0], [0, 0, 15]]` (n=60).

## Por qué se eligió el árbol (y no el empate svc)

Árbol y svc empatan en validación (acc/F1 1.0, matrices idénticas).
El desempate no es por métrica sino por criterio del curso y de backend:

1. Interpretabilidad: el árbol se grafica (`plot_tree`) y muestra qué
   feature y qué umbral decide cada prioridad; svc RBF es caja negra.
   El curso pide árbol justamente para ver qué está pensando el modelo.
2. Simplicidad operativa: el árbol no necesita `StandardScaler` (usa el
   preprocesador #18 tal cual); svc/knn/logística sí. Menos piezas que
   pueden romperse con zonas no vistas.
3. Costo: inferencia del árbol O(profundidad), svc O(n_soporte × features).
4. Coherencia con la etiqueta: la etiqueta es una regla determinista por
   umbrales sobre las mismas features; el árbol la representa directo,
   svc la aproxima con RBF. Elegir el árbol dice la verdad sobre el dato
   sintético en vez de esconderla.

Lectura honesta: el árbol gana porque la etiqueta es una regla
determinista sobre las mismas features (ver abajo); la logística lineal
con escala se acerca pero confunde medias/altas vecinas, knn queda en el
medio (solo falla 2 medias → baja) y svc empata al árbol pero pierde en
interpretabilidad y costo. El 1.0 en test no prueba utilidad operativa.

### Resumen para la defensa

Elegimos el árbol porque obtuvo el mejor F1 en nuestra validación, empatado con
SVC, y porque sus decisiones se pueden visualizar y explicar con más facilidad.
No afirmamos que sea siempre superior a KNN: los resultados dependen de la
partición y del procedimiento. Además, como las etiquetas son sintéticas, las
métricas miden qué tan bien el modelo aprende la regla construida, no su eficacia
real en la recolección.

## Etiquetas y variables (sintéticas)

- `X`: `cantidad_contenedores`, `dias_desde_ultima_recoleccion`,
  `tipo_zona`, `historico_quejas_vecinales`. `y`: `prioridad_recoleccion`.
  `tramo_id` solo trazabilidad, nunca predictor.
- Quejas: sorteos anónimos uniformes `[0, 3]` por contenedor representado,
  suma por tramo, cero si no hay contenedores (semilla 0, estable por
  `tramo_id`, independiente del orden de filas).
- Regla: `score = 2*dias + contenedores + zona_w + 2*quejas`,
  `zona_w = {residencial: 0, industrial: 1, comercial: 2}`;
  baja `score <= 0`, media `1..2`, alta `> 2`.
- Balances: el 129/125/43 era de la regla #9 sin quejas; con la regla #18
  y seed 0 es **129 baja / 93 media / 75 alta**. No confundir el reparto
  de zonas 60/25/15 con el split 60/20/20.
- Las métricas miden ajuste a esta regla construida, no desempeño
  operativo real. Foto única T0, sin series temporales.

## Por qué no regresión lineal ("¿cuánto va a costar?")

El curso (sesión 3, `notebook-1-regresion-lineal`) usa regresión lineal
para valor continuo. En este TP el costo (`costo_total_m`) no se predice
con ML: se **calcula** exacto desde el grafo (suma de `longitud_m` +
repeticiones de Hierholzer / cartero chino) sobre los tramos incluidos
(media/alta). El dataset no trae etiqueta de costo y el costo depende de
la topología global + la selección, no solo de las features de un tramo.
Por eso la tarea ML es **clasificación** de prioridad (baja/media/alta) y
el árbol tampoco predice costo: predice prioridad y el costo sale después
del planificador. Una regresión directa de costo perdería trazabilidad y
rompería la separación clasificación → grafos.

## Por qué la regla es agresiva (y qué pasa si se mueve)

Con peso 2 en días, 1 día solo ya da score 2 = media y 2 días dan 4 =
alta sin importar el resto. Es agresiva a drede: la regla original (#8,
umbrales 10/16) daba 99.7% baja con datos reales, se recalibró a 0/2 para
poblar las tres clases en este CSV (129/93/75). En el CSV actual
`dias ∈ {0: 275, 1: 22}`, `contenedores {0: 210, 1: 51, 2: 30, 3: 6}`,
quejas media 0.59 (75% en cero, max 6): por eso el peso de días hoy mueve
poco, pero con varios días la regla empuja todo a alta (latente, no
observado). Si la distribución base cambia, se re-tuna acá y se registra
el nuevo balance; nunca desde validación/test.

Sensibilidad medida con seed 0 (mismas quejas sintéticas, solo cambia la
regla; reproducible con `python scripts/analyze_rule_sensitivity.py`):

| Variante | baja | media | alta |
|---|---|---|---|
| Base `2*d+1*c+1*zw+2*q`, baja<=0 media<=2 | 129 (43.4%) | 93 (31.3%) | 75 (25.3%) |
| `baja_max` 0→1 | 165 (55.6%) | 57 (19.2%) | 75 (25.3%) |
| `media_max` 2→3 | 129 (43.4%) | 104 (35.0%) | 64 (21.5%) |
| `media_max` 2→1 | 129 (43.4%) | 36 (12.1%) | 132 (44.4%) |
| peso días 2→1 | 129 (43.4%) | 94 (31.6%) | 74 (24.9%) |
| peso quejas 2→1 | 129 (43.4%) | 100 (33.7%) | 68 (22.9%) |
| peso quejas 2→3 | 129 (43.4%) | 93 (31.3%) | 75 (25.3%) sin cambio |

Lectura: mover `baja_max` vacía media; mover `media_max` trasvasa
media↔alta (a 1, alta explota a 44.4%); el peso de días hoy casi no mueve
porque casi no hay días>0, pero con días 2+ dominaría. El árbol seguiría
dando ~1.0 con la regla nueva porque la aprende exacto: tunear la regla
mirando métricas es circular.

Procedimiento de cambio: proponer en issue, tocar solo `SCORE_LOW_MAX` /
`SCORE_MEDIUM_MAX` + `SCORE_FORMULA` en `synthetic_complaints.py`, re-correr
`prepare + compare` entero, registrar el nuevo balance y dar por invalidado
el test anterior (nuevo test de un solo uso).

## Verificación de escala: recorte medio (experimento)

Pregunta: ¿el piloto de 297 tramos representa bien, o hay que ir a más
ciudad? Para responder sin reescribir el pipeline se corrió el mismo
`prepare + compare` sobre el recorte medio documentado en
`dataset/01_red-vial-osm/README.md` (reserva prevista por el #8/#9):
misma semilla (`0`), misma regla sintética, misma metodología
(CV5 solo en train, elección en validación, test de un solo uso).
Rama `experimento-recorte-medio`; los CSV del piloto en `main` no se
tocan. Lo único que cambió en el código para este experimento fue el
`BBOX_WGS` y un bug genuino que el tamaño mayor dejó al descubierto
(ver abajo, `tramo_id` duplicados).

Alcance de la respuesta: cualitativa (¿cambia el ranking? ¿cambia el
ganador?) y cuantitativa (¿cuánto se achican las brechas y los
desvíos?). Todo lo de acá sale de `scripts/build_dataset.py` +
`scripts/train_compare.py` corridos en esta rama, con los logs
copiados abajo como evidencia.

### Recorte y build (recorte medio)

- `BBOX_WGS = {"o": -56.17, "s": -34.92, "e": -56.14, "n": -34.90}`
  (piloto: `-56.16, -34.915, -56.15, -34.905`). Es el recorte medio de
  la tabla de reservas: ~895 viales y ~788 contenedores estimados por
  intersección de bbox (aproximación, no segmentación final).
- Ejes únicos leídos (dedupe por `reftramo`): 42274.
- Fragmentos tras el clip al bbox: 1224 (piloto: ~304).
- Grafo, componente conexo mayor: 876 nodos, 1422 tramos.
- Contenedores (`09_levantes/containers.json`, foto T0) dentro del bbox:
  717. Asignados al tramo más cercano (radio 25 m): 713;
  no-asignados: 4. Tramos con >=1 contenedor: 411.
- Distancia de snap: min 0.1 m, max 17.9 m.
- `dias_desde_ultima_recoleccion` (máximo por tramo) en el medio:

| dias | tramos |
|---|---|
| 0 | 327 |
| 1 | 80 |
| 2 | 1 |
| 3 | 1 |
| 4 | 1 |
| 9 | 1 |

Suma 411: cierra con los tramos con >=1 contenedor (sin contenedor,
dias 0 por construcción).

Circuitos (`circuitCode`) en el recorte medio, con contigüidad del
subgrafo (componentes conexas por circuito):

| circuito | contenedores | tramos | componentes |
|---|---|---|---|
| B_DU_RM_CL_06 | 51 | 23 | 5 |
| B_DU_RM_CL_07 | 94 | 47 | 16 |
| B_DU_RM_CL_103 | 36 | 27 | 6 |
| CH_DU_RM_CL_101 | 15 | 9 | 5 |
| CH_DU_RM_CL_102 | 77 | 46 | 16 |
| CH_DU_RM_CL_103 | 46 | 26 | 5 |
| CH_DU_RM_CL_104 | 52 | 40 | 10 |
| CH_DU_RM_CL_105 | 67 | 39 | 15 |
| CH_DU_RM_CL_106 | 62 | 33 | 12 |
| CH_DU_RM_CL_107 | 69 | 30 | 9 |
| CH_DU_RM_CL_108 | 15 | 11 | 3 |
| CH_DU_RM_CL_109 | 11 | 10 | 5 |
| CH_DU_RM_CL_110 | 13 | 5 | 3 |
| CH_DU_RM_CL_111 | 40 | 22 | 6 |
| CH_DU_RM_CL_112 | 21 | 14 | 7 |
| CH_DU_RM_CL_113 | 10 | 8 | 3 |
| CH_DU_RM_CL_122 | 34 | 22 | 13 |

Totales: 713 contenedores (cierra con asignados), 412 asignaciones
tramo-circuito sobre 411 tramos (un tramo con contenedores de dos
circuitos). Ningún circuito es conexo por sí solo: las rutas reales
entrelazan circuitos, como en el piloto.

Cross-check SmartWaste (fuente independiente): 724 contenedores en el
bbox, 17 circuitos. Orden de magnitud consistente con los 717 de
levantes (no son la misma foto: SmartWaste y levantes difieren en
fecha y cobertura).

- `tipo_zona` (simulada, seed 42): comercial 344 (24.2%), industrial
  222 (15.6%), residencial 856 (60.2%). Idéntica a la 60/25/15 por
diseño, como en el piloto.
- Regla v1 sin quejas (la del CSV fuente): alta 222 (15.6%), baja 615
  (43.2%), media 585 (41.1%). Piloto: 43.4/42.1/14.5. El balance se
  mantiene: la recalibración 0/2 no era un accidente del piloto.
- Gates: esquema OK (876 nodos, 1422 tramos), cobertura OK, FK y
  longitudes OK.

### Metodología idéntica (seed 0)

`prepare_dataset(source, seed=0)`, split 60/20/20 estratificado:
`train 853 / validación 284 / test 285`. La clase mínima en train es
alta con 228 ejemplos: CV5 holgado (pedidos 5, usados 5). En el
piloto eran 178/59/60 con mínima 45: también viable, pero cada error
en validación pesaba 1.7 puntos; en el medio pesa 0.35.

| partición | n | baja | media | alta |
|---|---|---|---|---|
| train | 853 | 369 | 256 | 228 |
| validación | 284 | 123 | 85 | 76 |
| test | 285 | 123 | 86 | 76 |

Grids, pipelines, scoring (F1 macro) y baseline (mayoría): los mismos
que en el piloto, sin tocar.

### Etiqueta #18 en el recorte medio

Con quejas sintéticas (seed 0) y regla `2*d+1*c+1*zw+2*q`, umbrales
0/2, el balance sobre los 1422 tramos queda:

| clase | n | % |
|---|---|---|
| baja | 615 | 43.2% |
| media | 427 | 30.0% |
| alta | 380 | 26.7% |

Piloto: 129/93/75 (43.4/31.3/25.3). La distribución se conserva:
misma forma, ~4.8x más filas. Esto ya anticipa que la comparación de
modelos no va a dar vuelta el resultado: los modelos ven la misma
regla con la misma mezcla.

### Resultados en el recorte medio (seed 0)

| Modelo | CV acc | CV F1 | Val acc | Val F1 | Mejor grilla |
|---|---|---|---|---|---|
| arbol | 0.9977 ± 0.0029 | 0.9972 ± 0.0034 | 1.0000 | 1.0000 | max_depth=None, min_samples_split=2 |
| logistica | 0.9812 ± 0.0068 | 0.9779 ± 0.0080 | 0.9965 | 0.9958 | C=2.0 |
| knn | 0.9918 ± 0.0060 | 0.9904 ± 0.0070 | 1.0000 | 1.0000 | n_neighbors=3 |
| svc (RBF) | 0.9977 ± 0.0047 | 0.9973 ± 0.0055 | 1.0000 | 1.0000 | C=1.0 |
| baseline (mayoría) | — | — | 0.4331 | 0.2015 | — |

Validación, orden baja/media/alta, n=284 (123/85/76):

#### arbol

Matriz `[[123, 0, 0], [0, 85, 0], [0, 0, 76]]`.
Precisión/recall 1.0 en las tres clases.
VP/VN/FP/FN: baja 123/161/0/0; media 85/199/0/0; alta 76/208/0/0.
Cero errores, igual que en el piloto.

#### logistica

Matriz `[[123, 0, 0], [0, 84, 1], [0, 0, 76]]`.
Precisión: baja 1.000, media 1.000, alta 0.987 (76/77).
Recall: baja 1.000, media 0.988 (84/85), alta 1.000.
VP/VN/FP/FN: baja 123/161/0/0; media 84/199/0/1; alta 76/207/1/0.
Un solo error: una media real predicha alta (confusión vecina, la
misma familia que en el piloto, donde eran 4 errores).

#### knn

Matriz `[[123, 0, 0], [0, 85, 0], [0, 0, 76]]`.
Precisión/recall 1.0 en las tres clases.
VP/VN/FP/FN: baja 123/161/0/0; media 85/199/0/0; alta 76/208/0/0.
En el piloto fallaba 2 medias→baja; con más vecinos de entrenamiento
el error desaparece (k=3).

#### svc (RBF)

Matriz `[[123, 0, 0], [0, 85, 0], [0, 0, 76]]`.
Precisión/recall 1.0 en las tres clases.
VP/VN/FP/FN idénticos al árbol. Empate perfecto otra vez.

### Test de un solo uso (recorte medio)

Elegido por validación: arbol (mismo criterio que en el piloto:
empate en métrica con svc, gana por representabilidad).
Test reservado, n=285 (123/86/76): acc 1.0000, F1 macro 1.0000.
Matriz diagonal `[[123, 0, 0], [0, 86, 0], [0, 0, 76]]`.
Lectura honesta, igual que en el piloto: el 1.0 mide ajuste a la regla
sintética con 5x más filas, no desempeño operativo.

### Comparativa piloto vs recorte medio

Misma semilla, misma regla, misma metodología. Solo cambia N:

| Modelo | Piloto CV F1 | Medio CV F1 | Piloto val F1 (n=59) | Medio val F1 (n=284) |
|---|---|---|---|---|
| arbol | 0.9932 ± 0.0136 | 0.9972 ± 0.0034 | 1.0000 (0 errores) | 1.0000 (0 errores) |
| svc (RBF) | 0.9733 ± 0.0390 | 0.9973 ± 0.0055 | 1.0000 (0 errores) | 1.0000 (0 errores) |
| knn | 0.9743 ± 0.0315 | 0.9904 ± 0.0070 | 0.9680 (2 errores) | 1.0000 (0 errores) |
| logistica | 0.9619 ± 0.0367 | 0.9779 ± 0.0080 | 0.9268 (4 errores) | 0.9958 (1 error) |
| baseline | — | — | 0.2039 | 0.2015 |

Lectura, punto por punto:

1. El ranking se conserva: arbol≈svc ≥ knn > logística, y el
elegido es el mismo (árbol, por el mismo desempate de
representabilidad: svc empata en métrica pero es caja negra). La
decisión del piloto era correcta y el medio la confirma.
2. Las brechas se achican fuerte. La logística pasa de 4 errores a 1
(0.9268 → 0.9958) y kNN de 2 a 0 (0.9680 → 1.0000). En el piloto la
logística parecía claramente peor; en el medio casi empata. Con
val n=59 cada error son 1.7 puntos y el orden entre 2.° y 4.° puesto
era ruido: con n=284 cada error son 0.35 puntos.
3. Los desvíos de CV se achican ~5x (de ±0.03 a ±0.005). El piloto
sobreestimaba la incertidumbre tanto como las diferencias: con 297
filas no se podía distinguir 0.97 de 0.99; con 1422 tampoco se
puede distinguir 0.990 de 0.997, pero al menos el empate árbol/svc
queda declarado con barras de error que no se tocan con logística.
4. El baseline no se mueve (0.2039 → 0.2015): el piso del problema es
el mismo porque la mezcla de clases la fija la regla, no la zona.
5. El 1.0 en test persiste con 5x más datos. Si el 1.0 del piloto
parecía sospechoso, el del medio lo confirma como propiedad de la
etiqueta (determinista sobre las mismas features), no como mérito
del modelo. Más N no vuelve operativo lo sintético.

Conclusión parcial: el piloto representa bien para decidir (mismo
ganador, mismo criterio), pero no para publicar márgenes: subestimaba
a logística/kNN y exageraba la incertidumbre. Para el TP, el piloto
alcanza; el medio es la evidencia de que alcanza.

### Bug encontrado al escalar: `tramo_id` duplicados

El build del medio frenó en el gate `tramo_id duplicados`. Causa: el
`tramo_id` se derivaba de `(reftramo, frag_idx)` donde `frag_idx` era
el índice de partición dentro de cada fragmento del clip. Un mismo
eje IDE puede producir varios fragmentos disjuntos al recortar por
bbox (entra y sale del recorte), y cada fragmento reiniciaba su
`frag_idx` en 0: dos sub-segmentos distintos del mismo `reftramo`
terminaban con el mismo `tramo_id`. En el piloto no colisionó de
casualidad (ejes chicos, un fragmento por eje); en el medio sí.

Fix (portado a `main`, ver abajo): `_tramo_id` ahora recibe el índice
de ocurrencia 0-based del `reftramo` entre todos los sub-segmentos
(contador global en `build_graph`, orden determinista por
`(reftramo, frag_idx)`), en vez del `frag_idx` intra-fragmento.
Primera ocurrencia → `str(reftramo)`; siguientes →
`f"{reftramo}-{occ+1}"`. Verificación: gates en verde en el medio
(876 nodos, 1422 tramos) y, en `main` con bbox piloto, el rebuild da
salidas byte-idénticas (el fix es no-op donde no había duplicados).

Lección: el gate que "falló fuerte" hizo su trabajo. Sin ese gate, el
duplicado habría roto el join contenedor→tramo y la serie de quejas
por `tramo_id` en silencio.

### Costo y límites de escala (números medidos)

| Recorte | Fragmentos | Pares `intersects` (~F²) | Resultado |
|---|---|---|---|
| piloto | ~304 | ~92k | segundos |
| medio | 1224 | ~1.5M | minutos, OK |
| grande (reserva) | ~1945 (estimado) | ~3.8M | esperado: minutos, OK sin cambios |
| todo Montevideo | ~42k ejes | ~1.7M de millones | inviable con el doble loop |

El medio confirma empíricamente el análisis: el código actual aguanta
hasta el recorte grande, pero no la ciudad entera. Para la ciudad
hacen falta las tres mejoras previstas (índice espacial para cruces,
 snap por hash cuantizado, `nearest` por `STRtree`), que el TP no
necesita porque la pregunta ya quedó respondida en el medio.

Detalle que solo se ve con más N: hay 1 tramo con `dias=9` (score
>=18, alta sin importar el resto) y 4 contenedores a más de 25 m del
eje más cercano (cuarentena). En el piloto esos casos borde no
existían: otra forma en que el medio valida que el piloto era una
foto chica pero fiel.

### Cómo reproducir el experimento

```bash
git checkout experimento-recorte-medio
# scripts/build_dataset.py: BBOX_WGS medio + fix tramo_id
.venv/bin/python scripts/build_dataset.py   # gates en verde: 876 nodos, 1422 tramos
.venv/bin/python scripts/train_compare.py   # seed 0: 853/284/285, ver tabla de arriba
```

Salida del build (extracto):

```text
ejes unicos (dedupe reftramo): 42274
fragmentos en el bbox del piloto: 1224
nodos (CC mayor): 876
tramos (CC mayor): 1422
contenedores en el piloto: 717
asignados: 713 | no-asignados: 4
tramos con >=1 contenedor: 411
dist snap: min 0.1 m, max 17.9 m
tipo_zona (simulada, seed 42): {'comercial': 344, 'industrial': 222, 'residencial': 856}
prioridad_recoleccion (regla v1 recalibrada): {'alta': 222, 'baja': 615, 'media': 585}
[GATE] esquema OK (876 nodos, 1422 tramos), cobertura OK
[GATE] no-asignados -> contenedores: 4
```

Salida del compare (extracto, seed 0):

```text
seed=0 sizes={'train': 853, 'validation': 284, 'test': 285}
cv: pedidos=5 usados=5 (solo dentro de train)
arbol: cv_acc=0.9977±0.0029 cv_f1=0.9972±0.0034 val_acc=1.0000 val_f1=1.0000
logistica: cv_acc=0.9812±0.0068 cv_f1=0.9779±0.0080 val_acc=0.9965 val_f1=0.9958
knn: cv_acc=0.9918±0.0060 cv_f1=0.9904±0.0070 val_acc=1.0000 val_f1=1.0000
svc: cv_acc=0.9977±0.0047 cv_f1=0.9973±0.0055 val_acc=1.0000 val_f1=1.0000
baseline(mayoria): acc=0.4331 f1=0.2015
elegido por validacion: arbol
test (un solo uso, arbol): acc=1.0000 f1=1.0000
```

### Estabilidad ante semilla (seed 1, recorte medio)

Se re-corrió `train_compare.py --seed 1` sobre el mismo recorte medio
(cambian quejas sintéticas y particiones, no la zona ni la regla):

| Modelo | seed 0 CV F1 | seed 1 CV F1 | seed 0 val F1 | seed 1 val F1 |
|---|---|---|---|---|
| arbol | 0.9972 ± 0.0034 | 0.9986 ± 0.0028 | 1.0000 (0 errores) | 1.0000 (0 errores) |
| svc (RBF) | 0.9973 ± 0.0055 | 0.9945 ± 0.0052 | 1.0000 (0 errores) | 1.0000 (0 errores) |
| knn | 0.9904 ± 0.0070 | 1.0000 ± 0.0000 | 1.0000 (0 errores) | 1.0000 (0 errores) |
| logistica | 0.9779 ± 0.0080 | 0.9834 ± 0.0083 | 0.9958 (1 error) | 0.9875 (3 errores) |

Detalle seed 1 (val n=284, reparto 123/84/77: el split también rota
con la semilla):

- arbol: `[[123, 0, 0], [0, 84, 0], [0, 0, 77]]`, cero errores
  (misma grilla: max_depth=None, min_samples_split=2).
- svc: idéntica matriz, cero errores (C=1.0).
- knn: idéntica matriz, cero errores, con k=5 (seed 0 había elegido
  k=3: el k óptimo baila, el 1.0 no).
- logística: `[[123, 0, 0], [0, 83, 1], [0, 2, 75]]`, 3 errores
  vecinos (1 media→alta, 2 alta→media; C=2.0). Precisión:
  baja 1.000, media 0.976 (83/85), alta 0.987 (75/76). Recall:
  baja 1.000, media 0.988 (83/84), alta 0.974 (75/77).
- baseline: acc 0.4331, F1 0.2015 (idéntico: la mayoría sigue siendo
  baja con 123/284).
- Elegido: arbol. Test de un solo uso: acc 0.9965, F1 0.9959
  (284/285: un solo error).

Lectura: el ranking no se mueve con la semilla; lo único que se mueve
es cuántos errores vecinos comete la logística (1 o 3) y qué k elige
kNN (3 o 5). Dato honesto a favor del informe: con seed 1 el test del
árbol NO da 1.0 sino 0.9965. El 1.0 del piloto y del seed 0 es la
moda, no una garantía: con una sola muestra de test de 285 filas, un
error son 0.35 puntos. Publicar "100%" sin ese contexto sería
mentir con números verdaderos.

### Qué hiperparámetros elige cada N

| Modelo | Piloto (297) | Medio seed 0 (1422) | Medio seed 1 (1422) |
|---|---|---|---|
| arbol | max_depth=None, min_samples_split=2 | max_depth=None, min_samples_split=2 | max_depth=None, min_samples_split=2 |
| logistica | C=0.5 | C=2.0 | C=2.0 |
| knn | k=7 | k=3 | k=5 |
| svc (RBF) | C=1.0 | C=1.0 | C=1.0 |

El árbol y el SVC son invariantes a N y a semilla: la regla por
umbrales se aprende igual con 178 que con 853 filas de train. La
logística pide más regularización inversa (C 0.5→2.0) cuando tiene
más datos: con poco N, un C chico la protegía del ruido de la
frontera media/alta; con más N puede ajustar más. kNN baja de k=7 a
k=3/5: con train denso, menos vecinos alcanzan. Ningún cambio altera
la conclusión, pero explica por qué el piloto castigaba de más a los
modelos con frontera suave.

### Precisión y recall por clase en el medio (seed 0)

Árbol, kNN y SVC: 1.000 en precisión, recall y F1 en baja, media y
alta (no hay tabla que mostrar: la diagonal es perfecta).

Logística (el único con errores), validación n=284:

| clase | precisión | recall | F1 | soporte |
|---|---|---|---|---|
| baja | 1.000 (123/123) | 1.000 (123/123) | 1.000 | 123 |
| media | 1.000 (84/84) | 0.988 (84/85) | 0.994 | 85 |
| alta | 0.987 (76/77) | 1.000 (76/76) | 0.993 | 76 |

Macro: precisión 0.996, recall 0.996, F1 0.996. El error vive en la
frontera media↔alta, que es donde la regla `score<=2 / score>2` pone
el corte más fino (un día o una queja de diferencia). La frontera
baja↔resto (`score<=0`) la aprenden todos sin fallar: es el caso
trivial tramo vacío en zona residencial.

### Casos borde que el piloto no tenía

- Un tramo con `dias=9`: score mínimo 18, alta por cualquier camino.
  En el piloto el máximo era 1 día. Es el primer ejemplo real de la
  advertencia del informe ("con días 2+ domina"): con 1422 filas
  aparece 1 caso en 411 con contenedor (0.2%). La regla lo clasifica
  bien, pero confirma que la cola de días existe y el piloto no la
  veía.
- 4 contenedores fuera del radio de 25 m (cuarentena): 4/717
  (0.6%). No entran al cómputo de ningún tramo. En producción esos
  4 serían asignaciones manuales o radio mayor; en el TP se reportan
  y se excluyen, igual que en el piloto (donde fueron 0).
- Un tramo con contenedores de dos circuitos distintos (las 412
  asignaciones tramo-circuito sobre 411 tramos). El snap es por
  cercanía geométrica, no por circuito operativo: un tramo frontera
  puede servir a dos rutas. El modelo no usa `circuitCode`, así que
  no hay fuga; pero el planificador de grafos sí deberá decidir a
  qué circuito pertenece ese tramo.
- 327 de 411 tramos con contenedor tienen `dias=0` (80%): la foto T0
  es de recolección reciente en casi todo el recorte. La urgencia
  (`dias>=2`) es rara en los datos aunque la regla la pese mucho.
  Piloto: 275/297 con dias 0 (93%). Misma foto, misma lectura.

### Balances lado a lado (regla v1 vs #18, piloto vs medio)

| Etiqueta | Piloto (297) | Medio (1422) |
|---|---|---|
| v1 sin quejas: baja | 129 (43.4%) | 615 (43.2%) |
| v1 sin quejas: media | 125 (42.1%) | 585 (41.1%) |
| v1 sin quejas: alta | 43 (14.5%) | 222 (15.6%) |
| #18 con quejas: baja | 129 (43.4%) | 615 (43.2%) |
| #18 con quejas: media | 93 (31.3%) | 427 (30.0%) |
| #18 con quejas: alta | 75 (25.3%) | 380 (26.7%) |

Las quejas sintéticas mueven ~12 puntos de media a alta en ambos
recortes por igual (de 42/41% a 30/31% en media). La baja no se
mueve (43.4% → 43.2%): el `score<=0` solo lo dan tramos vacíos en
zona residencial, y ni las quejas ni la zona lo cambian. La
estabilidad del 43% de baja en 2 recortes × 2 reglas es la señal más
fuerte de que el piloto no era un accidente de muestreo.

### Contigüidad de circuitos y consecuencia para grafos

Los 17 circuitos del medio tienen entre 3 y 16 componentes conexas
cada uno (ver tabla de circuitos): ningún circuito barre una zona
conexa. Esto ya se veía en el piloto y se agrava con N: a más
ciudad, más entrelazado. Para el planificador (Hierholzer / cartero
chino) significa que cubrir "los tramos de un circuito" no es un
paseo conexo: hay que unir componentes por tramos de paso (no
prioritarios) o redefinir circuitos por conectividad, no por código
administrativo. El TP lo resuelve sobre el componente conexo mayor
del recorte; a escala ciudad habría que partir por municipios y
resolver cada componente por separado, o el cartero chino se vuelve
intratable.

### Qué no cambió (checklist)

- Métrica de elección: F1 macro (baja sigue ~43%, accuracy mentiría).
- Baseline tonto: 0.20 de F1 en ambos (piso idéntico).
- Pipelines con todo lo aprendido adentro (sin fuga), mismos grids.
- Test usado una sola vez por semilla, solo para el elegido.
- Desempate árbol vs SVC: mismas matrices, gana interpretabilidad +
sin scaler + O(profundidad).
- Lectura honesta: ajuste a la regla, no desempeño operativo.
- Criterio "alta y baja no se cruzan": se cumple en los 8
  experimentos (4 modelos × 2 recortes) y en seed 1. La confusión es
  siempre entre vecinas.

Salida del compare con seed 1 (extracto):

```text
seed=1 sizes={'train': 853, 'validation': 284, 'test': 285}
arbol: cv_acc=0.9988±0.0023 cv_f1=0.9986±0.0028 val_acc=1.0000 val_f1=1.0000
logistica: cv_acc=0.9859±0.0070 cv_f1=0.9834±0.0083 val_acc=0.9894 val_f1=0.9875
knn: cv_acc=1.0000±0.0000 cv_f1=1.0000±0.0000 val_acc=1.0000 val_f1=1.0000
svc: cv_acc=0.9953±0.0044 cv_f1=0.9945±0.0052 val_acc=1.0000 val_f1=1.0000
baseline(mayoria): acc=0.4331 f1=0.2015
elegido por validacion: arbol
test (un solo uso, arbol): acc=0.9965 f1=0.9959
```

### Amenazas a la validez (lo que ni el medio arregla)

- Foto única T0: no hay serie temporal, así que nada de acá prueba
generalización a otra semana. El `dias` de hoy es el residuo de la
ruta de ayer, no una variable exógena.
- `dias` concentrado en 0 (80% en el medio, 93% en el piloto): la
ponderación 2x de días casi no se ejercita. El tramo con `dias=9`
es 1 en 1422: existe, pero no alcanza para estimar la pendiente.
- `tipo_zona` simulada 60/25/15 en ambos recortes: la mezcla la
fijamos nosotros, no el municipio. Si la zona real correlaciona con
reclamos, el modelo no lo puede aprender de acá.
- Quejas sintéticas uniformes [0,3] por contenedor: sin sobredispersión
ni correlación espacial. Un barrio con evento (partido, feria) no
existe en estos datos.
- Test de 285 filas: ±0.35 puntos por error. El 1.0 y el 0.9965 son
la misma realidad con distinto redondeo de muestreo.
- La etiqueta es función determinista de X: cualquier modelo con
capacidad suficiente llega a ~1.0 con N grande. Esto pone techo a lo
que el experimento puede enseñar sobre "qué modelo es mejor" en
general: enseña cuál representa mejor ESTA regla.

### Trabajo futuro (no parte del TP)

- Correr el recorte grande (~1945 viales) con el código actual para
cerrar la trilogía piloto/medio/grande sin reescribir nada.
- Vectorizar el build (`STRtree` + snap por hash) y recién ahí
intentar la ciudad entera particionada por municipio.
- Cambiar la pregunta: predecir `dias` de la próxima foto (serie
temporal real) en vez de la etiqueta sintética. Ahí sí un 0.82
valdría más que este 1.0.

### Conclusión del experimento

El piloto alcanzaba: mismo ranking, mismo ganador, mismo desempate,
misma lectura honesta (ajuste a la regla, no desempeño operativo).
El medio aporta tres cosas que el piloto no tenía: desvíos chicos
que declaran el empate con propiedad, la prueba de que la
recalibración 0/2 no era un accidente del piloto, y un bug real
(`tramo_id`) encontrado y portado a `main`. No se recomienda ampliar
a toda la ciudad: el costo pasa de minutos a horas sin cambiar la
respuesta, porque la etiqueta es determinista a cualquier escala.

### El informe en 2 minutos
- Pregunta: ¿qué modelo del curso predice mejor la prioridad?
- Respuesta: el árbol, empatado con SVC y desempate por
  interpretabilidad (se grafica), sin scaler, O(profundidad).
- Prueba: piloto 297 + recorte medio 1422 + seed 1, misma
  metodología; el ranking no se mueve en ninguno.
- Número honesto: F1 macro en validación 1.0/1.0/1.0/0.99
  (árbol/SVC/kNN/logística en el medio) y test 1.0 (seed 0).
- Advertencia: la etiqueta es sintética y determinista; el 1.0
  mide ajuste a la regla, no recolección real.

Dónde está cada cosa:
- Metodología y métricas: sección "Cómo se evaluó".
- Piloto: sección "Resultados".
- Recorte medio: sección "Verificación de escala".
- Regla y sensibilidad: sección "Por qué la regla es agresiva".
- Figuras: `docs/figs/` (se regeneran con `--figures`).

## Figuras

El script las genera opcionalmente con `python scripts/train_compare.py --figures docs/figs`; el notebook también las produce y muestra al ejecutar su última celda.

- [`docs/figs/f1_comparacion.png`](figs/f1_comparacion.png): compara F1 macro medio de CV (barras de error = desviación estándar) con F1 de validación.
- [`docs/figs/matrices_confusion_validacion.png`](figs/matrices_confusion_validacion.png): muestra aciertos y confusiones por modelo; filas reales y columnas predichas, orden baja/media/alta.
- [`docs/figs/arbol_ganador.png`](figs/arbol_ganador.png): árbol final re-ajustado solo en train, truncado a profundidad 3 para facilitar la lectura.

## Bugs reconocidos y correcciones (#10)

1. `EvaluationProtocol(test_size=0.25)` no representaba el 60/20/20 de
   #18. Se documentó como legado y se agregó `cv_folds_requested` con
   `requested_folds()`; el split viaja en las particiones #18, no en el
   protocolo.
2. `ModelComparison` / `ModelMetrics` / `SklearnEvaluator` /
   `SklearnPredictor` / casos de uso eran plantillas `NotImplemented`.
   Ahora comparan, predicen y delegan de verdad; la aplicación sigue sin
   importar pandas/sklearn (test que lo audita).
3. La demo del README entrenaba con la regla vieja `etiqueta_v1`. Se
   actualizó a la preparación #18 + comparación #10.
4. Mapeo ES<->EN: el dataset habla español (`residencial`, `baja`...),
   el dominio en inglés (`residential`, `low`...). El predictor lo
   traduce explícitamente en ambos sentidos, con test.
5. Confusión de distribuciones y de porcentajes (zonas vs split, regla
   vieja vs nueva). Este informe fija los números reales con seed 0.
6. Riesgo de fuga (escalar/encodear global antes de CV). Cada fold
   recibe el pipeline sin ajustar y aprende solo de su train; el objeto
   compartido de #18 se clona y un test verifica que sigue sin ajustar.
7. Riesgo de elegir por test. La elección usa validación; test se toca
   una vez al final (`evaluate_final_on_test`), y los tests verifican
   que antes de ese paso no hay scores de test.
