# Entrenamiento y comparación de clasificadores (issue #10)

Compara `DecisionTreeClassifier` (sesión 4, `notebook-1-arboles-decision`)
contra `LogisticRegression` multiclase (sesión 3, `notebook-2-logistica`;
sesión 5, `notebook-1-metricas` celda 9 y `notebook-2-validacion-cruzada`
celda 28) sobre la preparación reutilizable de #18, sin duplicarla ni
reescribir el CSV.

Ejecución reproducible (desde la raíz):

```bash
python scripts/train_compare.py
```

El notebook `notebooks/10_entrenamiento_modelos.ipynb` llama al mismo
código del backend; no es una segunda implementación.

## Metodología (la del ticket + curso, misma para ambos)

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
  `min_samples_split [2, 5]`; logística `C [0.5, 1.0, 2.0]`.
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
| baseline (mayoría) | — | — | 0.4407 | 0.2039 | — |

Validación (orden baja/media/alta):

- árbol: `[[26, 0, 0], [0, 18, 0], [0, 0, 15]]`, precisión/recall 1.0.
- logística: `[[26, 0, 0], [2, 16, 0], [0, 2, 13]]`, precisión 0.9392,
  recall 0.9185.

Elegido por validación: **arbol**. Test un solo uso (arbol):
acc 1.0000, precisión/recall/F1 1.0000,
matriz `[[26, 0, 0], [0, 19, 0], [0, 0, 15]]` (n=60).

Lectura honesta: el árbol gana porque la etiqueta es una regla
determinista sobre las mismas features (ver abajo); la logística lineal
con escala se acerca pero confunde medias/altas vecinas. El 1.0 en test
no prueba utilidad operativa.

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
