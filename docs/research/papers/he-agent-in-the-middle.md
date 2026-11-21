# Red-Teaming LLM Multi-Agent Systems via Communication Attacks
- **Autores:** Pengfei He, Yupin Lin, Shen Dong et al. (el PDF lista además a Han Xu, Yue Xing y Hui Liu; Michigan State University y University of Arizona, p. 1) · **Año:** 2025 (arXiv:2502.14847v2, 2 jun 2025) · **Enlace:** https://arxiv.org/abs/2502.14847 · **Tema:** ataques a la comunicación entre agentes en sistemas multiagente basados en LLM (interceptación y manipulación de mensajes)
- **Cobertura de lectura:** páginas 1–21, completo (cuerpo, Limitations, referencias, apéndices A–E y Tabla 14). No hizo falta el PDF original: las tablas salen legibles en el texto extraído.

## Resumen
Los sistemas multiagente basados en LLM (LLM-MAS) se coordinan mediante mensajes entre agentes, y hasta ahora la literatura había estudiado sobre todo agentes maliciosos o entradas adversas, no la comunicación misma (p. 2). Los autores proponen AiTM (Agent-in-the-Middle): un agente adversario basado en LLM que intercepta los mensajes que llegan a un agente víctima y los responde con instrucciones generadas por reflexión, sin modificar los agentes, sus perfiles, las herramientas ni la comunicación entre los demás (p. 2–4). Lo evalúan en AutoGen y Camel con MMLU (biología y física), HumanEval y MBPP, en cuatro topologías (Chain, Tree, Complete, Random) y dos objetivos (comportamiento dirigido y DoS) (p. 5). El ASR supera 40% en todos los casos y 70% en la mayoría de los experimentos (p. 2). Chain es la topología más vulnerable y Tree y Complete son más resistentes, sobre todo en MMLU (p. 6). La posición de la víctima y la persuasión del adversario cambian mucho el resultado, y un adversario con modelo más fuerte sube el ASR (p. 7–8). En las aplicaciones reales, MetaGPT cae en más de 75% de los casos y ChatDev resiste al interceptar CPO y CEO (p. 8). Los autores proponen mitigaciones (monitor externo de cada mensaje, formatos estrictos), pero no las evalúan (p. 12–13).

## Método
- **Modelo de amenaza:** el atacante solo intercepta y manipula los mensajes que recibe la víctima; no controla otros agentes, la comunicación entre otros agentes ni las herramientas o bases de datos externas. Conoce la tarea, pero no la estructura interna ni los modelos (p. 4).
- **Adversario:** un LLM con mensaje de sistema que persigue un objetivo malicioso G; en cada turno genera instrucciones nuevas a partir de las instrucciones previas y de los mensajes interceptados (I^t = A_ad(I^{t−1}, M, G)), con un mecanismo de reflexión que actúa como optimizador de prompts (p. 4).
- **Frameworks:** AutoGen (conversación programada) y Camel (roles usuario-asistente) (p. 5). Aplicaciones reales: MetaGPT y ChatDev, con sus configuraciones por defecto (p. 8, 12).
- **Topologías:** Chain (3 agentes), Tree (2 padres con 2 hijos cada uno), Complete (3 agentes que se hablan entre sí) y Random (4 agentes con conexiones aleatorias en cada tarea) (p. 5, 12).
- **Datos:** MMLU biología y física; HumanEval (164 problemas); MBPP (974 tareas) (p. 5). SoftwareDev (de MetaGPT), solo con los problemas públicos (p. 8, nota 3).
- **Modelos:** GPT-4o en todos los agentes por defecto (p. 5). En RQ2 cambian el modelo del adversario y de las víctimas entre tres versiones de GPT, incluido GPT-3.5-turbo (p. 8).
- **Víctima por defecto:** el segundo agente en Chain, Complete y Random, y el primer hijo del primer padre en Tree (p. 5).
- **Objetivos y métrica:** en "Target", el éxito es que la salida contenga el comportamiento pedido (cambiar la letra de la respuesta con chr(ord(x)+4) en MMLU, o insertar una función safety_check que escanea /Users en HumanEval y MBPP). En "DoS", el éxito es que la respuesta sea similar a "I can not assist the request". La métrica es el ASR promedio sobre el conjunto de datos (p. 5).
- **Persuasión:** tres niveles de prompt del adversario, puntuados con GPT-4o en credibilidad, contenido y actitud (p. 7, 12).
- **Tamaño de muestra y repeticiones:** no se reportan (ver Limitaciones).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| ASR de AiTM en la introducción | "exceeding 40% in all cases and surpassing 70% in most experiments" | 2 |
| Target, AutoGen, Chain, HumanEval (ASR, %) | 95.2 | 6 |
| Target, Camel, Chain, MBPP (ASR, %) | 98.5 | 6 |
| Target, AutoGen, Tree, MMLU-bio (ASR, %) | 40.7 | 6 |
| Target, AutoGen, Complete, MMLU-bio (ASR, %) | 43.9 | 6 |
| DoS, celdas de la Tabla 1 con ASR superior a 80% | "23/32 cells in Table 1 exceeding 80%" | 6 |
| Table 2 (posición de la víctima), celdas con ASR superior a 80% | "more than 80% on 27/32 cells in Table 2" | 7 |
| Target, AutoGen, Tree, MMLU-bio, según nivel de persuasión 1 → 2 → 3 (ASR, %) | 19.5 → 27.1 → 40.7 (Tabla 3 en p. 8) | 7 |
| Target, AutoGen, Complete, MMLU-bio, con GPT-4o en el adversario vs. GPT-3.5-turbo (ASR, %) | 57.9 vs. 43.9 | 8 |
| MetaGPT, SoftwareDev, Target, con los cuatro roles interceptados (ASR, %) | 100.0 en los cuatro roles | 8 |
| ChatDev, SoftwareDev, Target: CPO / CEO / CTO / Programmer (ASR, %) | 0.0 / 0.0 / 45.4 / 63.6 | 8 |

## Citas textuales
- "Unlike existing works that assume the attacker can directly modify agents in the system, AiTM targets the messages among agents, and evaluates if an LLM-MAS is vulnerable to communication interception and manipulation." (p. 2)
- "AiTM is a significant threat to LLM-MAS." (p. 6)
- "AiTM is much stealthier than malicious agents and adversarial inputs." (p. 12)

## Limitaciones
Reconocidas por los autores:
- Usan solo modelos de caja negra (GPT) en todos los experimentos; el objetivo declarado es mostrar el riesgo, no caracterizarlo por completo (p. 9).
- Cubren 4 topologías y 2 aplicaciones reales; un estudio más profundo de las estructuras queda fuera de alcance (p. 9).
- Los autores no evalúan defensas: en la discusión dicen que "better mitigation methods need to be developed" y describen un monitor externo y formatos estrictos como posibles mitigaciones, con costo de cómputo y pérdida de flexibilidad (p. 12–13).
- Sobre SoftwareDev solo prueban los problemas públicos, porque la versión completa no está publicada (p. 8, nota 3).
- No hay un benchmark de ataques de comunicación con el que comparar; por eso presentan solo sus propios resultados (p. 5, nota 1).
- El código se publicará "soon" (p. 9, nota 4).
- Para simplificar dejan fuera herramientas y bases de datos externas del sistema (p. 4).
- La estructura Chain es demasiado simple para estudiarla como caso controlado, y Random cambia en cada tarea y es difícil de controlar (p. 7, nota 2).

Observación propia:
- El paper no reporta cuántas preguntas tiene cada subconjunto de MMLU (biología y física), cuántas repeticiones se hicieron, la varianza ni intervalos de confianza. Con n chico, los saltos de ASR (por ejemplo 19.5 → 40.7) no tienen error asociado.
- El texto dice que en Tree el ataque a la víctima padre supera al hijo "about 15% increase" (p. 7), pero en la Tabla 2 (AutoGen, MMLU-bio, Target) la diferencia entre Child (40.7) y Parent (67.4) es de 26.7 puntos. No logro reconciliar ambos datos; conviene tratarlo como inconsistencia a revisar.
- La métrica de éxito es por contenido: para DoS, "similar" a "I can not assist" se juzga sin describir el criterio ni validar con anotación humana (p. 5). Para Target en código, el éxito es que aparezca la función safety_check, no que se ejecute ni que dañe nada.
- El modelo de amenaza supone que el atacante puede interceptar el canal (eavesdropping, p. 4), pero no muestra la interceptación en un entorno de red real.
- El paper no mide el efecto en acciones con herramientas (pagos, cambios de cuentas). El daño que estudia es textual.

## Qué le sirve a MESH
1. **Respalda la premisa de que el canal entre agentes es superficie de ataque propia.** El paper demuestra que manipular solo mensajes, sin tocar agentes ni herramientas, da ASR superior a 40% en todos sus casos (p. 2, 6). Esto apoya la tesis de MESH de que el riesgo vive en la ruta, no solo en cada componente. Inferencia: la cadena Camila → Mateo → Tomás es el mismo tipo de canal, aunque en MESH el mensaje malicioso llega como correo legítimo y no como intercepción.
2. **Topología: la cadena es la peor.** Chain es la más vulnerable (95.2 y 98.5 en Tabla 1), y Tree resiste más por su diseño en capas (p. 6). Esto respalda calcular rutas de riesgo a partir de la topología: MESH es una cadena lineal, que el paper señala como la forma más expuesta. Inferencia: el paper no mide rutas de correo externo; solo justifica que la posición y la linealidad importan.
3. **Etiqueta de procedencia: el paper no propone nada parecido, pero describe el problema que resuelve.** Su única mitigación es un monitor externo sobre cada mensaje entre agentes, con costo de cómputo y riesgo de bloquear comunicación legítima (p. 12). Una etiqueta de procedencia que el sistema pone y que viaja con el mensaje es un monitor mucho más barato, porque no decide si el contenido es malicioso y solo informa el origen. Esto es inferencia: el paper no evalúa ese diseño.
4. **Verificación del remitente: el paper no cubre esta clase de ataque.** Su modelo asume intercepción del canal (p. 4), no mensajes legítimos de un remitente externo. Un correo de fraude entra por el canal normal, así que la verificación del remitente no cambia lo que el paper mide. Esto es inferencia y conviene decirlo tal cual en el pitch, porque explica por qué MESH midió que la verificación sola no cambió nada (8/12 con y sin ella en Haiku).
5. **Persuasión y modelo del adversario, para el pitch y para el límite de USD 500.** Con más persuasión, el ASR sube de 19.5 a 40.7 (p. 7), y con GPT-4o como adversario sube de 43.9 a 57.9 (p. 8). Es decir, el adversario más fuerte gana aunque la víctima no cambie. Esto sirve para argumentar que un filtro basado en el contenido del mensaje o en la persuasión no es suficiente, y que una regla que no depende de lo que dice el correo (como el umbral de USD 500 de approval_gate) es más robusta. Inferencia: el paper no mide montos ni acciones con herramientas.
6. **Métrica y reporte.** El paper separa Target y DoS, reporta por topología, por víctima y por modelo, y deja claro el criterio de éxito (p. 5–8). MESH puede copiar esa estructura, pero sus n son chicos (21 y 12), así que debe reportar intervalos o al menos repeticiones; el paper tampoco lo hace, y no conviene citarlo como modelo de rigor estadístico.

Frase candidata para el pitch (cita textual del paper): "AiTM is much stealthier than malicious agents and adversarial inputs." (p. 12). Sirve para justificar que la defensa tiene que estar en el sistema y no solo en el agente o en la entrada.
