# Benchmarking and Defending Against Indirect Prompt Injection Attacks on Large Language Models
- **Autores:** Jingwei Yi, Yueqi Xie, Bin Zhu, Emre Kiciman, Guangzhong Sun, Xing Xie, Fangzhao Wu · **Año:** 2023 (preprint arXiv; publicado en KDD '25) · **Enlace:** https://arxiv.org/abs/2312.14197 · **Tema:** inyección indirecta de prompts, benchmark BIPIA y defensas
- **Cobertura de lectura:** páginas 1–12, completo (incluye referencias, Tabla 5 y 6, apéndices A–C). Se leyó el texto extraído; no fue necesario abrir el PDF, las tablas salieron legibles.

## Resumen
Las aplicaciones que integran LLMs con contenido externo (correos, páginas web, tablas, código) pueden ser manipuladas por instrucciones escondidas en ese contenido, es decir, por inyección indirecta de prompts. Los autores presentan BIPIA, el primer benchmark para medir este riesgo: cubre cinco escenarios de aplicación y 250 objetivos de atacante, con 626,250 prompts de entrenamiento y 86,250 de prueba. Evalúan 25 LLMs y encuentran que todos son vulnerables, y que los más capaces (GPT-4 y GPT-3.5-turbo) tienen ASR más altas en tareas de texto. Atribuyen el problema a dos causas: el modelo no distingue entre contexto informativo e instrucciones accionables, y no evita ejecutar instrucciones que aparecen dentro del contenido externo. Proponen dos defensas: una black-box, basada en prompts (diálogo multi-turno, aprendizaje en contexto y recordatorio explícito), y una white-box, con tokens especiales `<data>` y `</data>` y fine-tuning adversarial. La black-box reduce la ASR pero no la elimina; la white-box la lleva cerca de cero en Vicuna-7B y 13B con utilidad medida por MT-Bench y ROUGE-1 (con una caída fuerte en MT-Bench en Vicuna-13B que el texto solo menciona como posible efecto en tareas generales, p. 9; ver Limitaciones).

## Método
- **Dataset BIPIA:** tres factores, tarea de aplicación, tipo de ataque y posición de la instrucción dentro del contenido (p. 3). Cinco tareas: email QA con 100 correos reales de OpenAI Evals; web QA (NewsQA); table QA (WikiTableQuestions); summarization (XSum; web QA, table QA y summarization muestrean 1,000 ejemplos cada una) y code QA con 100 muestras de Python de Stack Overflow (p. 3). Ataques: 30 tipos de texto y 20 de código, cinco instrucciones maliciosas cada uno, divididos en train y test (p. 3). Posiciones: inicio, medio y final del contenido (p. 3).
- **Modelos:** 25 LLMs de código abierto y cerrado (p. 2). Defensas black-box probadas en GPT-4, GPT-3.5-Turbo, Vicuna-7B y Vicuna-13B; white-box en Vicuna-7B y Vicuna-13B (p. 2 y p. 7).
- **Métrica:** ASR calculada con evaluación basada en reglas, LLM-as-judge y detección de idioma con langdetect (p. 3). Utilidad: ROUGE-1 (recall) contra la respuesta objetivo en BIPIA-Clean y MT-Bench (p. 7). Temperatura 0; máximo 2,000 tokens en black-box y 512 en la evaluación white-box (p. 3 y p. 7).
- **Entrenamiento white-box:** AdamW, una época, learning rate 2e-5, batch 128, longitud máxima 2,048; las respuestas de entrenamiento vienen de tres fuentes: etiquetas de BIPIA, respuestas del LLM original sin ataque o respuestas de GPT-4 sin ataque (p. 7).
- **Modelo de amenaza:** el atacante modifica el contenido externo, conoce el LLM usado y no puede alterar la aplicación ni el LLM; los autores asumen que ambos son confiables (p. 3).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Prompts de entrenamiento / prueba de BIPIA | 626,250 / 86,250 | 3 |
| Objetivos de atacante en BIPIA (escenarios de aplicación: cinco) | 250 | 2 |
| LLMs evaluados con BIPIA | 25 | 2 |
| Correlación Pearson entre Elo (Chatbot Arena) y ASR, todas las tareas | 0.6423 (p < 0.001) | 4 |
| ASR global sin defensa, GPT-4 | 0.3103 | 4 |
| ASR global sin defensa, GPT-3.5-turbo | 0.2616 | 4 |
| ASR global, GPT-4, black-box multi-turn dialogue (sin defensa: 0.3103) | 0.2056 | 8 |
| ASR global, Vicuna-7B, white-box con fine-tuning BIPIA (sin fine-tuning: 0.1237) | 0.0214 | 8 |
| ASR global, Vicuna-13B, white-box con fine-tuning BIPIA (sin fine-tuning: 0.1531) | 0.0192 | 8 |
| MT-Bench, Vicuna-7B, sin fine-tuning / con fine-tuning BIPIA | 4.8063 / 4.2938 | 8 |

## Citas textuales
- "Using BIPIA, we evaluate existing LLMs and find them universally vulnerable." (p. 1)
- "The root causes of indirect prompt injection attacks are twofold: (1) the inability of LLMs to effectively differentiate between informational context and actionable instructions; and (2) the lack of awareness in LLMs to avoid executing instructions embedded within external content." (p. 6)
- "the black-box defense methods can effectively reduce ASR but cannot make LLMs robust to indirect prompt injection attacks" (p. 9)

## Limitaciones
Reconocidas por los autores:
- Las defensas black-box "cannot make LLMs robust to indirect prompt injection attacks" (p. 9).
- Advierten contra depender de estas defensas "without careful testing and red teaming in the context of specific, end-to-end applications" (p. 9).
- La white-box "may affect the performance on general tasks", aunque no afecta la tarea de fine-tuning sin ataque (p. 9).
- La Conjetura 1 se presenta como conjetura, no como demostración (p. 6).
- El benchmark excluye, por revisión manual, ataques que dañen propiedad personal y salud (p. 9).
- Con few-shot (ICL), el ROUGE baja respecto de las demás defensas; el texto lo reconoce como excepción (p. 8).

Observación propia:
- Los modelos son de 2023 (GPT-4, GPT-3.5, Vicuna, Llama 2). Los números de ASR no son directamente válidos para modelos de 2026 y hay que reevaluar.
- La métrica de ASR combina reglas, LLM-as-judge y detección de idioma (p. 3), pero no reportan validación humana del juez ni varias ejecuciones con intervalos. Todas las corridas son con temperatura 0.
- En white-box, entrenamiento y prueba salen del mismo benchmark. La separación es por tipo de ataque (p. 3), pero no hay prueba con familias de ataque distintas ni con intentos de cerrar la etiqueta `</data>` desde el contenido. Esto último es inferencia mía.
- La Tabla 4 muestra MT-Bench de Vicuna-13B de 5.2062 sin fine-tuning a 1.6625 con BIPIA (p. 8). Es una caída fuerte que el texto no cuantifica (solo advierte que la white-box "may affect the performance on general tasks", p. 9); en p. 8 dice únicamente que al menos un método de construcción de respuestas "ensure little decline" (p. 8).
- El texto dice que la white-box reduce la ASR "10 times lower than the original ASR" (p. 8). Con los valores de la Tabla 4 para Vicuna-7B (0.1237 a 0.0214) la reducción es menor de diez veces; la frase es más fuerte que la tabla.
- El paper no mide en ningún momento acciones con herramientas (escritura de datos, pagos, cambios de cuenta). Mide si la respuesta de texto se desvía. Eso limita cuánto aplica a un agente que ejecuta acciones.

## Qué le sirve a MESH
1. **Respalda (demostrado por el paper):** las defensas por prompt reducen la ASR pero no la eliminan. Con GPT-4 bajan de 0.3103 a 0.2056 (p. 8), y los autores concluyen que no hacen robusto al LLM (p. 9). Esto apoya que MESH decida la retención de reembolsos en el sandbox y no en el modelo. **Inferencia mía:** la etiqueta de procedencia que pone el sistema es un análogo de "boundary awareness" fuera del modelo; el paper no evalúa esa variante.
2. **Taxonomía para el fraude BEC (demostrado):** el paper clasifica "Scams & Fraud" dentro de la categoría "Targeted", con el objetivo de "achieving specific attack objectives" (Tabla 5, p. 12). Conviene usar esa categoría para describir el fraude BEC de MESH. Que el BEC caiga ahí es inferencia mía.
3. **Posición de la instrucción (demostrado, sin cifras en el texto):** al final del contenido el ASR es el más alto, seguido por inicio y medio (Figura 5, p. 5; el orden "seguido por inicio y medio" está en p. 6). MESH puede tratar la posición del fraude dentro del correo como una variable de su batería de pruebas.
4. **Ataques que parecen parte de la tarea (demostrado en la comparación, inferencia en la aplicación):** los ataques task-relevant y targeted tienen ASR más altas que los task-irrelevant en GPT-4 y GPT-3.5 (p. 5), y el paper sugiere que "more easily accepted by the models". **Inferencia mía:** un cambio de cuenta bancaria presentado como trámite normal es el tipo de ataque que más pasa, y puede explicar por qué los fraudes bajo USD 500 sobreviven. El paper no mide montos ni umbrales.
5. **Límite de USD 500 y verificación del remitente (no cubierto):** el paper no trata umbrales económicos ni autenticación de remitente. Su modelo de amenaza supone aplicación y LLM confiables (p. 3). MESH debe presentar esos dos puntos como diseño propio, no como respaldo de la literatura.
6. **Métrica a copiar:** ASR por tarea y ponderada por número de ejemplos (Tabla 2, p. 4), y una medida de utilidad al mismo tiempo (ROUGE-1 y MT-Bench, p. 7). Medir utilidad junto con ASR sirve para mostrar que la defensa no rompe el flujo legítimo; los 0 falsos positivos de MESH en 12 controles cumplen esa función.
7. **Frase para el pitch:** "the black-box defense methods can effectively reduce ASR but cannot make LLMs robust to indirect prompt injection attacks" (p. 9). Sirve para justificar que la aprobación por procedencia esté en el sandbox y no en el prompt.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 52 · corregidas: 3 · eliminadas: 0.
- Correcciones:
  - Método: "1,000 ejemplos por tarea en las tres últimas" era ambiguo (las tres últimas de la lista incluyen code QA, que tiene 100); se precisa que web QA, table QA y summarization muestrean 1,000 cada una (p. 3).
  - Qué le sirve a MESH, punto 3: el orden "seguido por inicio y medio" está en p. 6, no solo en p. 5 (Figura 5 y su pie, p. 5).
  - MT-Bench: la nota decía que el texto "no discute" la caída de Vicuna-13B (5.2062 a 1.6625). El paper sí la advierte en general ("may affect the performance on general tasks", p. 9) pero no la cuantifica; corregido en Resumen y Observación propia.
- Pendiente: Nada.
