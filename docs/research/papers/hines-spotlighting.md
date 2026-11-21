# Defending Against Indirect Prompt Injection Attacks With Spotlighting
- **Autores:** Keegan Hines, Gary Lopez, Matthew Hall, Federico Zarfati, Yonatan Zunger, Emre Kıcıman (Microsoft) · **Año:** 2024 (arXiv:2403.14720, v1 del 20 mar 2024) · **Enlace:** https://arxiv.org/abs/2403.14720 · **Tema:** inyección indirecta de prompts (XPIA) y defensas por transformación de la entrada en el prompt
- **Cobertura de lectura:** páginas 1–8, completo (cuerpo, discusión, referencias y apéndice 8.1–8.2). Nada sin leer. Las tablas y figuras se leyeron desde el texto extraído; no fue necesario abrir el PDF.

## Resumen
El paper parte de que un LLM no distingue entre instrucciones del sistema y texto no confiable que llega como datos (inyección indirecta, XPIA). Proponen "spotlighting", una familia de técnicas de prompt engineering que transforman el texto externo para que su procedencia sea más visible para el modelo, y describen tres variantes: delimiting (delimitadores), datamarking (intercalar un carácter especial entre palabras) y encoding (codificar el texto en base64, ROT13 u otro). Evalúan modelos black-box de la familia GPT (text-davinci-003, GPT-3.5-Turbo y GPT-4) con un corpus sintético de 1000 documentos que contienen un payload de palabra clave y miden la Attack Success Rate (ASR). Encuentran que delimitar reduce la ASR solo a la mitad, que datamarking la baja de unos 50% a menos de 3% en GPT-3.5-Turbo sin afectar benchmarks de NLP, y que encoding llega a 0.0% en resumen, aunque solo es confiable con modelos de gran capacidad. Los autores reconocen que no entienden del todo por qué funciona.

## Método
- **Modelos:** black-box de la familia GPT: text-davinci-003, GPT-3.5-Turbo (versión de junio de 2023) y GPT-4 (versión de junio de 2023). Temperatura 1.0 (p. 3).
- **Datos de ataque:** corpus sintético de 1000 documentos con inyecciones que son variaciones de un payload de palabra clave: el atacante pide al modelo olvidar sus instrucciones y responder solo con una palabra especial (p. 3).
- **Tareas:** resumen de documentos y Q&A sobre documentos; en el apéndice también se muestran ejemplos de few-shot (pp. 3–5, 8).
- **Métrica:** ASR como fracción del corpus con inyección exitosa; el criterio es estricto (el modelo es "overtaken" por el ataque). Se menciona una métrica más laxa, Affected Success Rate (AffSR), que no se usa en los resultados principales (p. 8).
- **Control de utilidad:** en GPT-3.5-Turbo se compara desempeño con y sin datamarking en SQuAD, SuperGLUE WiC, SuperGLUE BoolQ e IMDB (p. 5, Fig. 7). El paper no reporta varianza, intervalos de confianza ni tamaño de muestra por tarea.
- **Modelo de amenaza:** el atacante entrega texto dentro de un documento que procesa el LLM. Se asume que el atacante puede conocer el prompt del sistema (p. 6).
- **Limitación del montaje:** el ataque es un payload simple de palabra clave y no hay agentes, herramientas ni acciones con efectos externos.

## Números clave
| Dato | Valor | Página |
|---|---|---|
| ASR sin spotlighting, modelos GPT (abstract) | greater than 50% | 1 |
| ASR con spotlighting, modelos GPT (abstract) | below 2% | 1 |
| Tamaño del corpus de ataque sintético | 1000 documents | 3 |
| Temperatura de los experimentos | 1.0 | 3 |
| ASR base GPT-3.5-Turbo, dataset de prueba (Fig. 3) | around 60% | 4 |
| Datamarking, GPT-3.5-Turbo, resumen (texto) | approximately 50% → below 3% | 4 |
| Datamarking, text-003, resumen (texto) | 40% → 0.00% | 4 |
| Datamarking, GPT-3.5-Turbo, resumen (Fig. 4) | 3.10% | 4 |
| Datamarking, GPT-3.5-Turbo, Q&A (Fig. 5) | 8.0% | 4 |
| Datamarking, GPT-4, Q&A (Fig. 5) | 1.0% | 4 |
| Encoding, GPT-3.5-Turbo, resumen / Q&A (Fig. 6) | 0.0% / 1.8% | 5 |
| Few-shot, GPT-3.5-Turbo (Fig. 9, apéndice 8.2) | below 5% | 8 |

## Citas textuales
- "this kind of defense could be easily subverted by an attacker who gains knowledge of our system prompt and inserts their own delimiting." (p. 4)
- "Out-of-band signaling has many advantages over in-band signaling including immunity to interference, protection from fraud, and bandwidth optimization." (p. 7)
- "With current architectures of common language models, however, this is not feasible in any straightforward way." (p. 7)

## Limitaciones
Reconocidas por los autores:
- Delimiting se puede romper si el atacante conoce el delimitador y lo inserta él mismo; por eso no lo recomiendan en la práctica (p. 4 y p. 6).
- Datamarking puede fallar si el texto no tiene espacios (p. 6) o si el contenido es código (p. 5). Recomiendan un token que no colisione con el input y, en lo posible, marcado dinámico o aleatorio (p. 5–6).
- Encoding depende de la capacidad del modelo: GPT-3.5-Turbo pierde desempeño al decodificar, y recomiendan no usarlo con modelos de generación anterior (p. 5, Fig. 8).
- No entienden del todo por qué funciona el spotlighting: "we lack a clear understanding of why spotlighting actually helps" (p. 6).
- Los resultados de few-shot dependen de los ataques conocidos y pueden tener fuga de etiquetas entre ejemplos y test. Los autores prefieren defensas estructurales (p. 8).
- Las cifras de ASR son sensibles a la definición de éxito: con la métrica estricta, un modelo que nota el ataque pero no lo obedece cuenta como fallo; el AffSR no se usó en los resultados principales (p. 8).

Observación propia:
- Las cifras no son consistentes entre sí: el abstract dice "below 2%", el texto de datamarking dice "below 3%" y la leyenda de la Fig. 4 dice "3.10%" para el mismo modelo y tarea. El paper no aclara qué condición produce el "below 2%" del abstract.
- No hay tamaño de muestra por celda ni intervalos de confianza. Con 1000 documentos repartidos en tareas y modelos, las diferencias de 1–3 puntos pueden ser ruido.
- El ataque es estático y conocido. No prueban un atacante adaptativo que optimice contra la transformación concreta, aunque sí discuten el riesgo en la sección 6.
- No evalúan acciones con efectos externos, herramientas, flujos entre agentes ni procedencia multi-salto. Todo el resultado es de un solo LLM leyendo un documento.
- La "procedencia" del paper es el origen del texto dentro del prompt. No hay nada sobre quién envió un mensaje ni sobre verificación de remitente.

## Qué le sirve a MESH
1. **Etiqueta de procedencia (respaldo parcial).** El paper demuestra que hacer más visible el origen del texto baja la ASR de 50% a menos de 3% en GPT-3.5-Turbo con datamarking (p. 4), sin daño medible en benchmarks (p. 5). Esto respalda la idea de que la procedencia ayuda al modelo. Diferencia clave, inferencia nuestra: en el paper la marca vive dentro del mismo canal de texto que el atacante puede imitar (p. 4 y p. 6). En MESH la etiqueta la pone el sistema y viaja como metadato entre agentes, así que no depende de que el modelo la respete.
2. **Aprobación por procedencia (respaldo conceptual, no empírico).** La analogía de telecomunicaciones (p. 6–7) dice que la señalización in-band no resuelve la interferencia intencional y que la out-of-band protege contra fraude. El paper afirma que eso "no es factible de forma directa" en LLM actuales (p. 7). MESH hace algo parecido, pero fuera del modelo: el sandbox retiene el reembolso. Esto es inferencia nuestra; el paper no prueba nada sobre herramientas.
3. **Métrica para copiar.** El paper usa un payload de palabra clave con criterio estricto de ASR y menciona AffSR (p. 8). Para MESH conviene reportar dos cosas: la tasa de reembolsos fraudulentos emitidos (equivalente a ASR estricta) y la tasa en que finanzas recibió la advertencia (equivalente a AffSR). Inferencia: la advertencia de 4/12 a 12/12 en nuestro lote multiagente es una medida de tipo AffSR.
4. **Límite de USD 500 y verificación del remitente.** El paper no aborda ninguno de los dos. No sirve como respaldo ni como contraste. No usar como cita para esos puntos. Sí sirve la advertencia de p. 4: una defensa que depende de conocer el prompt se rompe, así que la verificación del remitente y el umbral deben estar fuera del texto que el atacante puede escribir.
5. **Rutas de riesgo (vacío de la literatura).** El paper evalúa un solo LLM sobre un documento, sin agentes ni herramientas. Por eso no respalda ni contradice el cálculo de rutas correo externo → agentes → herramienta. Sirve para decir que la literatura de spotlighting no cubre rutas multiagente, y que nuestra contribución está en ese hueco (inferencia).
6. **Frase candidata para el pitch.** "Out-of-band signaling has many advantages over in-band signaling including immunity to interference, protection from fraud, and bandwidth optimization." (p. 7). El paper lo presenta como motivación, no como resultado. Si se usa, hay que decir que es una analogía de los autores y que MESH la implementa fuera del modelo.
