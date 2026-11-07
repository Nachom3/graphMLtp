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
