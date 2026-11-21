# StruQ: Defending Against Prompt Injection with Structured Queries
- **Autores:** Sizhe Chen, Julien Piet, Chawin Sitawarin, David Wagner (UC Berkeley) · **Año:** 2024 (arXiv:2402.06363v2, 25 sep 2024; "to appear" en USENIX Security 2025, p. 1) · **Enlace:** https://arxiv.org/abs/2402.06363 · **Tema:** defensa contra inyección de prompts a nivel de interfaz y de entrenamiento (separación de instrucción y datos)
- **Cobertura de lectura:** páginas 1–20, completo (cuerpo, tablas, apéndices A.1–A.6, B.1–B.2 y referencias). Lectura sobre el .txt extraído; no fue necesario abrir el PDF.

## Resumen
El paper parte de que los LLM integrados en aplicaciones reciben el prompt del desarrollador y los datos del usuario en una sola cadena, así que el modelo tiende a seguir las instrucciones que aparezcan en los datos (inyección de prompts; pp. 1, 3). Los autores proponen "structured queries": una API que separa prompt y datos en dos canales. Lo implementan como StruQ, con dos piezas: un front-end que codifica la consulta con tokens reservados y filtra esos delimitadores de los datos, y un ajuste de instrucciones estructurado (structured instruction tuning) que entrena al modelo para obedecer solo las instrucciones del prompt. Con Llama-7B y Mistral-7B, la tasa de éxito de los ataques manuales baja a menos de 2 % según el texto (p. 2), y los ataques de Completion-Real pasan de 96 % a 0 % en Llama (p. 10). Contra los ataques de optimización TAP y GCG la defensa reduce el éxito, pero no lo elimina: en Llama, TAP baja de 97 % a 9 % y GCG de 97 % a 58 % (p. 10). La pérdida de utilidad medida con AlpacaEval es pequeña. Los autores concluyen que la defensa no es completamente segura en el peor caso (p. 14).

## Método
- **Modelo de amenaza:** el atacante puede modificar la parte de datos de la consulta, pero no el prompt; el prompt y el formato de la aplicación se asumen conocidos (p. 5).
- **Modelos:** Llama-7B y Mistral-7B, ajustados completos desde modelos base (no instruct), 3 épocas, tasa de aprendizaje 2×10⁻⁵ (Llama) y 2.5×10⁻⁶ (Mistral) (p. 9).
- **Entrenamiento:** dataset Alpaca limpio. 50 % de las muestras sin cambios y 50 % atacadas: ataque Naive (25 %) y ataque Completion-Other (25 %) (pp. 8–9, Algoritmo 1). Tokens nuevos inicializados con el embedding de "###", "instruction", etc. (p. 8).
- **Front-end:** tokens reservados [MARK], [INST], [INPT], [RESP], [COLN] y filtro recursivo que borra esos tokens y "##" de los datos (pp. 7–8).
- **Ataques de evaluación:** Naive, Ignore (10 variantes escritas a mano), Escape-Deletion, Escape-Separation, Completion-Other/Real/Close/OtherCmb/RealCmb, HackAPrompt (20 entradas), TAP y GCG (pp. 4–7; GCG con 500 iteraciones de optimización, p. 7). Son al menos 15 tipos de ataque (p. 2).
- **Métrica de seguridad:** tasa de éxito de ataque. El éxito es que el modelo imprima "Hacked!", revisado a mano; en HackAPrompt se inyecta "I have been PWNED" (p. 9). Cada ataque se aplica a 208 muestras de AlpacaFarm con campo de datos (p. 9).
- **Métrica de utilidad:** AlpacaEval 1.0, 805 muestras de AlpacaFarm, juez GPT-4, tasa de victoria frente a davinci003. Error estándar de 0.7 % (p. 9).
- **Adaptativos:** nueve variantes de delimitadores "casi reales" (número de almohadillas, mayúsculas, typos, sinónimos por similitud de embedding) (p. 10).
- **Comparación:** defensas en tiempo de prueba (recordatorio en el prompt, recordatorio tras los datos, aislamiento con comillas, demostraciones en contexto) y BIPIA sobre Vicuna-7B (pp. 12–13).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Completion-Real, Llama sin defensa (ASR) | 96% | 10 |
| Completion-Real, Llama con StruQ (ASR) | 0% | 10 |
| TAP, Llama: sin defensa → StruQ (ASR) | 97% → 9% | 10 |
| GCG, Llama: sin defensa → StruQ (ASR) | 97% → 58% | 10 |
| Utilidad AlpacaEval, Llama: sin defensa → StruQ | 67.2% → 67.6% | 10 |
| Utilidad AlpacaEval, Mistral: sin defensa → StruQ | 80.0% → 78.7% | 10 |
| Recordatorio en el prompt (test-time), Completion-Real, ASR | 83% | 12 |
| BIPIA (Vicuna-7B), Completion-Real, sobre el conjunto de prueba de StruQ (ASR) | 23% | 13 |
| Muestras de AlpacaFarm con campo de datos para evaluar ataques | 208 | 9 |
| Muestras de AlpacaEval para utilidad | 805 | 9 |
| Consultas al LLM que usa GCG por muestra | 256k | 14 |

## Citas textuales
- "Prompt injection attacks are an important threat: they trick the model into deviating from the original application’s instructions and instead follow user directives." (p. 1)
- "However, StruQ is not yet fully secure, and more research is needed." (p. 2)
- "StruQ shows promising results but is not a completely secure defense in the worst case." (p. 14)

## Limitaciones
Reconocidas por los autores:
- Solo protege aplicaciones programáticas que invocan el LLM por API o librería; no aplica a chatbots multi-turno, donde el usuario no puede separar instrucciones de datos (p. 13).
- No defiende contra jailbreaks, extracción de datos ni otros ataques al LLM (p. 14).
- No es seguro en el peor caso: GCG logra una tasa de éxito no trivial (p. 14). Llama "no es completamente inmune" a TAP y GCG (p. 10).
- El ajuste aprendido con ataques manuales no generaliza del todo a inyecciones específicas de tarea, optimizadas con más recursos (p. 10).
- La metodología favorece al atacante por ser datos de AlpacaFarm más cortos que en otros estudios (p. 9).
- La pérdida de AlpacaEval en Mistral (80.0 → 78.7 en la Tabla 3, p. 10; el texto dice "about one percentage point", p. 9) está en el límite de la significancia estadística; en Llama no es significativa (p. 9).
- La defensa requiere modelos base sin ajuste de instrucciones y ajuste propio. Los autores piden a los proveedores que ofrezcan esos modelos para fine-tuning (p. 14).

Observación propia:
- Los modelos son 7B abiertos de 2023 (Llama, Mistral). No hay resultados sobre modelos de frontera ni sobre APIs comerciales como las que usa MESH (Haiku 4.5, Sonnet 4.6). El 0 % no se traslada automáticamente a esos modelos.
- El criterio de éxito es que el modelo escriba "Hacked!". No mide una acción con efecto, como llamar a una herramienta de reembolso. Para MESH el daño es la acción, no el texto.
- Con 208 muestras por ataque, un 0 % tiene un intervalo amplio. El paper no reporta intervalos de confianza para las tasas de ataque.
- La separación es por consulta. Si la salida de un agente se vuelve datos de otro y luego instrucción de un tercero, el paper no dice nada sobre esa cadena.

## Qué le sirve a MESH
1. **Respalda el planteamiento de la amenaza (es el modelo de amenaza que el paper asume en p. 5; no lo demuestra).** El paper modela el atacante como alguien que controla los datos y no el prompt (p. 5). Un correo externo de fraude BEC o de inyección cae en esa categoría. Frase candidata para el pitch (p. 3): "Prompt injection attacks are yet another instance of this vulnerability pattern, now in the context of LLMs." (Inferencia propia: la ruta correo externo → agentes → herramienta es la versión multiagente de ese mismo patrón.)
2. **Justifica que la defensa final esté fuera del modelo (demostrado y, en parte, inferencia).** El propio StruQ, la defensa más fuerte del paper, deja 58 % de GCG en Llama (p. 10) y se declara no completamente seguro (p. 14). Eso apoya que el control de aprobación lo haga el sandbox y no el prompt. Inferencia: el argumento de MESH es más fuerte que el de StruQ, porque MESH no depende de que el modelo aprenda a ignorar.
3. **La etiqueta de procedencia tiene un análogo, con una advertencia (inferencia).** La idea de StruQ es que el canal de instrucciones lo marcan tokens que el atacante no puede producir (pp. 4, 7). La etiqueta de MESH, puesta por el sistema y transportada entre agentes, cumple algo parecido. Pero si la etiqueta viaja como texto dentro del prompt, el paper sugiere que la advertencia en el prompt es débil: el recordatorio en el prompt deja 83 % de éxito (p. 12). Conviene revisar que la etiqueta sea un campo estructurado y no texto que el modelo lea como instrucción.
4. **Cadenas de agentes: punto ciego del paper y lugar donde MESH aporta (inferencia).** Las "rutas de riesgo" de MESH cubren justo lo que StruQ no cubre: los datos de un agente se convierten en instrucción del siguiente. StruQ separa canales en una sola llamada. Esto permite citar el paper como base de la separación y decir que MESH extiende la idea a cadenas multiagente.
5. **Métrica y diseño de experimento para copiar.** El paper reporta la tasa de éxito por ataque, con línea base sin defensa, en una tabla por familia (Tabla 2), y dedica una sección a ataques adaptativos sobre la propia defensa (§5.2). Esa forma de reportar sirve para la tabla de MESH (17/21 → 6/21 con approval_gate). Advertencia: MESH debe medir la acción (llamada a la herramienta) y no solo la respuesta de texto.
6. **Límite de USD 500 y verificación del remitente (fuera de alcance).** El paper no mide montos ni remitentes; no respalda ni contradice el umbral de MESH. Solo sirve como argumento general de que la defensa en el prompt no basta. No conviene citarlo para justificar esas dos defensas.

Resumen de lo que demuestra el paper frente a lo que es inferencia: el paper demuestra la tasa de éxito de cada ataque sobre Llama-7B y Mistral-7B con y sin StruQ, la pérdida de utilidad y la superioridad frente a BIPIA y las defensas de prompt. Todo lo que dice sobre MESH, sobre herramientas, reembolsos y cadenas de agentes es inferencia.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 55 · corregidas: 6 · eliminadas: 1.
- Correcciones:
  - Método: "TAP y GCG con 500 iteraciones" atribuía las 500 iteraciones a TAP; el paper solo las da para GCG (p. 7).
  - Método: el criterio de éxito es imprimir "Hacked!" (p. 9); "I have been PWNED" es la cadena inyectada en HackAPrompt, no el criterio de éxito.
  - Resumen: "el modelo sigue cualquier instrucción" era una generalización fuerte; se cambió a "tiende a seguir" (pp. 1, 3).
  - Limitaciones: "La mejora de AlpacaEval en Mistral" era una pérdida (80.0 → 78.7, Tabla 3, p. 10).
  - Limitaciones: se eliminó "el conjunto de evaluación es de un solo tipo de tarea (p. 9, Tabla 2)"; el paper no lo dice y la Tabla 2 está en la p. 10.
  - Qué le sirve #1: el modelo de amenaza es un supuesto del paper (p. 5), no algo demostrado.
  - Qué le sirve #3: la idea de tokens reservados está en la p. 4 (y en la p. 7), no en la p. 3.
- Pendiente: los apéndices (pp. 15–20: A.1–A.6, B.1–B.2) y las referencias no se releyeron en esta verificación, así que la cobertura de lectura declarada en la cabecera no quedó comprobada. Las cifras de MESH (17/21, 6/21, 8/21, 3/21, 12/12, 4/12, 7/12, 8/12, USD 500) no se verificaron contra el paper, como se pidió. Las frases marcadas como inferencia propia no se evaluaron como hechos del paper.
