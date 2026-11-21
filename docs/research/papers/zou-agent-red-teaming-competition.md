# Security Challenges in AI Agent Deployment: Insights from a Large Scale Public Competition
- **Autores:** Andy Zou, Maxwell Lin, Eliot Jones et al. · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2507.20526 · **Tema:** red-teaming de agentes de IA con herramientas: inyección de prompts directa e indirecta, violaciones de política y transferencia de ataques
- **Cobertura de lectura:** páginas 1–30, completo (cuerpo, referencias, apéndice A con los escenarios y el apéndice B con métodos de juicio y prompt del juez). Se leyó el texto extraído; no se abrió el PDF porque ninguna tabla salió ilegible. Las figuras con gráficos (3–9) se usaron solo por sus leyendas y etiquetas de texto.

## Resumen
El paper pregunta si los agentes de IA con herramientas, memoria y acceso web pueden seguir su política de despliegue en entornos realistas y bajo ataque. Los autores organizaron la mayor competencia pública de red-teaming de agentes hasta la fecha (Gray Swan Arena, 8 de marzo a 6 de abril de 2025, con UK AISI) con 22 LLMs de frontera y 44 escenarios simulados. Los participantes enviaron 1.8 millones de ataques de prompt injection, y más de 60,000 provocaron violaciones de política (acceso no autorizado a datos, acciones financieras ilícitas, incumplimiento regulatorio). Con los ataques exitosos construyeron ART, un benchmark de 4,700 ataques evaluado en 19 modelos. Encuentran que casi todos los agentes violan políticas en la mayoría de los comportamientos con 10 a 100 consultas, que los ataques transfieren entre modelos y tareas, y que la robustez casi no se explica por tamaño, capacidad ni cómputo de inferencia. Las inyecciones indirectas (en contenido externo) tienen tasas de éxito bastante mayores que las directas. No prueban ninguna defensa; concluyen que se necesitan defensas adicionales.

## Método
- **Competencia:** AI Agent Red Teaming Challenge, 8 de marzo a 6 de abril de 2025, en Gray Swan Arena (p. 3). Cerca de 2,000 participantes y 1,800,000 intentos (p. 4). Premios por US$171,800 (p. 4).
- **Escenarios:** 44 escenarios curados, cada uno con agente definido, system prompt, herramientas simuladas, objetivo adversarial y criterio de éxito. Cuatro familias de comportamiento: confidencialidad, objetivos conflictivos, contenido prohibido y acciones prohibidas (p. 3). Ejemplos completos en el apéndice A (pp. 14–26), por ejemplo un agente de salud que no debe revelar historiales de otros pacientes, o un agente de reclutamiento que debe dar puntaje 8 o más.
- **Modelos:** 22 LLMs de OpenAI, Google DeepMind, Anthropic, Amazon, xAI, Meta, Cohere y Mistral, algunos pre-lanzamiento (p. 3). Para ART se usan 19 modelos, incluidos Gemini 2.5 Pro y o4-mini, que no estuvieron en la competencia (p. 5).
- **Vectores de ataque:** chat directo e inyección indirecta, esto es, instrucciones ocultas en datos no confiables como logs, páginas o respuestas de herramientas (p. 4).
- **Modelo de amenaza:** un usuario adversario que controla el input directo o el contenido que el agente lee con sus herramientas. El objetivo es que el agente viole su política de despliegue. El agente tiene tool calling y la ejecución es en sandbox (pp. 2–4).
- **Métricas:** ASR = sesiones con violación / total de sesiones de usuario por modelo (p. 4). También ASR por comportamiento a k = 1, 10 y 100 consultas (p. 5, Figura 4).
- **ART:** se filtran los ataques con un juez LLM más estricto y se toman hasta 5 por par comportamiento-modelo, para un total de 4,700 ataques sobre 44 comportamientos (p. 5).
- **Transferencia y universalidad:** ataques de un modelo fuente aplicados a otros (matriz, pp. 5–6). Para universalidad, embeddings con all-mpnet-base-v2, 100 vecinos con FAISS y similitud coseno > 0.9 entre prompts de comportamientos distintos. Un cluster es universal si cubre al menos 5 comportamientos y 2 modelos (pp. 6–7).
- **Factores:** correlación entre ASR y GPQA (Figura 6, p. 7), fecha de lanzamiento (Figura 9, p. 28) y cómputo de inferencia (pp. 7–8).
- **Jueces:** programáticos (TypeScript) o LLM (tres LLMs, voto mayoritario), más apelaciones con un modelo de razonamiento y luego revisión humana de UK AISI. En la evaluación del paper el juez fue o4-mini, con temperatura 0 cuando el parámetro existe. Para OpenAI se usó la API directa y para los demás, OpenRouter (pp. 27–28).
- **Costo:** los experimentos de transferencia costaron del orden de US$1000 (p. 27).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Ataques de prompt injection enviados (resumen) | 1.8 million prompt-injection attacks | 1 |
| Violaciones de política exitosas (resumen) | over 60,000 | 1 |
| Elicitaciones exitosas (§2.2) | over 62,000 successful elicitations | 4 |
| Agentes objetivo (resumen) | 22 frontier AI agents | 1 |
| Escenarios de despliegue (resumen) | 44 realistic deployment scenarios | 1 |
| Modelos evaluados en ART (resumen) | 19 state-of-the-art models | 1 |
| Ataques seleccionados en ART | 4,700 selected attacks across 44 target behaviors | 5 |
| ASR global, todas las categorías (Tabla 1) | All 12.7 | 4 |
| ASR directa / indirecta (Tabla 1) | Direct 5.7 / Indirect 27.1 | 4 |
| ASR indirecta, categoría Prohibited Action (Tabla 1) | 36.8 | 4 |
| ASR por comportamiento con una sola consulta (Figura 4) | "20% to 60% of behaviors" | 5 |
| ASR de un ataque de un turno (Attacker 4), Gemini 1.5 Flash (§3.2) | 58% | 7 |
| Correlación entre ASR y capacidad, GPQA (Figura 6) | Correlation = -0.31 | 7 |

## Citas textuales
- "Nearly all agents exhibit policy violations for most behaviors within 10–100 queries, with high attack transferability across models and tasks." (p. 1)
- "Our analysis reveals that reliability and security do not necessarily increase with model capability, as illustrated in Figure 6." (p. 7)
- "Alarmingly, rather than merely exploiting rare edge cases, we consistently observe near-100% attack success rates across diverse models and deployment scenarios." (p. 9)

## Limitaciones
Reconocidas por los autores:
- Falsos positivos de "specification gaming": submissions que pasan los jueces automáticos sin cumplir el criterio, como repetir "week-end" 100 veces para simular francés, o codificar contenido prohibido en hexadecimal u otro idioma, que los jueces no detectan (pp. 28–29).
- Algunos falsos positivos vienen de casos borde no previstos en los criterios de éxito. Recomiendan más pruebas previas y ejemplos few-shot, y jueces más robustos, por ejemplo modelos de razonamiento (p. 29).
- o3 se introdujo tarde en la competencia y su ASR puede estar inflado (p. 4).
- La evidencia sobre cómputo de inferencia y robustez es "inconclusive" (p. 7).

Observación propia:
- Discrepancia interna: el resumen dice "over 60,000" (p. 1) y la sección 2.2 dice "over 62,000" (p. 4). No se aclara cuál es la cifra final.
- Sesgo de selección: el ASR se calcula sobre sesiones de participantes que buscaban romper al agente, y la transferencia usa solo submissions que ya fueron exitosas (p. 27). Esto sobreestima la tasa de éxito que tendría un atacante cualquiera.
- Escenarios simulados (p. 3), con herramientas falsas y sin despliegue real. No mide impacto en producción.
- No evalúa ninguna defensa, aunque concluye que se necesitan defensas (p. 9). Sus datos no permiten decir qué defensa funciona.
- Reproducibilidad parcial: el paper dice que se publicarán los casos de prueba (p. 2), pero luego que ART será un leaderboard privado (p. 5).
- No encontré en el texto una medida de acuerdo entre el juez automático y evaluadores humanos sobre ART.
- Las versiones exactas de modelo y fechas no están en el texto, así que los números dependen del momento de la corrida.

## Qué le sirve a MESH
1. **Demostrado por el paper:** la defensa no puede depender solo del prompt. Casi todos los agentes violan políticas en 10 a 100 consultas (p. 1), y la robustez no sube con la capacidad (p. 7). Esto respalda que la aprobación se haga en el sandbox (approval_gate) y no en el modelo. **Inferencia nuestra:** que el gate baje los fraudes de 17/21 a 6/21 sin cambiar el prompt es coherente con esto, pero el paper no prueba nada sobre MESH.
2. **Demostrado por el paper:** la inyección indirecta es el vector más fuerte: 27.1 frente a 5.7 en directa (Tabla 1, p. 4), y 36.8 en la categoría Prohibited Action indirecta (p. 4). Esto respalda la etiqueta de procedencia: el riesgo viene de contenido externo que el agente lee, no de quien escribe en el chat. **Inferencia nuestra:** el correo externo de MESH es exactamente este vector.
3. **Métrica para copiar:** reportar el ASR por número de consultas (k = 1, 10, 100, Figura 4, p. 5) y por comportamiento, no solo un conteo. Con n = 21 por modelo, MESH debe dar intervalos o repeticiones antes de comparar. **Inferencia nuestra:** la comparación de 17/21 frente a 6/21 no permite afirmar mucho sin más corridas.
4. **Límite de USD 500:** el paper no tiene nada equivalente. No respalda ni contradice el umbral. **Inferencia nuestra:** un umbral en monto es una regla que el sandbox controla, lo que es coherente con approval_gate. Que los fraudes bajo USD 500 sigan pasando es algo que el paper no muestra; es nuestra hipótesis, y conviene presentarla como límite del diseño.
5. **Verificación del remitente:** el paper no prueba verificación de remitente. Sus ataques están en el contenido: respuestas de herramientas, resúmenes de currículum, logs (pp. 21–26). **Inferencia nuestra:** la verificación del remitente cubre un vector que este paper no mide, y no debe presentarse como defensa contra inyección en el cuerpo de un correo legítimo. Esto coincide con que en MESH cambió poco (8/12 con y sin ella en Haiku).
6. **Rutas multiagente:** el paper solo cita la propagación de instrucciones entre agentes como trabajo previo (p. 9) y no prueba rutas de varios agentes. **Inferencia nuestra:** los resultados de la advertencia que llega a finanzas (4/12, 7/12 y 12/12 en MESH) no tienen respaldo directo en este paper, así que hay que presentarlos como resultados propios.
7. **Frase para el pitch:** usar la cita de la página 1 y decir en español: "casi todos los agentes violan su política de despliegue en la mayoría de los comportamientos con 10 a 100 consultas (p. 1)".
