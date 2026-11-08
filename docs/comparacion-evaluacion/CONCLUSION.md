# Conclusión — comparación de evaluación (cuaderno `comparacion_evaluacion.ipynb`)

Repo auditado (solo lectura): rama `feat/clean-p1`, SHA `3795432b1300cfed3c8172bcdc189ff10acd4a9e`, `status` limpio salvo untracked ajenos a ML, CSV con SHA idénticos a `dataset/salida/metadata.json`, seed 0, partición 178/59/60 verificada por reimplementación independiente.

Reproducción del repo (`notebooks/10_entrenamiento_modelos.ipynb`, ejecutado sin escribir en el repo): CV 5/5 folds solo en train; elegido por validación = `arbol`; test un solo uso acc=1.0000 f1=1.0000; baseline mayoría acc=0.4407 f1=0.2039.

Comparación propia con protocolo del curso (train_full n=237; CV 5 folds estratificados solo en train; `pd.get_dummies` solo con train + `StandardScaler` dentro del `Pipeline`; `GridSearchCV(multimétrica, refit=F1)` solo en train; veredicto por CV sin mirar test; test tocado una sola vez y solo por el ganador):

- VEREDICTO POR CV: gana `knn` con 0.9950±0.0099 (F1) y params {'kneighborsclassifier__n_neighbors': 3}. Ranking CV: arbol 0.9898±0.0125, logistica 0.9695±0.0301, knn 0.9950±0.0099, svc 0.9753±0.0221. Dummy (piso, no compite): 0.2019. Regla exacta (referencia, no compite): 1.0.
- CONFIRMACIÓN EN TEST (solo ganador, n=60, un solo uso): `knn` acc=1.0000 f1=1.0000. Los demás modelos no tocan test (celdas vacías en la tabla) para no re-elegir por test.
- Experimento distinto al del notebook 10: acá se selecciona por CV sobre 237; el notebook 10 selecciona en validación 59 (train 178) y entrega `arbol`. No son intercambiables; el modelo entregado es el `arbol` que sirve el backend.

Evidencia del curso: `train_test_split` estratificado S5 `notebook-1-metricas` celda 5; baseline ingenuo S5 `notebook-1` celda 7; `make_pipeline(StandardScaler(), ...)` S5 `notebook-1` celda 9 y S4 `notebook-2-knn-svm` celdas 37-38 (árbol sin escala); matriz filas=real y `classification_report` S5 `notebook-1` celdas 13-14/18-24; CV 5 folds y `mean±std` S5 `notebook-2-validacion-cruzada` celdas 6/9/10/12; protocolo test-intocable + elegir con CV en train + `GridSearchCV` S5 `notebook-2` celdas 13-18; todo-dentro-del-pipeline S5 `notebook-2` celdas 26-27; `pd.get_dummies` S2 `notebook-2-preprocesamiento` celda 8.

Fuga: no detectada en train/test (sin columna `score`, IDs fuera de `X`, preprocesamiento sin ajustar fuera de folds, test un solo uso solo por el ganador). La circularidad regla↔etiqueta es declarada por el Enunciado, no una fuga. La CV reportada es métrica de selección (`best_index_` de `GridSearchCV`), no estimación independiente del procedimiento (eso pediría CV anidada).

Limitaciones: N=297 (cada error en test ≈1.7pp); etiqueta y 2/4 features sintéticas; foto única sin serie temporal; sin control espacial; el 1.0 mide ajuste a la regla, **no causalidad ni utilidad operativa real**.
<!-- FIN -->
