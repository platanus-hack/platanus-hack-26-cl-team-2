# Formalizing and Benchmarking Prompt Injection Attacks and Defenses
- **Autores:** Yupei Liu, Yuqi Jia, Runpeng Geng, Jinyuan Jia, Neil Zhenqiang Gong · **Año:** 2023 · **Enlace:** https://arxiv.org/abs/2310.12815 · **Tema:** inyección de prompts (indirecta) en aplicaciones integradas con LLM: marco formal, ataques, defensas y benchmark
- **Cobertura de lectura:** páginas 1–27, completo (cuerpo, tablas, apéndices A y B y referencias, leídos desde el texto extraído). No se leyeron las figuras como imagen, solo su texto; no fue necesario consultar el PDF.

## Resumen
Las aplicaciones integradas con LLM procesan datos externos (currículums, publicaciones, páginas web), y un atacante puede escribir instrucciones dentro de esos datos. Hasta ahora la literatura se limitaba a estudios de caso y blogs, sin un marco formal ni una evaluación comparable. Los autores formalizan el ataque como una función A(x_t, s_e, x_e) que reescribe el dato de la tarea objetivo para que el LLM ejecute una tarea inyectada elegida por el atacante (p. 4). Con ese marco, los ataques conocidos (Naive, Escape Characters, Context Ignoring, Fake Completion) son casos particulares, y proponen un ataque nuevo, Combined Attack, que combina tres de ellos. Evalúan 5 ataques y 10 defensas con 10 LLM y 7 tareas (49 combinaciones objetivo × inyectada) y publican la plataforma. Encuentran que los ataques son efectivos en general, que Combined Attack es el más eficaz en promedio y que los LLM más grandes son más vulnerables (correlación de Pearson positiva con el tamaño del modelo). Las defensas de prevención bajan el éxito del ataque en algunos casos, pero a costa de la utilidad de la tarea objetivo sin ataque, y ninguna defensa de detección les parece suficiente. Concluyen que falta un mecanismo para recuperar datos limpios después de detectar un ataque.

## Método
- **Modelo de amenaza (p. 3):** el atacante controla el dato que consume la aplicación (por ejemplo, el texto de su currículum), no el prompt de instrucción. No conoce los detalles internos de la aplicación (p. 3) y los ataques evaluados no requieren acceso de caja negra para armar el dato (p. 13). Se asume que el backend LLM mantiene su integridad (p. 3).
- **Definición (p. 4):** dado un objetivo t (instrucción s_t, dato x_t) y una tarea inyectada e (instrucción s_e, dato x_e), el atacante produce x̃ = A(x_t, s_e, x_e), y la aplicación consulta f(s_t ⊕ x̃).
- **Ataques (pp. 4–5):** Naive (x_t ⊕ s_e ⊕ x_e); Escape Characters (agrega “\n”); Context Ignoring (agrega “Ignore my previous instructions.”); Fake Completion (agrega una respuesta falsa “Answer: task complete”); Combined Attack (x_t ⊕ c ⊕ r ⊕ c ⊕ i ⊕ s_e ⊕ x_e, que combina los tres anteriores).
- **Defensas (pp. 5–6):** de prevención: paraphrasing, retokenization (BPE-dropout), delimitadores (comillas triples, etiquetas XML, secuencias aleatorias), sandwich prevention e instructional prevention. De detección: PPL, windowed PPL, detección naive con LLM, detección por respuesta y known-answer detection. El umbral de PPL se fija con 100 registros limpios para que la FPR sea como máximo 1% (pp. 6 y 12).
- **LLM (p. 7):** PaLM 2 text-bison-001, Flan-UL2, Vicuna-33b-v1.3, Vicuna-13b-v1.3, GPT-3.5-Turbo, GPT-4 (predeterminado), Llama-2-13b-chat, Llama-2-7b-chat, Bard e InternLM-Chat-7B. Temperatura 0.1 en los cerrados y semilla fija en los abiertos.
- **Datos (p. 7):** 7 tareas con un dataset cada una: duplicate sentence detection (MRPC), grammar correction (Jfleg), hate detection (HSOL), natural language inference (RTE), sentiment analysis (SST2), spam detection (SMS Spam) y summarization (Gigaword). Se muestrean 100 ejemplos por dataset. Cada tarea sirve como objetivo e inyectada, para 49 combinaciones. Si ambas son de la misma clase, se eligen etiquetas distintas.
- **Métricas (pp. 7–8):** PNA (rendimiento sin ataque), ASV (la respuesta del LLM cumple la tarea inyectada) y MR (la respuesta bajo ataque coincide con la de la instrucción inyectada sola). Para las defensas de detección, FPR y FNR. ASV y MR usan 100 pares muestreados de 10,000 posibles (p. 8).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| ASV de Naive Attack, GPT-4, promedio de las 7 × 7 combinaciones (Tabla 4) | 0.62 | 9 |
| ASV de Combined Attack, GPT-4, promedio de las 7 × 7 combinaciones (Tabla 4) | 0.75 | 9 |
| ASV de Combined Attack, promedio de 10 LLM y 7 × 7 combinaciones | 0.62 | 9 |
| MR de Combined Attack, promedio de 10 LLM y 7 × 7 combinaciones | 0.78 | 9 |
| Correlación de Pearson entre ASV promedio de Combined Attack y tamaño del modelo | 0.63 | 9 |
| ASV de Combined Attack, PaLM 2, promedio de 7 × 7 combinaciones (Tabla 10) | 0.71 | 16 |
| ASV de Combined Attack con objetivo duplicate sentence detection, GPT-4, sin defensa (Tabla 7a) | 0.76 | 11 |
| Igual, con paraphrasing (Tabla 7a) | 0.06 | 11 |
| PNA-T de summarization con sandwich prevention, GPT-4, sin defensa | 0.38 | 10 |
| PNA-T de summarization con sandwich prevention, GPT-4, con defensa | 0.24 | 10 |
| Combinaciones objetivo × inyectada | 49 | 7 |
| FPR máxima para fijar el umbral de PPL | 1% | 12 |

## Citas textuales
- "Combined Attack is consistently effective for different LLMs, target tasks, and injected tasks" (p. 9).
- "We observe that no existing detection-based defenses are sufficient." (p. 12).
- "Detection alone is insufficient since eventually it still leads to denial-of-service." (p. 13).

## Limitaciones
Reconocidas por los autores:
- Los ataques existentes se limitan a heurísticas; no hay ataques basados en optimización (p. 13).
- La evaluación de known-answer detection se limita a un único prompt de detección, y no se evaluaron ataques adaptativos contra ella (p. 13).
- No proponen ni evalúan un mecanismo para recuperar datos limpios; la detección sola deja a la aplicación sin poder cumplir la tarea objetivo (p. 13).
- Las defensas concurrentes (por ejemplo, Jatmo) no se evaluaron en el benchmark (p. 13).
- El escenario de ataque considera a un usuario que no tiene acceso de caja negra al sistema; los ataques que requieren consultas repetidas quedan fuera (p. 13).
- Para ASV y MR se muestrean 100 pares de 10,000 por el costo de cómputo (p. 8). Las tareas del mismo tipo son difíciles de evaluar y por eso se eligieron etiquetas distintas (p. 7).
- Usaron Llama-2-13b-chat para calcular la perplejidad, porque GPT-4 no permite ese cálculo (p. 11).
- Las defensas de prevención bajan la utilidad de la tarea objetivo sin ataque. Por ejemplo, sandwich prevention baja la PNA-T de summarization de 0.38 a 0.24 (p. 10). El paraphrasing la baja en promedio 0.14 (p. 10).

Observación propia:
- El benchmark es de un solo turno y el éxito se mide sobre el texto de salida. No hay herramientas, llamadas a APIs, varios agentes ni efectos reales. ASV mide si la respuesta coincide con la etiqueta de la tarea inyectada, no si se ejecutó una acción. Un reembolso o un cambio de cuenta bancaria no están evaluados.
- Los modelos son de 2023 (GPT-3.5, Vicuna, Llama-2). No hay evidencia directa sobre modelos actuales con uso de herramientas.
- Los promedios de 49 combinaciones con 100 muestras cada una ocultan mucha variación entre combinaciones (las tablas 12–20 la muestran para cada LLM).
- Las defensas y sus umbrales se calibran con datos de la misma distribución que los de prueba. En producción, la distribución cambia.

## Qué le sirve a MESH
1. **Respalda la premisa (demostrado, p. 9):** el Combined Attack es consistentemente efectivo en 10 LLM, 7 tareas objetivo y 7 tareas inyectadas. Inferencia mía: si el modelo no separa dato de instrucción, la defensa no puede depender de él, lo que apoya que la etiqueta de procedencia y la retención las ponga el sandbox y no el prompt.
2. **Limita la detección (demostrado, pp. 12–13):** ninguna defensa de detección es suficiente. Inferencia mía: la aprobación humana por procedencia de MESH es un control de contención, no de detección, y el paper no lo evalúa. Esto justifica no apoyarse solo en detectar el correo malicioso.
3. **Métricas para copiar (demostrado, p. 8):** ASV (éxito del ataque) y MR (comparación con la respuesta a la instrucción inyectada sola). Inferencia mía: en MESH, ASV sería "se emitió el reembolso" y MR sería "se emitió igual que si el atacante hubiera pedido el reembolso directamente", lo que separa el efecto de la inyección del de la capacidad del modelo.
4. **Límite de USD 500 (no evaluado en el paper):** el paper no tiene montos. Solo muestra que el ataque pierde efectividad con cargas inyectadas cortas (p. 25). Inferencia mía: un atacante que conoce el límite puede fraccionar fraudes por debajo de USD 500. Es un riesgo a probar en MESH, no un hallazgo de la literatura.
5. **Verificación del remitente (no evaluada en el paper):** su modelo de amenaza pone al atacante en el contenido que consume el sistema (p. 3), no en la identidad del remitente. Inferencia mía: la verificación del remitente cubre otro vector y no reemplaza la etiqueta de procedencia. Es coherente con que en MESH no haya cambiado nada (8/12 con y sin ella en Haiku).
6. **Contraste con nuestro dato (inferencia, con cautela):** en MESH, sin defensa, Haiku 4.5 cometió más fraudes (17/21) que Sonnet 4.6 (8/21). El paper reporta lo contrario con su correlación de tamaño y ASV (p. 9). No es una contradicción firme: Anthropic no publica el número de parámetros, la tarea es otra, n es chico y el paper no mide reembolsos.
7. **Frases para el pitch (citas del paper):** "Detection alone is insufficient since eventually it still leads to denial-of-service." (p. 13), para justificar la retención por procedencia frente a solo detectar. "Combined Attack is consistently effective for different LLMs, target tasks, and injected tasks" (p. 9), como referencia de que el ataque es robusto entre modelos, no como dato propio de MESH.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 45 · corregidas: 2 · eliminadas: 0.
- Correcciones:
  - Modelo de amenaza: "no requiere acceso de caja negra" se atribuía a p. 3; la afirmación está en p. 13 (la de no conocer detalles internos sí está en p. 3). Se separaron las páginas.
  - "Qué le sirve" 1: la nota decía que la "inyección indirecta" funciona de forma consistente; el paper afirma eso solo del Combined Attack (p. 9). Se acotó a ese ataque.
- Pendiente: el año 2023 y el identificador arXiv 2310.12815 no aparecen en el texto extraído del PDF; coinciden con la fila de papers.md, pero no se confirmaron contra el PDF. Las cifras de MESH (17/21, 8/21, 8/12, USD 500, etc.) no se verificaron, como se pidió. Las tablas 4 y 7 se leyeron en el texto extraído, sin necesidad de imagen del PDF.
