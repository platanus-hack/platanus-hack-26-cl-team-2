# System-Level Defense against Indirect Prompt Injection Attacks: An Information Flow Control Perspective

- **Autores:** Fangzhou Wu, Ethan Cecchetti, Chaowei Xiao (University of Wisconsin-Madison)
- **Año / venue:** 2024, preprint arXiv (cs.CR), arXiv:2409.19091 (v2, 10 oct 2024, "23 pages"). Venue de conferencia: no verificado.
- **Enlace:** https://arxiv.org/abs/2409.19091 (código: https://github.com/fzwark/Secure_LLM_System)
- **PDF local:** ~/papers-ia-safety/procedencia-ifc/wu-2024-fsecure.pdf
- **Verificado:** metadatos de arxiv.org/abs/2409.19091 (título, 3 autores, fecha 2024/09/27) y cabecera del PDF (v2); las cifras salen de las Tablas 2 y 3 del PDF. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
El paper parte de que el LLM cumple dos funciones en un sistema con herramientas, planificador y ejecutor, y de que mezclarlas permite que datos maliciosos reescriban el plan.
Propone el "f-secure LLM system": un planner que genera planes estructurados y ejecutables, un executor, y un monitor de seguridad que filtra el input no confiable antes de que llegue a la planificación.
Las etiquetas de integridad forman un retículo, y los resultados de herramientas se etiquetan según una configuración de seguridad (por ejemplo, un archivo confiable frente a uno no confiable).
El monitor deja que el planner vea solo datos confiables. Lo no confiable se pasa por referencia (`{Data_output:i}`) al executor sin entrar al plan.
El paper formaliza sistemas LLM existentes y el f-secure, y prueba garantías de integridad en el estilo de la no-interferencia.
Analiza dos clases de compromiso: condicional y en cadena. La cadena es el caso en que una salida intermedia contaminada guía los pasos siguientes.
Lo compara con SecGPT/IsolateGPT y muestra un caso en que SecGPT es comprometido dentro de una sola app y f-secure no.
Evalúa en InjecAgent (daño directo y robo de datos, en escenarios base y reforzado) con GPT-3.5 Turbo, GPT-4 Turbo, Gemini-1.5-pro y Claude-3.5-Sonnet.
La tasa de éxito de ataque (ASR) baja a 0% en todos los modelos y escenarios.
La funcionalidad se mide como exactitud de pasos y exactitud global en benchmarks de una herramienta, de varias herramientas y de datos relacionados.

## Ataque o defensa que propone
Defensa a nivel de sistema basada en IFC:
- **Separación planner/executor.**
- **Planes estructurados en JSON.** Cada paso tiene índice, objeto, `Data_input` y `Data_output`.
- **Un monitor determinista que:**
  - impide que datos de baja integridad influyan en la planificación;
  - verifica la sintaxis de cada paso;
  - sustituye las referencias en tiempo de ejecución.

## Números que reporta
- **Tabla 2, ASR total en InjecAgent** (base / reforzado), sistema ReAct vanilla frente a f-secure:

  | Modelo | ReAct vanilla | f-secure |
  |---|---|---|
  | GPT-3.5 Turbo | 51,6% / 67,4% | 0% / 0% |
  | GPT-4 Turbo | 28,7% / 44,5% | 0% / 0% |
  | Gemini-1.5-pro | 20,9% / 15,1% | 0% / 0% |
  | Claude-3.5-Sonnet | 17,4% / 1,1% | 0% / 0% |

  En el escenario base, el robo de datos con Claude-3.5-Sonnet es 26,2%.
- **Tabla 3, funcionalidad** (exactitud global, ReAct / SecGPT / f-secure):
  - **Claude-3.5-Sonnet:** 100% / 100% / 100% con una herramienta y con varias herramientas. En datos relacionados, 100% / 57,14% / 95,23%.
  - **Gemini-1.5-pro con varias herramientas:** 9,52% / 50% / 95%.
  - **GPT-3.5 Turbo con varias herramientas:** 80% / 0% / 60%. Es un caso donde f-secure pierde frente a ReAct.

  En general f-secure iguala o supera a SecGPT y suele igualar a ReAct.

## Conexión con MESH
- **El "compromiso en cadena" es la ruta de MESH.** Seed → colega → finanzas. La salida intermedia (el mensaje del seed) está contaminada aunque parezca interna. El paper la trata como un problema de propagación de etiquetas y no de detección. Eso respalda a `risk-paths.ts`, que analiza salto por salto.
- **Idea: monitor sobre `message-bus.ts`.** En vez de anexar texto (`withProvenance`), el monitor guarda la etiqueta de integridad del mensaje como metadato y decide qué puede entrar en el contexto "planificador" de un agente con herramientas financieras. Hay una variante drástica tipo f-secure: el agente de finanzas recibe el contenido de mensajes externos solo como referencia opaca, y no puede usar valores contaminados (el IBAN) como argumentos de herramientas consecuentes.
- **El monitor es determinista.** Sus decisiones son auditables y reproducibles, igual que `analyzeRiskPaths()`. Encaja con el estilo "sin llamada a modelo" de MESH.
- **Cautela.** InjecAgent es un benchmark de un solo agente y un solo turno. No mide sistemas multiagente como MESH.
