# Evaluating Large Language Models’ Capability to Launch Fully Automated Spear Phishing Campaigns: Validated on Human Subjects
- **Autores:** Fred Heiding, Simon Lermen, Andrew Kao, Bruce Schneier, Arun Vishwanath · **Año:** 2024 (arXiv:2412.00586, 30 nov 2024) · **Enlace:** https://arxiv.org/abs/2412.00586 · **Tema:** spear phishing totalmente automatizado con LLM, experimento con 101 personas reales y detección de phishing por LLM
- **Cobertura de lectura:** páginas 1–18, completo (las 1427 líneas del texto extraído, incluidos apéndices y referencias). No se abrió el PDF: las Tablas 3 y 4 salen legibles en el texto. Las figuras 5, 7, 8, 9 y 10–12 se leyeron solo por sus etiquetas de texto, no como imagen.

## Resumen
Los autores preguntan si un LLM puede hacer spear phishing de principio a fin sin intervención humana. Su herramienta hace reconocimiento OSINT sobre cada objetivo, arma un perfil, redacta un correo personalizado, lo envía y registra los clics. Comparan cuatro tipos de correo enviados a 101 participantes universitarios: control (spam), expertos humanos, IA totalmente automatizada e IA con intervención humana. Los correos de IA rinden igual que los de expertos: 54%, 54% y 56% de clics frente a 12% del control (p. 8). El reconocimiento encontró información correcta y útil en 88% de los casos (p. 9). En una segunda parte, usan LLM como detectores: Claude 3.5 Sonnet, al que se le pide la sospecha como porcentaje, detecta 97.25% de 363 correos de phishing sin falsos positivos (p. 10). El paper cierra con un modelo económico que sitúa el phishing con IA hasta 50 veces más rentable (p. 1) y con la IA siempre más rentable que no usarla, según sus supuestos (p. 12).

## Método
- **Herramienta:** agente de OSINT con GPT-4o y búsqueda web (API de Google y navegador de texto). Se detiene tras 2 a 5 fuentes, compila un perfil, redacta con una plantilla de más de 2.000 caracteres (no publicada por seguridad) y envía en lotes de 10 entre 10:30 y 14:00 (pp. 4, 7). Modelos de redacción: GPT-4o y Claude 3.5 Sonnet. Llama 3.1 y o1-preview se probaron, pero no para enviar correos (p. 3). El lote sintético de 250 correos (50 por modelo) usó además o1-preview, GPT-3.5 y Llama 3.1 405B (p. 8).
- **Experimento real:** 101 participantes reclutados por afiches y listas de correo universitarias, con US$5 de tarjeta o donación (p. 3). Se asignan al azar a cuatro grupos de un cuarto cada uno (p. 5). La inscripción no decía que recibirían phishing ni que se rastrearían clics (p. 4). Potencia: alfa 0.05, potencia 0.80, tamaño requerido de 100 a 125; usaron 101 (p. 3).
- **Grupos:** control, con spam de los buzones de los autores, ajustado hasta pasar filtros (p. 5). Expertos, con un correo de 100–150 palabras de un proyecto interdisciplinario, semipersonalizado, el mismo para 25 personas (p. 5). IA automatizada, con Claude 3.5 Sonnet y perfiles hiperpersonalizados (p. 5). IA con humano, donde un humano podía corregir el OSINT o el texto (p. 6).
- **Métrica:** clic en un enlace con URL única por persona, con registro de la hora. Después, respuesta libre sobre por qué clicaron o no (pp. 3, 7, 9).
- **Detección:** cinco LLM (GPT-4o, Claude 3.5 Sonnet, Mistral Large, Gemini, Llama 3.1 405B) sobre 20 correos, con preguntas de intención y de sospecha en escala 1–10 (p. 7). Después, 381 correos (18 legítimos y 363 de phishing, en nueve categorías), con sospecha expresada como porcentaje (pp. 7–8). Métricas: tasa de detección y falsos positivos sobre correos legítimos (pp. 8, 10).
- **Economía:** rentabilidad por hora según técnica. Costo fijo de US$0.01 por correo (dominios) y de US$0.04 por correo con IA (US$0.05 de costo fijo total para IA en la Tabla 4, p. 12). Pago de US$136 por phishing exitoso (estimado de industria). Conversión q de 0.6%, 2.35% y 7.9%. Salarios de referencia de US$34.55 (EE. UU.) y US$5.47 (Rusia). Desarrollo de la herramienta: 260 horas a US$62/h (pp. 11–12).
- **Modelo de amenaza:** no hay un modelo de amenaza formal; sí hay un modelo económico estilizado (sección 6, p. 11). El atacante usa LLM comerciales sin fine-tuning (p. 3). Los guardrails se evitan con reformulación ("email" en lugar de "phishing email") y reintentos (pp. 3, 7).
- **Ética:** IRB de la universidad del autor principal, debriefing completo y pago a todos los participantes (pp. 4, 15–16).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Participantes del experimento real | 101 | 3 |
| Tasa de clic, grupo control (spam) | 12% | 8 |
| Tasa de clic, expertos humanos | 54% | 8 |
| Tasa de clic, IA totalmente automatizada (Claude 3.5 Sonnet) | 54% | 8 |
| Tasa de clic, IA con intervención humana | 56% | 8 |
| OSINT correcto y suficiente (nivel 3), proporción de casos | 88% | 9 |
| OSINT de persona equivocada (nivel 1), proporción de casos | 4% | 9 |
| Claude 3.5 Sonnet, detección de phishing al pedir sospecha (363 correos) | 97.25% con no false positives | 10 |
| Costo de la IA por correo (API) | roughly four cents per email | 10 |
| Costo fijo de envío por correo (dominios) | roughly one cent per email | 11 |
| Tiempo manual por objetivo: OSINT / redacción | 23:27 min / 10:10 min | 10 |
| Rentabilidad del phishing con IA frente al phishing tradicional | up to 50 times | 1 |

## Citas textuales
- "the only difference between a high-quality phishing email and a legitimate one is the sender’s intentions." (p. 7)
- "The fully AI-automated process (no human-in-the-loop) removes all manual time overhead." (p. 10)
- "Current safety guardrails fail to reliably prevent models from conducting reconnaissance or generating phishing emails." (p. 13)

## Limitaciones
Reconocidas por los autores:
- Muestra pequeña para extrapolar: "we hope to scale up studies on human participants by multiple orders of magnitude" (p. 13). Sobre los correos de expertos, dicen que son "unlikely to produce good results for larger and more diverse audiences" (p. 8).
- Solo 60 de 101 personas tuvieron actividad. Los autores sugieren que algunos no revisan su correo, lo que haría las tasas reales más altas (p. 9).
- Rentabilidad probablemente sobreestimada: "our estimates of phishing profitability are likely an overestimate" (p. 12). Los beneficios grandes "may only hold in the short run" (nota 12, p. 12). Los supuestos de calibración son fuertes (nota 8, p. 11).
- Contaminación posible: algunos correos de phishing podrían estar en el pretraining de los LLM y sesgar resultados (p. 8). Los datos de NIST podrían estar en el entrenamiento de los modelos (p. 16, A.3).
- Detección débil en algunos casos: Claude alcanzó solo 81% de verdaderos positivos en algunos correos de phishing convencionales (p. 10). Mistral tuvo muchos falsos positivos cuando se le pidió sospecha (p. 10).
- Error de implementación: en 11 de 24 correos de expertos el enlace abarcó 25 palabras de más (p. 17, A.5).

Observación propia:
- Mide clic, no compromiso. No mide ingreso de credenciales ni explotación posterior. Los autores lo dejan como trabajo futuro (p. 13).
- Grupos de unas 25 personas. Las tasas de clic se reportan sin intervalos de confianza. La Tabla 4 da errores estándar de 11.8 a 12.2 puntos para los grupos experto, IA e híbrido (p. 12), mucho mayores que las diferencias entre 53.8%, 54.2% y 56.0%. La paridad con expertos es una afirmación de los autores, no una prueba de equivalencia.
- La Tabla 3 la califican los propios autores "in hindsight", preguntándose si habrían cambiado algo (p. 6). Es una evaluación subjetiva y no ciega.
- Dos roles en la misma persona: los autores diseñaron el atacante y también midieron la detección. No hay un evaluador externo.
- Modelos de 2024 (Claude 3.5 Sonnet, GPT-4o). La proyección a 2025 es una regresión lineal (p. 18). Las cifras no son directamente extrapolables a Haiku 4.5 o Sonnet 4.6.
- No prueba defensas a nivel de acción ni sistemas multiagente. Su defensa es un LLM que lee el correo.
- Engaño a los participantes, aprobado por IRB (p. 15). El paper dice que el engaño "was deemed necessary" (p. 4) y no usa la palabra consentimiento; inferencia nuestra: fue un engaño sin consentimiento informado. Si MESH cita el diseño, conviene mencionar esto.

## Qué le sirve a MESH
1. **Lo que afirma (p. 7):** el texto del correo no separa phishing de legítimo; lo que los separa es la intención del remitente. Respalda la tesis de MESH de decidir por procedencia y ruta, no por el contenido. Inferencia nuestra: por eso approval_gate usa el origen externo y el monto, no el texto del correo.
2. **Lo que reporta (pp. 9–10):** "The Sender was the most frequent suspicion indicator". El remitente es la señal que más usan las personas y Claude ("concerns about the sender address", p. 10). Pero los autores suplantaron el remitente con un dominio propio (p. 9). Inferencia nuestra: la verificación del remitente es una señal útil pero falsificable. Coincide con que en MESH, sola, no cambió nada (8/12 con y sin ella en Haiku). Conviene presentarla como una capa, no como defensa suficiente.
3. **Lo que reporta (pp. 10–12):** la IA cuesta unos cuatro centavos por correo y el dominio un centavo (pp. 10–11). El paper dice que, en grupos de unas 5.000 personas, el phishing con IA supera al de expertos humanos sea cual sea q; frente a un trabajo regular, el punto de equilibrio es de 2.859 (q alta), 10.213 (q media) y 54.123 (q baja) personas (p. 12). Inferencia nuestra: un atacante puede repartir fraudes pequeños en volumen, así que el límite de USD 500 deja un flanco. Los 6/21 y 3/21 que siguen pasando bajo el límite encajan con esa lógica. El pago de US$136 es un supuesto de industria, no un dato medido (p. 11, nota 8).
4. **Diseño para copiar (pp. 3, 5, 8):** asignación aleatoria a varios brazos (control spam, humano, IA, IA con humano), un enlace único por persona y conteos por brazo. MESH puede copiar esa estructura, con n explícito en cada brazo (4/12, 7/12, 12/12) y con error estándar, que el paper sí reporta en la Tabla 4 pero no en las tasas de clic. Inferencia nuestra.
5. **Lo que matiza a MESH (pp. 2, 10):** un LLM al que se le pide sospecha detecta 97.25% de los phishing de su dataset sin falsos positivos. Eso desafía la idea de que la defensa por contenido no sirve. Conviene decir que la detección por contenido es una capa útil, pero que no cubre el caso de phishing convencional (81%, p. 10) ni la ruta completa hasta la herramienta de riesgo.
6. **Frase para el pitch (p. 7):** "the only difference between a high-quality phishing email and a legitimate one is the sender’s intentions." Sirve para justificar la etiqueta de procedencia y la aprobación por procedencia. Complementa con la cita de p. 13 sobre guardrails. Nota: el paper no prueba defensas de MESH, así que la frase justifica el problema, no la solución.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 60 · corregidas: 9 · eliminadas: 0.
- Correcciones:
  - Método: la asignación al azar va a p. 5 (no p. 3); los US$5 quedan en p. 3.
  - Método: el lote de 250 correos sintéticos (50 por modelo) también incluye o1-preview.
  - Método: el costo fijo total de la IA en la Tabla 4 es US$0.05 (0.01 de dominio + 0.04 de IA), no solo 0.04.
  - Modelo de amenaza: el paper no tiene modelo de amenaza formal, pero sí un modelo económico estilizado (sección 6, p. 11).
  - Método: la reformulación y los reintentos (resampling) aparecen en pp. 3 y 7.
  - Limitaciones: el paper solo dice que los correos del dataset NIST podrían estar en el entrenamiento; no dice lo mismo de Berkeley.
  - Observación: "sin consentimiento informado" es inferencia nuestra; el paper dice que el engaño "was deemed necessary" (p. 4).
  - Qué le sirve (1–3): "demuestra" cambiado a "afirma" (1) y "reporta" (2–3), porque el paper no prueba por separado la premisa de la item 1 ni pone a prueba la item 3.
  - Qué le sirve (3): la cifra de 5.000 personas se refiere a la comparación con el phishing de expertos humanos; el punto de equilibrio frente a un trabajo regular es 2.859 / 10.213 / 54.123 según q (p. 12).
- Pendiente: nada de lo verificable en el texto. Las figuras (5, 7, 8, 9, 10–12) se contrastaron solo con su texto extraído y sus etiquetas, no como imagen. Los valores de "Números clave" se mantienen en inglés, tal como aparecen en el paper.
