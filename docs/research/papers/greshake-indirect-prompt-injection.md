# Not what you’ve signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection
- **Autores:** Kai Greshake, Sahar Abdelnabi, Shailesh Mishra, Christoph Endres, Thorsten Holz, Mario Fritz · **Año:** 2023 · **Enlace:** https://arxiv.org/abs/2302.12173 · **Tema:** inyección de prompts indirecta (IPI) en LLM integrados en aplicaciones
- **Cobertura de lectura:** páginas 1–33, completo (1610 líneas del .txt, incluidos el apéndice de prompts y la bibliografía). No se abrió el PDF: las figuras se leyeron solo por su texto y sus leyendas. Las 82 referencias se revisaron como lista, no se verificaron una por una.

## Resumen
Los LLM ya se integran en buscadores, asistentes de correo, extensiones de navegador y herramientas de código, y procesan contenido recuperado de fuentes que no controla el usuario ni el desarrollador. Los autores proponen la inyección de prompts indirecta: el atacante coloca instrucciones en una página, un correo, un comentario de código o una memoria que la aplicación recupera en tiempo de inferencia, sin hablar nunca con el modelo. Construyen una taxonomía de amenazas inspirada en la seguridad informática (fraude, intrusión, malware, manipulación de contenido, disponibilidad y recopilación de información) y la ilustran con demostraciones en dos aplicaciones sintéticas (GPT-4 y text-davinci-003, con herramientas simuladas), en Bing Chat y en GitHub Copilot. Encuentran que el modelo sigue las instrucciones inyectadas aunque sean las que el chat filtra cuando se escriben directamente, que puede propagar la inyección entre correos y persistirla en memoria entre sesiones, y que puede convencer al usuario de entregar datos o abrir enlaces. El paper no mide tasas de éxito ni evalúa defensas; la discusión sostiene que es difícil imaginar una solución infalible (p. 12).

## Método
- **Modelo de amenaza:** el atacante no tiene acceso al modelo ni a la interfaz; solo puede dejar texto en fuentes que la aplicación recupera (métodos pasivos: páginas, código, documentos; activos: correos enviados al asistente; ocultos: comentarios HTML, Base64, imágenes). Ver Figura 3 (p. 3) y sección 3.1 (pp. 3–4).
- **Taxonomía:** amenazas de fraude, intrusión, malware, manipulación de contenido, disponibilidad y recopilación de información (sección 3.2, pp. 4–5; Figura 2, p. 3).
- **Aplicaciones sintéticas:** construidas con LangChain sobre text-davinci-003 (con ReAct) y con el formato de chat de GPT-4 (p. 5). Herramientas: búsqueda, vista de la web actual, GET de URL, leer y enviar correo, libreta de direcciones y memoria clave-valor (pp. 5–6). Las herramientas devuelven contenido preparado y el agente “cannot make any requests to real systems or websites” (p. 6).
- **Sistemas reales:** Bing Chat (con panel lateral de Edge, probado con páginas HTML locales) y GitHub Copilot (pp. 6–7).
- **Muestra y métricas:** no hay tamaño de muestra, tasa de éxito ni línea base. Los resultados son demostraciones cualitativas de ejemplos concretos, con temperatura de muestreo 0 (p. 6). Los autores dicen que medir la tasa de éxito “can be challenging” y lo dejan a trabajo futuro (p. 11).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Usuarios de ChatGPT en poco tiempo (contexto, cita [10]) | “over 100 million users” | 1 |
| Versión del preprint citado | “arXiv:2302.12173v2 [cs.CR] 5 May 2023” | 1 |
| Modelos de las aplicaciones sintéticas | “text-davinci-003” y “gpt-4” | 5 |
| Temperatura de muestreo de todos los ataques | “sampling temperature of 0” | 6 |
| Modelo sobre el que corre Bing Chat (según cita [11]) | “GPT-4 model” | 6 |
| Modos de Bing Chat (el paper dice que los ataques “often successfully work with different modes”) | “three chat modes” (“creative”, “balanced”, “precise”) | 6 |
| Monto del cupón en el prompt de fraude (Prompt 4); es parámetro del prompt, no resultado | “200 USD” | 17 |
| Fecha de la sesión de Bing Chat de la Figura 25 | “4th of April, 2023” | 30 |

Nota: el paper no reporta tasas de éxito, tamaños de muestra ni comparaciones numéricas. Los datos de arriba son de configuración o de contexto, no de resultados.

## Citas textuales
- “We show that Indirect Prompt Injection can lead to full compromise of the model at inference time analogous to traditional security principles.” (p. 2)
- “As LLMs themselves are in charge of when and how to issue other API calls and process their outputs, the input and output operations are vulnerable to manipulation and sabotage.” (p. 5)
- “Unfortunately, it is currently hard to imagine a foolproof solution for the adversarial prompting vulnerability” (p. 12)

## Limitaciones
Reconocidas por los autores:
- Sin inyecciones reales en fuentes públicas: “In order to avoid performing actual injections for real-world applications, we tested the attacks on synthetic applications and local HTML files with Bing Chat’s sidebar” (p. 11).
- No pudieron probar Microsoft 365 Copilot ni los plugins de ChatGPT “as we did not have access to them” (p. 11).
- La tasa de éxito es difícil de medir en chats interactivos; queda para trabajo futuro (p. 11).
- No miden engaño ni credibilidad; hacen falta estudios con usuarios (p. 11).
- Modalidad visual: solo tuvieron acceso limitado a modelos multimodales pequeños (citas [58] y [82], LLaVA en la Figura 28) (p. 11, p. 33).
- Reproducibilidad: “exact reproducibility is difficult to guarantee with such a black-box system” (p. 12).
- Las defensas de las aplicaciones reales no se conocen y no pudieron integrarlas en los sistemas sintéticos (p. 12).
- Se enfocan en aplicaciones integradas con LLM “as a first step toward autonomous AI agents”; los agentes multiagente quedan sin estudiar (p. 12).
- El paper no sabe si el filtrado puede ser evadido por ofuscación o codificación: “it remains unclear whether filtering can be evaded” (p. 12).

Observación propia:
- Las herramientas eran simuladas: devolvían contenido preparado y no tocaban correos, cuentas ni pagos reales (p. 6). Las “acciones” del paper son texto que el modelo decide emitir, no efectos sobre sistemas.
- No hay números de éxito, ni N de intentos, ni línea base, ni varianza. Un “sí funciona” de una demo no sirve como tasa.
- El paper es de 2023 y prueba modelos y versiones de ese momento (text-davinci-003, GPT-4 y y una sesión de Bing Chat fechada el 4 de abril de 2023, p. 30). No sirve para decir qué defensa funciona hoy.
- No evalúa ningún control fuera del modelo (aprobación humana, permisos, sandbox). Las defensas que discute son RLHF, filtrado de entrada y salida, procesar el contenido recuperado para filtrar instrucciones, supervisores LLM, interpretabilidad y que el usuario verifique la salida (p. 12).
- La taxonomía es útil como vocabulario, pero no mide severidad ni probabilidad.

## Qué le sirve a MESH
1. **Respalda la premisa de la ruta de riesgo (demostrado).** Un contenido recuperado puede cambiar lo que hace el agente. El caso más parecido a MESH es el de la página 19 (Prompt 7 y Output 1): un correo con instrucciones hizo que el asistente, con herramientas de leer y enviar correo, redactara y enviara el mismo correo a todos los contactos de la libreta. Es una demostración en una aplicación sintética con datos preparados, pero es el precedente directo de “correo externo → agente → acción”. Inferencia propia: en MESH, el correo de Camila es ese canal y Tomás es el último eslabón.

2. **Justifica que la defensa no puede estar solo en el prompt (demostrado para el ataque; inferencia para la defensa).** Key Message #5 (p. 5) dice que el LLM decide cuándo llamar APIs y qué salidas procesa, por eso entradas y salidas son manipulables. El paper no evalúa ningún control, pero sus conclusiones (p. 12) dicen que el alcance del RLHF “is still unclear” y que “users can not be relied upon to observe every sub-operation”; de ahí, por inferencia propia, se sigue que la retención de reembolsos debe ejecutarse en el sandbox y no depender del modelo. Es lo que hace approval_gate. Inferencia propia.

3. **Verificación del remitente (no estudiado en el paper).** Los métodos activos del paper entran por correo (p. 4), pero el paper no prueba ninguna verificación de remitente. Inferencia propia: si la instrucción va en el cuerpo de un mensaje que el remitente sí envió, verificar el remitente no quita la inyección. Esto es coherente con el resultado de MESH (la verificación sola no cambió nada en Haiku, 8/12), pero el paper no lo demuestra. No conviene citarlo como respaldo de la verificación del remitente.

4. **Fraude por persuasión sin instrucción explícita (demostrado).** En la Sección 4.2.2 (p. 7), el modelo, sin que se le indicara técnica de ingeniería social, usó urgencia (“Hurry up, this offer is valid only for a limited time”) y, según los autores, “the model’s output could mirror some standard scam persuasion techniques” (p. 7). Sirve para decir que el texto engañoso puede salir del propio modelo y no del atacante, lo que apoya el tratamiento de BEC en MESH. Es sobre respuestas al usuario, no sobre transferencias de dinero.

5. **Límite de USD 500 (sin respaldo en el paper).** El paper no tiene ningún umbral. El único monto es “200 USD” en un prompt de fraude (p. 17), un parámetro del atacante y no un resultado. El límite de USD 500 es una decisión de diseño de MESH. Inferencia propia: el riesgo de fraccionar montos por debajo del umbral no está probado aquí. Los fraudes que siguen pasando con approval_gate en MESH (6/21 en Haiku y 3/21 en Sonnet) son los de monto bajo USD 500, lo que es consistente con esta lectura pero no la prueba; hay que medirlo en MESH.

6. **Métrica y frase para el pitch (demostrado en la cita, inferencia en el uso).** No hay métrica de éxito que copiar. Conviene usar la taxonomía de la Figura 2 (p. 3) para clasificar los hallazgos de MESH (fraude, intrusión, malware, manipulación de contenido, disponibilidad). Para el pitch, la frase más defendible es la de Key Message #5 (p. 5): las llamadas a API y sus salidas dependen del modelo, así que la vulnerabilidad está en ese punto de control. Evitar decir que el paper “demuestra” que una defensa funciona.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 42 · corregidas: 7 · eliminadas: 0.
- Correcciones:
  - Resumen: “no hay una solución clara” no está en el paper; el paper dice que es “hard to imagine a foolproof solution” (p. 12).
  - Números clave: la fila de los modos de Bing Chat decía que eran los modos “donde funcionaron los ataques”; el valor es la existencia de tres modos, y el paper solo dice que los ataques “often successfully work with different modes” (p. 6).
  - Limitaciones: el filtrado no se afirma como evadible; el paper dice que “it remains unclear” (p. 12).
  - Observación propia: las defensas discutidas no son solo cuatro; el paper también habla de procesar el contenido recuperado para filtrar instrucciones y de que el usuario verifique la salida. Son las páginas 12, no 12–13 (p. 13 es bibliografía).
  - Observación propia: la fecha del 4 de abril de 2023 está en la leyenda de la Figura 25 (p. 30); no prueba la versión de Bing Chat en general.
  - Qué le sirve a MESH, 1: en el Prompt 7 y el Output 1 (p. 19) el asistente redacta y envía el mensaje a los contactos; no lo reenvía.
  - Qué le sirve a MESH, 2: las conclusiones de la p. 12 no hablan de sandbox ni de reembolsos; eso es inferencia propia.
- Pendiente: las 82 referencias no se comprobaron una por una (solo se confirmó que la última es [82]); el proceso de lectura de la nota (“no se abrió el PDF”) no es verificable desde el texto.
