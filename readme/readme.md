# Trabajo Práctico Integrador — Lógica y Teoría de Grafos

## Introducción

En las materias vimos grafos como una herramienta para modelar problemas: caminos mínimos, árboles recubridores, flujos, coloreo, recorridos eulerianos. En la práctica los grafos suelen estar dados: los nodos, las aristas y sus pesos son parte de los problemas. En la realidad esto nunca es así. ¿Cuánto tarda un camión en recorrer una calle a las 18 h con lluvia? ¿Qué tan probable es que un estudiante apruebe una materia? ¿Cuántos estudiantes van a querer rendir dos exámenes el mismo día? Esos números hay que estimarlos a partir de datos!

Este trabajo práctico integra tres cosas que trabajamos durante el año:

1. **Machine Learning**: entrenar un modelo sencillo que a partir de datos históricos prediga una cantidad o una categoría relevante para el problema.
2. **Teoría de grafos**: usar esas predicciones como entrada (aristas, capacidades, pesos, etc.) de un algoritmo de grafos.
3. **Desarrollo web**: mostrar todo eso como una aplicación web, con un backend que haga los cálculos y un frontend donde se pueda ver y probar el resultado.

La idea es poder completar un proyecto:

> problema → datos → modelo predictivo → grafo con pesos → algoritmo de grafos → aplicación web

Si bien queremos ver que cada parte funcione por separado, también que están conectadas. Si el modelo predice algo, el algoritmo de grafos se adapta y eso se puede ver en la aplicación.

## Consignas generales (aplican a todos los TPs)

### Modalidad

- El trabajo se realiza en grupos de 2 personas.
- Cada grupo elige uno de los cinco TPs propuestos en este documento.
- Alternativamente, el grupo puede proponer un TP propio. La propuesta debe cumplir todas las consignas generales de esta sección (problema, modelo predictivo, algoritmo de grafos que use las predicciones, backend y frontend) y tiene que ser aprobada por los profes antes de empezar.
- Fecha de entrega: 08/11/2026.

### Qué tiene que hacer cada grupo

Independientemente del TP elegido, el trabajo consta de las siguientes etapas:

1. **Entender el problema.** Elegir un problema y entender qué significa: quién lo tiene, qué decisión se quiere tomar, qué información haría falta para tomarla bien y por qué un grafo es una buena forma de modelarlo.
2. **Elegir variables y entrenar un modelo.** Identificar qué features sirven para predecir algo útil para el problema, y entrenar un modelo. Puede ser un problema de clasificación o de regresión. Los modelos que pueden usar son:
   - Regresión lineal.
   - Regresión logística.
   - KNN.
   - SVM.
   - Árboles de decisión.

   Se pueden entrenar y comparar varios. Se deben seguir las prácticas que vimos en clase.

3. **Implementar algoritmos de grafos que usen las predicciones.** Los algoritmos pedidos en cada TP tienen que recibir como entrada lo que predice el modelo (por ejemplo, como peso de las aristas). Si el modelo cambia su predicción, el resultado del algoritmo tiene que poder cambiar.
4. **Armar un backend y un frontend.** El backend contiene toda la implementación (preparación de datos, modelo, algoritmos de grafos) y la expone mediante una API. El frontend consume esa API y permite que los profes veamos cómo funciona, cambiar parámetros y ver el resultado.
5. **Documentar el uso de IA.**

### Datasets reales o sintéticos

Para entrenar el modelo hace falta un dataset. Pueden encararlo de dos formas, ambas válidas:

- **Dataset real adaptado**: Buscar un dataset público (datos abiertos, Kaggle, UCI, datos de gobierno, etc.) relacionado con el problema y adaptarlo: renombrar o combinar columnas, filtrar, completar lo que falte. Hay que citar la fuente y explicar qué transformaciones se hicieron.
- **Dataset sintético**: Generar los datos artificialmente.

Seguramente se preguntarán qué es un dataset sintético. Es un conjunto de datos que no fue sacado del mundo real, sino fabricado para que se parezca a datos reales. Se usa cuando los datos reales no existen, son privados o son difíciles de conseguir. Pueden usar herramientas de IA para generar el dataset sintético (por ejemplo, pidiéndole que escriba un script generador). En ese caso:

- Conviene que la IA genere un script que produzca los datos, y no que escriba las filas a mano. El script es reproducible, se puede ajustar y permite generar la cantidad de datos que haga falta.
- El script (o el procedimiento usado) se entrega junto con el código.
- Tienen que declarar las reglas que usaron para generar los datos (qué variable influye en cuál y cómo). Un dataset sin estructura (por ejemplo, valores completamente al azar) hace que el modelo no pueda aprender nada útil.
- Tengan en cuenta que el modelo va a descubrir las reglas que ustedes pusieron. Es esperable y está bien, pero hay que mencionarlo.

Las tablas de campos que aparecen en cada TP son puramente orientativas. Indican el tipo de información esperada, pero pueden agregar, quitar o renombrar columnas si lo necesitan.

### Herramientas sugeridas

Pueden elegir los lenguajes, librerías y frameworks. Lo único que pedimos es que el backend exponga sus resultados mediante una API y que el frontend corra en el navegador y la consuma. Como punto de partida pueden usar estas herramientas:

- **Python** para el backend con paquetes extra:
  - Machine Learning: scikit-learn, junto con pandas para manejar los datos.
  - Grafos: networkx para representar el grafo (nodos, aristas, atributos) y para leerlo o escribirlo.
  - API: Flask o FastAPI.
- **TypeScript** con React.

### Uso de inteligencia artificial

El uso de herramientas de IA no solo está permitido sino que es altamente recomendado y esperado. Son herramientas que van a usar en su vida profesional, y saber usarlas bien es parte de lo que queremos que aprendan.

Por "usarlas bien" entendemos que la IA es una herramienta que ustedes dirigen y no un reemplazo de entender el trabajo. Algunos usos razonables: generar el dataset sintético, armar el esqueleto del frontend, explicar un error, proponer una forma de visualizar el grafo, revisar si una implementación es correcta. Lo que no puede pasar es que no sepan explicar qué hace su propio código. En la defensa oral les vamos a preguntar sobre cualquier parte del trabajo así que estén atentos.

El informe debe incluir una sección de uso de IA donde expliquen:

- Qué herramientas usaron.
- Para qué partes del trabajo las usaron, y para cuáles no.
- Algunos ejemplos concretos de prompts que les resultaron útiles.
- Casos en los que la IA se equivocó o propuso algo incorrecto, y cómo se dieron cuenta.
- Una reflexión breve: ¿en qué los ayudó y en qué no?

### Entregables

1. Código fuente en un repositorio Git (backend y frontend), con historial de commits que refleje el trabajo incremental del grupo (no se aceptan repositorios con un único commit final).
2. Informe que incluya:
   - Descripción del problema y decisiones de diseño.
   - Descripción del dataset utilizado (fuente o reglas de generación sintética, features elegidas y por qué).
   - Metodología de entrenamiento del modelo: partición de datos, métricas usadas, resultados obtenidos, análisis de errores.
   - Descripción del algoritmo de grafos implementado.
   - Explicación de cómo se integran ambas partes (qué salida del modelo se usa como entrada del algoritmo de grafos, y por qué esa transformación es razonable).
   - Capturas de pantalla del frontend funcionando.
   - Sección de uso de IA (ver Uso de inteligencia artificial).
   - Limitaciones conocidas y posibles extensiones.
3. Demo funcionando end-to-end (backend + frontend).
4. Instrucciones de instalación y ejecución (README.md) que permitan levantar el proyecto desde otro entorno.

## Recolección de residuos

### Contexto

El área de higiene urbana de un municipio quiere optimizar el recorrido de sus camiones recolectores. A diferencia de un problema de entregas, donde importa visitar puntos, acá el camión tiene que recorrer calles completas, y no todas las calles necesitan recolección con la misma urgencia. El municipio los contrata para construir un sistema que prediga qué tramos tienen más prioridad y use esa predicción para calcular un recorrido que los cubra a todos de forma eficiente.

### Objetivo

Construir un sistema que combine un modelo predictivo (para estimar la prioridad de recolección de cada tramo) con algoritmos de grafos para calcular un recorrido que pase por todos los tramos prioritarios.

### Datos

Se puede modelar la zona como un grafo no dirigido:

- **Nodo**: intersección.
- **Arista**: tramo de calle con su distancia o tiempo de recorrido.

El grupo debe generar (o conseguir) un dataset de tramos con, al menos, estas columnas:

| Campo | Tipo | Descripción |
| --- | --- | --- |
| tramo_id | id | identificador de la arista |
| tipo_zona | categórica | residencial / comercial / industrial |
| cantidad_contenedores | numérico | — |
| dias_desde_ultima_recoleccion | numérico | — |
| historico_quejas_vecinales | numérico | — |
| prioridad_recoleccion | categórica | alta / media / baja: variable a predecir |

### Requisitos

1. **Modelo predictivo**: entrenar un modelo de clasificación que, a partir de las características de un tramo, prediga su prioridad de recolección. Analizar métricas (accuracy, precisión, recall, matriz de confusión) sobre un conjunto de test separado.
2. **Selección de tramos**: definir un criterio (por ejemplo, prioridad media o alta) para decidir, según la predicción del modelo, qué tramos tiene que recorrer el camión.
3. **Grafos**: implementar el algoritmo de Hierholzer para construir un circuito que recorra todos los tramos seleccionados. Si el subgrafo no es euleriano, resolver el problema del cartero chino: encontrar los vértices de grado impar, calcular caminos mínimos entre ellos con Dijkstra, emparejarlos con costo mínimo, duplicar esos caminos y construir el circuito sobre el grafo resultante. Para el emparejamiento se puede usar una librería, aclarándolo en el informe.

### Frontend

- Visualización del grafo de calles, con los tramos coloreados según la prioridad predicha.
- Visualización paso a paso del recorrido calculado, marcando los tramos que se recorren más de una vez.
- Costo total del recorrido.
