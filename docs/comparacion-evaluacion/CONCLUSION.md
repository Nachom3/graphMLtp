# Conclusión — comparación de evaluación (cuaderno `comparacion_evaluacion.ipynb`)

Repo auditado (solo lectura): rama `notebooks-comparacion-evaluacion`, SHA `61565d46687c7cbdb9a1dd1dc7a90a7c1490dd99`, `status` limpio salvo untracked ajenos a ML, CSV con SHA idénticos a `dataset/salida/metadata.json`, seed 0, partición 178/59/60 verificada por reimplementación independiente.

Reproducción del repo (`scripts/train_compare.py --source dataset/salida/tramos.csv --seed 0`, sin escribir en el repo): CV 5/5 folds solo en train; elegido por validación = `arbol`; test un solo uso acc=1.0000 f1=1.0000; baseline mayoría acc=0.4407 f1=0.2039.

Comparación propia (mismo test n=60 para los 6; train_full n=237; CV 5 folds estratificados solo en train; `pd.get_dummies` solo con train + `StandardScaler` dentro del `Pipeline`; `GridSearchCV` solo en train; test tocado una sola vez):

- regla_exacta: test_acc=1.0000, test_f1=1.0000, CV_f1=1.0000±0.0000 (es la etiqueta: el 1.0 era esperable por construcción).
- arbol: test_acc=0.9833, test_f1=0.9800, CV_f1=0.9898±0.0125 (aprende la regla; árbol sin escala como en el curso).
- logistica: test_acc=1.0000, test_f1=1.0000, CV_f1=0.9695±0.0301 / knn: test_acc=1.0000, test_f1=1.0000, CV_f1=0.9950±0.0099 / svc: test_acc=0.9333, test_f1=0.9216, CV_f1=0.9753±0.0221.
- dummy_mayoria: test_acc=0.4333, test_f1=0.2016, CV_f1=0.2019±0.0026 (piso ingenuo de mayoría).

Evidencia del curso (material externo Intro-A-ML, citas por archivo/celda): `train_test_split` estratificado S5 `notebook-1-metricas` celda 5; baseline ingenuo S5 `notebook-1` celda 7; `make_pipeline(StandardScaler(), ...)` S5 `notebook-1` celda 9 y S4 `notebook-2-knn-svm` celdas 37-38 (árbol sin escala); matriz filas=real y `classification_report` S5 `notebook-1` celdas 13-14/18-24; CV 5 folds y `mean±std` S5 `notebook-2-validacion-cruzada` celdas 6/9/10/12; protocolo test-intocable + elegir con CV en train + `GridSearchCV` S5 `notebook-2` celdas 13-18; todo-dentro-del-pipeline S5 `notebook-2` celdas 26-27; `pd.get_dummies` S2 `notebook-2-preprocesamiento` celda 8. `ColumnTransformer`/`OneHotEncoder`/`StratifiedKFold` nominal/`DummyClassifier` no están en el curso (grep en `clases/` = 0): se rotulan como extensiones sklearn, no como contenido de clase.

Fuga: no detectada en train/test (sin columna `score`, IDs fuera de `X`, preprocesamiento sin ajustar fuera de folds, test un solo uso). La circularidad regla↔etiqueta es declarada por el Enunciado (sintético con reglas que el modelo debe descubrir), no una fuga. Diferencias de features registradas en §4.

Limitaciones: N=297 (cada error en test ≈1.7pp); etiqueta y 2/4 features sintéticas; foto única sin serie temporal; sin control espacial; el 1.0 mide ajuste a la regla, **no causalidad ni utilidad operativa real**.
<!-- FIN -->
