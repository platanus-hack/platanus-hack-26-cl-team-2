# LLMail-Inject: A Dataset from a Realistic Adaptive Prompt Injection Challenge
- **Autores:** Sahar Abdelnabi, Aideen Fay, Ahmed Salem et al. · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2506.09956 · **Tema:** inyección de prompts indirecta, ataques adaptativos humanos contra un asistente de correo con herramientas, evaluación end-to-end y defensas (clasificadores, spotlighting, juez LLM, TaskTracker)
- **Cobertura de lectura:** páginas 1–41, completo (texto extraído de las 2200 líneas, incluidas referencias y apéndices A–N). No se abrió el PDF porque las tablas se leen bien en el texto. Los gráficos de barras y de flujo (Figs. 2–4, 6, 11–18) se leyeron solo por su leyenda; los valores de la Tabla 1 a la Tabla 9 sí están en el texto.

## Resumen
El paper presenta LLMail-Inject, un reto público de red-teaming adaptativo sobre un asistente de correo con LLM: 839 participantes enviaron 461,640 intentos, que dieron 208,095 prompts únicos. A diferencia de los benchmarks con plantillas (100–1,000 ejemplos), el ataque debe cumplir la cadena completa: el correo debe ser recuperado, evadir las defensas y provocar una llamada a `send_email` con los argumentos correctos. El reto tuvo dos fases; entre ambas los organizadores reforzaron las defensas con datos de la fase 1, de modo que el adversario se adapta a las defensas desplegadas. Los autores publican la plataforma, el código, las configuraciones de defensa y las anotaciones. Los modelos que cumplen menos de 5% de ASR en benchmarks existentes siguen siendo vulnerables: Meta SecAlign 70B logra 32.0% de ASR, GPT-4o 58.0% y GPT-5 mini 47.0% en el replay posterior al reto, sin optimizar los ataques. Los ataques también se transfieren a otros dominios (37.0% en un agente de código de prueba de concepto y 28.0%–45.0% en tareas de archivos y calendario, con GPT-4o). Entre las defensas, los clasificadores de texto son los más débiles, el juez LLM detecta casi todo (recall 0.994 en fase 1) pero exige unas 6 veces más intentos, y la combinación de defensas llega a 99.8% de recall.

## Método
- **Montaje:** asistente de correo con cuatro niveles. Nivel 1: resumir los dos correos más recientes, con el correo atacante siempre incluido. Nivel 2: resumir los diez más recientes, con el atacante en medio. Niveles 3 y 4: pregunta sobre "Project Zenith" o "Q2 Budget" con recuperación de los diez correos más relevantes. En el nivel 4 el atacante además debe exfiltrar una cifra ("NUM million" de la proyección de Q2) (p. 3). Cada subnivel combina escenario de recuperación, defensa y LLM (p. 4). La fase 1 tuvo 40 subniveles y la fase 2, 24 (p. 4).
- **Modelos del reto:** Phi-3-medium-128k-instruct (modelo abierto) y GPT-4o-mini (con jerarquía de instrucciones) (p. 4). **Replays posteriores:** GPT-4o, GPT-5-mini, Meta-SecAlign-70B y GPT-5 (p. 4; Tabla 5 en p. 9).
- **Defensas de detección (p. 3):** spotlighting (delimitadores con marca aleatoria, reemplazo de espacios); Prompt Shield (clasificador de texto de Microsoft, caja negra, con FPR calibrado por debajo de 5%); juez LLM (prompt que marca inyecciones); TaskTracker (sonda lineal sobre diferencias de activaciones; en la Tabla 3 aparecen variantes con Phi-3 14B, Phi-3.5 MoE y Phi-4 14B). Una submission es exitosa si cumple todas las condiciones a la vez (p. 4).
- **Fase 2 (p. 4, p. 29):** defensas actualizadas con datos de la fase 1, más una blocklist conformal (paráfrasis con GPT-4o mini y embeddings text-embedding-3-large, α = 1) y sanitización de tokens especiales.
- **Tamaño de muestra:** 370,724 submissions en la fase 1 (292 equipos, 621 participantes) y 90,916 en la fase 2 (110 equipos adicionales, 218 participantes) (p. 4). Para la evaluación de detección: 25,323 ataques que llamaron a la herramienta en fase 1 y 3,688 en fase 2 (p. 8). Falsos positivos: 1,000 correos del corpus Enron (p. 14).
- **Métricas:** "Tool Call" (llamada correcta a la herramienta, con o sin detección) y "E2E Attack Success" (llamada correcta y sin detección) (p. 5). **TSR** (team success rate): fracción de equipos que resolvieron un subnivel, para no premiar el número de intentos (p. 6). Número de intentos hasta el primer éxito por equipo (p. 7). Recall de detección (p. 8). ASR en replays (p. 8–9).
- **Modelo de amenaza (p. 3–4):** el atacante conoce los niveles, los criterios de éxito y el funcionamiento de las defensas, y recibe retroalimentación por submission; no se revelan el system prompt, los delimitadores de spotlighting ni los nombres de herramienta y argumentos (se añade un sufijo aleatorio al nombre de la herramienta). No hay penalización por intentos fallidos (p. 4, p. 28).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Participantes en el reto | 839 | 1 |
| Intentos de ataque enviados (ambas fases) | 461,640 | 2 |
| Prompts únicos (ambas fases) | 208,095 | 1 |
| Recall del juez LLM, fase 1 (sobre ataques que llamaron a la herramienta; Tabla 3) | 0.994 | 8 |
| Recall del clasificador de texto v1, fase 1 (Tabla 3) | 0.604 | 8 |
| TSR del clasificador de texto, nivel 4, GPT-4o-mini (Tabla 1) | 0.600 | 7 |
| TSR con todas las defensas combinadas, nivel 4, GPT-4o-mini (Tabla 1) | 0.166 | 7 |
| Intentos promedio hasta el primer éxito por equipo, fase 1: juez LLM vs. clasificador de texto (Tabla 2) | 506.2 ± 948.46 vs. 88.90 ± 426.2 | 7 |
| ASR de GPT-4o en el replay, sin optimización (Tabla 5) | 58.0 | 9 |
| ASR de Meta SecAlign 70B en el replay (Tabla 5) | 32.0 | 9 |
| ASR de transferencia con GPT-4o a agente de código, nuevo system prompt (Tabla 6) | 37.0 | 9 |
| FPR de todas las defensas combinadas en 1,000 correos de Enron (Tabla 8) | 10.0 | 14 |

Nota: en el texto, el recall combinado de todas las defensas aparece como 99.8% (p. 8) y coincide con la Tabla 4 (0.998, p. 9). Esa cifra no entra en la tabla de arriba porque ya la cubre la Tabla 3/4.

## Citas textuales
- "Real emails usually contain instructions, and text classifiers may not tell those apart from attacks that share the same surface features." (p. 9)
- "For example, in Phase-2, using all defenses combined with GPT-4o-mini did not result in any successful attacks." (p. 16)
- "LLMail-Inject is the only fully open-sourced indirect prompt injection benchmark that evaluates end-to-end attacks" (p. 13, leyenda de la Tabla 7)

## Limitaciones
Reconocidas por los autores:
- **Alcance del objetivo (p. 10):** los ataques cubren un rango más estrecho de tareas de agente que un benchmark general; el objetivo principal es que el agente envíe un correo (y en nivel 4, exfiltrar datos). Son 64 subniveles con una sola herramienta.
- **Reproducibilidad (p. 10):** el clasificador de producción de Microsoft no se libera; se publica su salida por submission para recalcular las métricas, pero no la reproducción completa de la pila de defensas.
- **Métricas (p. 10):** el TSR sigue influido por cómo los equipos repartieron su esfuerzo. Los autores afirman que el ranking de defensas se mantiene al restringir el análisis.
- **Comparaciones de modelos (p. 10):** son descriptivas, no causales; no pueden separarse arquitectura, datos, procedimientos de seguridad e inferencia de modelos propietarios.
- **Taxonomía (p. 10):** no es exhaustiva; la evaluación de 500 prompts sin refinamiento mide si los patrones extraídos son reutilizables (18% con GPT-5.4-mini, 2% con GPT-5.2), no la vulnerabilidad máxima de cada modelo.
- **Fase 1 frente a fase 2 (p. 10):** cambiaron a la vez el clasificador, las versiones de TaskTracker, el prompt del juez, la sanitización y la blocklist, así que no se puede atribuir la caída de éxito a un componente.
- **Dual-use (p. 10):** el dataset puede servir para mejorar ataques; los autores argumentan que el beneficio defensivo lo compensa.
- **Blocklist conformal (p. 29):** no da garantías frente a atacantes adaptativos ni frente a otros métodos de generación de ataques.
- **Falsos positivos (p. 14):** la combinación de todas las defensas da 10% de FPR en Enron, "higher than would be acceptable in a deployed setting without further calibration" (p. 14). Los umbrales se calibraron con correos sintéticos, que son "relatively short" (p. 14).
- **Reproducibilidad del modelo (p. 28):** Phi-3 es poco reproducible incluso con semilla fija, y su llamada a herramientas es frágil; por eso no se penalizaron reenvíos.

Observación propia:
- El recall de la Tabla 3 se calcula solo sobre ataques que ya llamaron a `send_email` (25,323 en fase 1). No es una tasa de falsos negativos sobre todos los ataques, así que sobrestima la detección real.
- Las cifras de replay (Tablas 5 y 6) no indican cuántos ataques se reprodujeron por modelo ni su intervalo de confianza. Con ASR de un solo número no se puede juzgar la diferencia entre 32.0 y 47.0.
- Las etiquetas de ataque del dataset (104,583 "injection", 23,911 "unclear" en fase 1) son de un LLM. Los autores revisaron 200 muestras y el juez acertó en 198 (p. 5, p. 14–15).
- El texto dice "GPT-5 with high reasoning shows 22%" (p. 8) y la Tabla 5 dice 22.8 (p. 9). Uso el de la tabla.
- La leyenda de la Fig. 5 dice "371k submissions" y el texto dice 370,724 (p. 4, p. 7). Es redondeo.
- La defensa "spotlighting" con Phi-3 casi no produce éxitos (p. 6), lo que mezcla el efecto del modelo con el de la defensa.

## Qué le sirve a MESH
1. **Respalda el argumento de que el sandbox, no el modelo, debe decidir.** Demuestra: los clasificadores de texto tienen recall de 0.604–0.678 en fase 1 (Tabla 3, con el texto como única señal), y los propios autores concluyen que los clasificadores no separan instrucciones legítimas de ataques (p. 9). Inferencia: la aprobación por procedencia de MESH no depende de clasificar el contenido, así que evita el problema que el paper documenta. Frase de apoyo: la cita de la p. 9.
2. **La etiqueta de procedencia tiene un precedente, pero el paper no la prueba.** El spotlighting del paper marca el origen con delimitadores que el modelo tiene que respetar (p. 3, p. 26), y la defensa sigue dependiendo de que el modelo la obedezca: con Phi-3 casi no hay éxitos, pero los equipos la evadieron en otros casos (p. 6, p. 30). Demuestra: un marcador dentro del prompt es vulnerable a que el modelo ignore la marca. Inferencia: la etiqueta de MESH, puesta por el sistema y fuera del alcance del modelo, responde a esa debilidad. No hay datos del paper que la comparen directamente.
3. **Rutas de riesgo y herramientas distintas de `send_email`.** Demuestra: los ataques transfieren a otras herramientas (subir archivo 28.0%, borrar evento de calendario 45.0%, Tabla 6, p. 9) y el nivel 4 exige exfiltrar datos con una herramienta de envío. Inferencia: en MESH el riesgo debería definirse por herramienta y no solo por monto, porque los objetivos del paper no tienen monto en USD. Es un argumento para el catálogo de herramientas peligrosas de MESH.
4. **Límite de USD 500.** El paper no usa montos, así que no lo valida ni lo contradice. Inferencia: un umbral por monto funciona como filtro de gravedad, no de inyección. Una acción de bajo monto (p. ej. un reembolso bajo el límite) sigue siendo un ataque válido, y el paper muestra que las llamadas con argumentos correctos ocurren sin importar el objetivo (Tabla 6). Conviene decirlo así en el pitch: el límite no detecta la inyección, solo acota el daño.
5. **Verificación del remitente.** El paper no prueba la verificación de remitente. Demuestra: la familia de ataques "friendly reciprocity" y "sender-incapacity pressure" describe correos que piden al asistente actuar en nombre de un remitente que "cannot email directly" (p. 37). Inferencia: si el remitente es legítimo pero está comprometido o la petición viene de un correo interno manipulado, la verificación sola no cubre el caso. Por eso MESH necesita la etiqueta y la aprobación además de la verificación.
6. **Métrica y frase para el pitch.** Copiar la distinción entre "Tool Call" y "E2E Attack Success" (p. 5) y el TSR con intentos hasta el primer éxito (p. 6–7) para medir MESH: cuántas rutas llegan a la herramienta y cuántas se bloquean. Frases para el pitch, con cita verificada: "LLMail-Inject is the only fully open-sourced indirect prompt injection benchmark that evaluates end-to-end attacks" (p. 13), y, para la dificultad del ataque completo, "representing less than 1% of total submissions" (p. 7, sobre los correos que llegaron a llamar a la herramienta con destino y contenido correctos). Este resultado se refiere a un solo dominio (correo).
