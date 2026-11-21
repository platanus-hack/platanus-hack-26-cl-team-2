# On the Resilience of LLM-Based Multi-Agent Collaboration with Faulty Agents
- **Autores:** Jen-tse Huang, Jiaxu Zhou, Tailin Jin, Xuhui Zhou, Zixi Chen, Wenxuan Wang, Youliang Yuan, Michael R. Lyu, Maarten Sap · **Año:** 2024 (arXiv:2408.00989; versión v4 de 28 de mayo de 2025; publicado en ICML 2025, PMLR 267) · **Enlace:** https://arxiv.org/abs/2408.00989 · **Tema:** resiliencia de sistemas multiagente basados en LLM frente a agentes torpes o maliciosos, según la estructura de comunicación.
- **Cobertura de lectura:** páginas 1–25, completo. Se leyeron las 1.395 líneas del .txt, incluidas las referencias (p. 10–13) y los apéndices A–D (p. 14–25). No hizo falta abrir el PDF.

## Resumen
Los sistemas multiagente reparten una tarea entre agentes que se pasan mensajes, así que un agente que comete errores puede contaminar al resto. Los autores estudian seis sistemas agrupados en tres estructuras (lineal, plana y jerárquica), con cuatro tareas (generación de código, matemáticas, traducción y evaluación de texto) y backbones GPT-3.5 y GPT-4o. Para simular agentes defectuosos proponen AutoTransform, que reescribe el perfil de un agente para que introduzca errores sutiles, y AutoInject, que altera directamente los mensajes entre agentes. Encuentran que la estructura jerárquica es la más resistente (caída de 5.5% según el abstract) y la lineal la más frágil (23.7%), y que la generación de código es la tarea más sensible (caída de 22.6%). Algunos sistemas (MAD, Camel, AgentVerse) mejoran en ciertos casos con errores inyectados. Como defensas proponen Challenger (cada agente cuestiona los mensajes recibidos) e Inspector (un agente extra que revisa y corrige todos los mensajes); combinados recuperan 96.4% de la pérdida en Self-collab. Concluyen que la frecuencia de mensajes erróneos pesa más que la cantidad de errores dentro de un mensaje.

## Método
- **Backbones:** GPT-3.5 y GPT-4o para todos los agentes, temperatura 0; el análisis de factores usa GPT-3.5 (p. 5). En el apéndice B.6 agregan LLaMA-3.1-70B-Instruct y o1-Mini en subconjuntos (p. 16).
- **Sistemas (Tabla 1, p. 4):** lineal: MetaGPT y Self-collab; plana: Camel y SPP; jerárquica: MAD y AgentVerse. Se introduce un solo agente defectuoso a la vez, y los agentes normales no saben que hay uno (p. 5).
- **Datasets (p. 4):** HumanEval (164 problemas, Pass@1); CIAR (50 preguntas, exactitud); CommonMT (100 oraciones muestreadas de la categoría Lexical, evaluadas con BLEURT-20); FairEval (80 etiquetas humanas win/tie/lose, exactitud).
- **Inyección de fallos (p. 3–4):** AutoTransform reescribe el perfil del agente (prompt en p. 24). AutoInject intercepta mensajes y reemplaza líneas u oraciones por versiones erróneas generadas por un LLM. Por defecto Pm = 1.0 y Pe = 0.2, con errores semánticos. Pm es la probabilidad de que un mensaje sea defectuoso y Pe la proporción de líneas o oraciones erróneas dentro de ese mensaje.
- **Métrica:** puntajes de 0 a 100; el impacto se expresa como caída respecto de la versión sin agente defectuoso (vanilla), promediando las cuatro tareas (p. 4–5).
- **Modelo de amenaza:** un agente interno, torpe o malicioso, que genera errores difíciles de detectar. Las tareas son solo texto, sin herramientas ni acciones con efecto (p. 25). Que no haya atacante externo es inferencia mía; el paper no lo declara (el agente defectuoso es uno de los agentes del sistema, p. 2–3). Comunicación solo por mensajes directos, sin resúmenes ni broadcast (p. 5).
- **Defensas (p. 8):** Challenger, una instrucción extra en el perfil para cuestionar mensajes; Inspector, un agente que intercepta todos los mensajes y los corrige (prompts en p. 25).
- **Tamaño de muestra y estadística:** no encontré intervalos de confianza ni repeticiones para los puntajes principales en el texto.

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Caída de rendimiento, estructura jerárquica (según abstract) | 5.5% | 1 |
| Caída de rendimiento, estructura plana (según abstract) | 10.5% | 1 |
| Caída de rendimiento, estructura lineal (según abstract) | 23.7% | 1 |
| Caída en generación de código por agentes defectuosos (texto de introducción) | 22.6% | 2 |
| Pm y Pe por defecto en AutoInject | 1.0 y 0.2 | 4 |
| Problemas en HumanEval (Pass@1) | 164 | 4 |
| Errores inyectados analizados en generación de código (Tabla 8) | 80 | 15 |
| Camel, AutoInject: rendimiento sin mejora vs. con Challenger + Inspector (Tabla 3) | 29.3 vs. 48.6 | 8 |
| Recuperación con Challenger + Inspector en Self-collab (pérdida de rendimiento); en la Tabla 3 (p. 8) corresponde a AutoTransform; con AutoInject sale 93.2% (cálculo propio) | 96.4% | 9 |
| GPT-3.5, promedio: agente único vs. multiagente vanilla (Tabla 5) | 48.02 vs. 52.78 | 14 |
| GPT-3.5, generación de código con AutoInject: error semántico vs. sintáctico, promedio (Tabla 7) | 39.15 vs. 47.78 | 14 |

## Citas textuales
- "Experiments on four downstream tasks using six systems show that the “hierarchical” structure, i.e., A→(B↔C), exhibits superior resilience with the lowest performance drop of 5.5%, compared to 10.5% and 23.7% of other two structures." (p. 1)
- "With the Challenger and the Inspector together, we recover 96.4% of the performance loss on the Self-collab system." (p. 9)
- "We find that certain multi-agent collaboration systems, such as MAD, Camel, and AgentVerse, benefit from deliberately injected errors rather than being hindered by them." (p. 6)

## Limitaciones
Reconocidas por los autores:
- Presupuesto: todos los agentes comparten el mismo backbone (GPT-3.5 o GPT-4o) con temperatura cero, y la evaluación depende solo de métricas automáticas (p. 25).
- Solo cuatro benchmarks de texto, así que las conclusiones pueden no extrapolarse a interacción multimodal, diálogo abierto o planificación de largo plazo (p. 25).
- Cada sistema usa su propio código y diseño de roles, y la estructura queda mezclada con la ingeniería de prompts. Mitigan parcialmente con dos sistemas por estructura (p. 25).
- Modificaron los prompts de algunos sistemas para adaptarlos a las cuatro tareas (p. 5; detalle en p. 17).
- AutoTransform no siempre produce errores (p. 5) y no controla la tasa de errores: con objetivos de 20% y 40% de líneas erróneas, las tasas reales tuvieron desviaciones muy grandes (p. 15).
- Declaran el riesgo de uso dañino de sus métodos de inyección (Impact Statement, p. 10).

Observación propia:
- Las tareas son respuestas de texto. No hay llamadas a herramientas, correos ni acciones con efecto externo, así que el paper no dice nada sobre aprobación de acciones de alto riesgo.
- Muestras chicas en algunas tareas: CIAR tiene 50 preguntas y FairEval 80 etiquetas (p. 4). Cada pregunta puede mover el puntaje de forma notable.
- Sin intervalos de confianza. Diferencias de pocos puntos, como las de la Tabla 6, pueden ser ruido.
- Dos cifras distintas para la misma estructura jerárquica: 5.5% en el abstract (p. 1) y 12.1% y 9.2% para los dos métodos en la conclusión (p. 9). El texto no las reconcilia.
- El abstract dice que se recuperan "up to 96.4% errors made by faulty agents" (p. 1), pero el cuerpo dice "96.4% of the performance loss" (p. 9). No es lo mismo, y el 96.4% es sobre Self-collab en código.
- La defensa es otro LLM que lee el mismo contenido. El caso del comentario distractor (p. 7–8) sugiere que un revisor LLM puede ser engañado, y no se prueba un atacante adaptado al Inspector.
- En los experimentos principales hay un solo agente defectuoso (p. 5). El experimento con dos agentes defectuosos (B.3, p. 16) usa AgentVerse en matemáticas y no informa tamaño de muestra.

## Qué le sirve a MESH
1. **Respalda (demostrado en su setting):** la cadena lineal es la más frágil (23.7%, p. 1), y los errores en el nodo que reparte las tareas pesan más (p. 7). MESH es una cadena lineal (Camila → Mateo → Tomás). El paper lo respalda como estructura de riesgo, pero en tareas de texto, no en correo. Inferencia mía: la aprobación debe ir donde la acción tiene efecto (la herramienta), no depender de que un agente intermedio la revise.
2. **Etiqueta de procedencia (no probada aquí):** el paper no prueba etiquetas de origen. La combinación Challenger + Inspector es la que más recupera (96.4% en Self-collab con AutoTransform, p. 9 y Tabla 3, p. 8). El Inspector solo, un revisor LLM sobre todos los mensajes, no siempre supera al Challenger (Self-collab con AutoInject: 67.7 frente a 72.0, p. 8), y el caso "the bug had been corrected" (p. 7–8) muestra que el modelo obedece el texto en lenguaje natural. Inferencia mía: una etiqueta puesta por el sistema, fuera del texto del mensaje, no depende de ese juicio. La evidencia para eso sigue siendo la de MESH, no la de este paper.
3. **Rutas de riesgo y tasa de contaminación (demostrado en su setting):** los errores inyectados en mensajes (AutoInject) pesan más que cambiar el perfil en GPT-3.5 (p. 5; −12.12 frente a −11.42, diferencia menor de un punto; en GPT-4o ocurre al revés), y la frecuencia de mensajes erróneos pesa más que los errores dentro de cada mensaje (p. 9). Métrica para copiar: Pm (fracción de mensajes contaminados) y Pe (fracción de líneas dentro del mensaje). Sirve para barrer la fracción de correos con inyección en MESH.
4. **Límite de USD 500 y verificación del remitente:** el paper no evalúa ni menciona ninguno de los dos. No se debe usar como respaldo.
5. **Semántico vs. sintáctico (demostrado en código):** los errores semánticos, que parecen correctos, dañan más que los sintácticos (39.15 vs. 47.78, p. 14). Uso el sentido de la p. 7; la definición de la p. 4 está invertida respecto de ese uso. Inferencia mía: un correo de fraude BEC plausible y sin error visible cae en esa categoría, así que la detección por contenido no basta.
6. **Frase para el pitch:** "exhibits superior resilience with the lowest performance drop of 5.5%" (p. 1). Aclarar que se midió en código, matemáticas, traducción y evaluación, no en correo. El 96.4% no debe presentarse como resultado general; es sobre Self-collab con Challenger + Inspector (y AutoTransform).

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 68 · corregidas: 7 · eliminadas: 0.
- Correcciones:
  - Método, comunicación: p. 4 → p. 5.
  - Modelo de amenaza: páginas corregidas (texto solo en p. 25); "no hay atacante externo" queda marcado como inferencia.
  - Números clave, fila 96.4%: en la Tabla 3 (p. 8) corresponde a AutoTransform; con AutoInject, 93.2% (cálculo propio).
  - Qué le sirve 2: "defensa más eficaz" exagerado; el Inspector solo no siempre supera al Challenger (p. 8).
  - Qué le sirve 3: magnitudes (−12.12 vs. −11.42, diferencia pequeña) y reversión en GPT-4o (p. 5).
  - Qué le sirve 5: la definición de semántico/sintáctico de la p. 4 está invertida respecto del uso de la p. 7.
  - Qué le sirve 6: "con un revisor LLM" → con Challenger + Inspector.
- Pendiente: no revisé línea por línea las referencias (p. 11–13) ni los prompts de C.1, C.2 y C.4 (p. 17–23); la nota no cita datos de ellos. La inversión de definiciones en la p. 4 es un problema del paper, no resuelto.
