# Progent: Securing AI Agents with Privilege Control
- **Autores:** Tianneng Shi, Jingxuan He, Zhun Wang, Hongwei Li, Linyu Wu, Wenbo Guo, Dawn Song · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2504.11703 · **Tema:** control de privilegios por llamada a herramienta contra inyección indirecta en agentes con herramientas
- **Cobertura de lectura:** páginas 1–17, completo (cuerpo, referencias y apéndices A–G). Lectura sobre el .txt extraído; no revisé el PDF. El texto es arXiv v3 (14 May 2026). Las figuras 3–8 y 10 llegan como texto desordenado, así que no cito valores de ellas.

## Resumen
Progent es un módulo que se pone entre el agente y sus herramientas y aplica una política de privilegios hecha de reglas simbólicas sobre nombres de herramienta y argumentos. Toda llamada se evalúa de forma determinista y una llamada sin regla que la permita se bloquea por defecto (p. 2–3, 5). Un LLM genera la política inicial a partir de la tarea del usuario y la actualiza con los retornos de las herramientas. Cada actualización pasa por un solver SMT (Z3) que la clasifica como narrowing, que se aplica sola, o como expansion, que requiere aprobación; así el espacio de acciones solo se reduce sin aprobación (p. 1, 7). Los autores atacan el problema de que el contenido de una herramienta puede alterar el plan del agente sin señales visibles (p. 2). En AgentDojo la ASR baja de 39.9% a 1.0% y en ASB de 70.3% a 3.9%, con utilidad similar (p. 2). También prueban la integración con LangChain, OpenAI Agents SDK, OpenHands y un sistema multiagente en AutoGen sobre un benchmark MCP derivado de AgentDojo, con ASR cercana a 1% (p. 10–11). Los detectores de inyección y las defensas por prompt que comparan resultan ineficaces en esos benchmarks (p. 8–9).

## Método
- **Modelo de amenaza (p. 5):** el atacante controla las observaciones del entorno (por ejemplo, un correo), pero no el modelo ni el system prompt; el usuario es benigno. El éxito del ataque es una llamada no autorizada.
- **Modelos:** gpt-4o como agente y como LLM de políticas en el experimento principal (p. 8). Ablaciones con gpt-4.1, claude-sonnet-4 y gemini-2.5-flash como LLM de políticas (p. 10), y con gpt-4o, claude-sonnet-4, gemini-2.5-flash, gpt-4.1 y Meta-SecAlign-70B como agente (p. 10–11; checkpoints en el apéndice D, p. 14).
- **Benchmarks:** AgentDojo, con cuatro suites (banca, Slack, viajes, workspace), y ASB, con diez escenarios y cinco plantillas de ataque (p. 8). En las partes que leí el texto no da el número de tareas por suite.
- **Líneas base:** sin defensa; repeat_user_prompt, spotlighting, tool_filter, transformers_pi_detector, DataSentinel y Llama Prompt Guard 2 en AgentDojo (p. 8); delimiters, sandwich e instructional_prevention en ASB (p. 9).
- **Métricas:** ASR bajo ataque, y utilidad sin ataque y bajo ataque (p. 8).
- **Aprobador de expansiones:** configuración por defecto Auto-Approve, que acepta todas las expansiones y es el peor caso; también Disable Update, Auto-Deny y Manual Approval (p. 8–10).
- **Implementación:** esquema JSON con jsonschema y Z3 (p. 7). Dos modos: biblioteca (middleware para LangChain, wrapper para OpenAI Agents SDK) y proxy (OpenHands, AutoGen) (p. 11, 15).
- **Ataques adaptativos (apéndice E, p. 15):** "If-then-else", "Allow attack tool call" y AgentVigil.

## Números clave

| Dato | Valor | Página |
|---|---|---|
| ASR en AgentDojo, sin defensa → con Progent (gpt-4o, bajo ataque) | 39.9% → 1.0% | 2 |
| ASR en ASB, sin defensa → con Progent (bajo ataque) | 70.3% → 3.9% | 2 |
| ASR en AgentDojo con política inicial generada por LLM, sin actualizaciones (gpt-4o) | 39.9% → 2.5% | 7 |
| Proporción de actualizaciones de política que son expansiones y requieren aprobación (AgentDojo) | 6% ("only 6% of updates required approval") | 4 |
| ASR con claude-sonnet-4 como agente, sin defensa → con Progent | 6.8% → 0.5% | 10 |
| ASR con Meta-SecAlign-70B como agente, sin defensa → con Progent | 4.8% → 0.3% | 10 |
| ASR con Manual Approval (revisión humana de políticas y expansiones, sección 8.2) | 0% | 10 |
| ASR con el mejor LLM de generación de políticas (gpt-4o como agente) | 1% | 10 |
| Ataques exitosos bloqueados en agentes reales y multiagente (MCP) | "more than 95%" | 11 |

## Citas textuales
- "Our evaluation on popular benchmarks (i.e., AgentDojo and ASB) shows that Progent significantly reduces attack success rates while maintaining high utility." (p. 1)
- "Progent reduces the attack success rate (ASR) from 39.9% to 1.0% on AgentDojo, and from 70.3% to 3.9% on ASB, while maintaining the agent’s utility in both cases." (p. 2)
- "The attack is subtle: the user’s original task is completed while the malicious action is carried out, potentially leaving the user unaware." (p. 2)

## Limitaciones
Reconocidas por los autores:
- No defiende ataques que quedan dentro del mínimo privilegio necesario para la tarea, como la manipulación de preferencias (p. 5).
- No cubre ataques que solo afectan el texto de salida del agente (p. 5, 11).
- Si el usuario aprueba expansiones amplias o da tareas ambiguas, la política puede exceder el mínimo privilegio; los mecanismos lo mitigan pero no lo eliminan (p. 11).
- En modo proxy no protege las funciones integradas que no pasan por MCP; el modo biblioteca sí, pero exige cambios de código (p. 12).
- No aplica a agentes multimodales que hacen clics en pantalla (p. 12).
- En AgentDojo excluyen dos tareas de inyección de la suite de viajes por ser ataques de preferencia, y corrigen a mano los resultados de una tarea de Slack (p. 14).
- La configuración Manual Approval asume un revisor con fuerte conciencia de seguridad que no concede acceso irrestricto a herramientas sensibles como send_money (p. 14).
- Los ataques cuyos nombres y descripciones se parecen a herramientas legítimas son difíciles de identificar incluso para humanos (p. 9).
- Los ataques adaptativos solo suben marginalmente la ASR, pero son tres ataques (p. 15).

Observación propia:
- El texto no reporta intervalos de confianza, repeticiones ni número de tareas por suite. No puedo estimar la incertidumbre de 1.0% o 3.9%.
- Según el texto (p. 8–9), los resultados principales usan Auto-Approve, es decir, un aprobador que acepta toda expansión. Ese es el escenario más débil, por lo que las cifras son una cota de peor caso.
- En el texto no encuentro latencia ni costo de la capa de actualización con LLM.
- El confinamiento monotónico limita el crecimiento de la superficie sin aprobación, pero no evita el daño de una expansión que el aprobador acepta. El propio paper lo muestra con send_money sin restricción de destinatario (p. 14).
- Progent evalúa nombre de herramienta y argumentos, no el origen del dato. Si el destinatario ya está en la lista permitida, una instrucción de origen externo pasa sin que el sistema lo note. El paper no tiene etiqueta de procedencia (observación de diseño, no un resultado del paper).
- Los benchmarks son sintéticos: inyección en retornos de herramientas dentro de AgentDojo y ASB. No hay fraude BEC ni correos reales.

## Qué le sirve a MESH
1. **Respalda la tesis central (demostrado):** el control debe vivir en la llamada a herramienta, fuera del LLM. Progent lo muestra con ASR 39.9% → 1.0% (p. 2) y el confinamiento monotónico (p. 1, 7). Se puede citar con la frase de la p. 1: "Every tool call is checked against such a policy through a deterministic procedure, enforcing the principle of least privilege." (p. 1).
2. **Aprobar permisos no es aprobar acciones (inferencia propia):** Progent aprueba expansiones de la política; MESH aprueba llamadas concretas por procedencia y monto. Son capas complementarias. La procedencia de MESH podría decidir qué llamadas van a aprobación, mientras que una política como la de Progent limitaría qué herramientas existen.
3. **Límite de USD 500 (inferencia propia):** el lenguaje de reglas de Progent tiene los operadores < y ≤ sobre argumentos (figura 2b, p. 5), así que un tope de monto podría escribirse como regla. El paper no lo implementa. La condición "origen externo" no está en su lenguaje tal como se describe, y eso es justo lo que MESH agrega.
4. **Verificación del remitente y riesgo de aprobación:** Progent no verifica remitentes. Sus resultados de Manual Approval (0%, p. 10) dependen de un revisor competente (p. 14), y el paper reconoce el riesgo de errores humanos (p. 11). MESH debería decir lo mismo de su aprobación y reportar la verificación del remitente con sus propios números (en su resultado, sola no cambió nada en Haiku).
5. **Qué copiar del paper:** reportar ASR bajo ataque junto con utilidad sin ataque, en la misma tabla (p. 8–9); y el protocolo de ataques adaptativos del apéndice E (p. 15), que se puede replicar en MESH como un caso en el que el agente recibe instrucciones para ampliar permisos. El paper también separa la decisión de "¿hay que actualizar?" del contenido de la herramienta (p. 7). Puede probarse en MESH si el clasificador de procedencia recibe el correo entrante.
6. **Frase para el pitch, con límite explícito:** el paper reconoce que los ataques con herramientas legítimas y argumentos plausibles son los difíciles (p. 9). Ese es el caso de BEC en MESH, donde el reembolso es una herramienta permitida. Por eso el argumento de MESH debe apoyarse en la procedencia y no solo en la lista de herramientas, y conviene decirlo así en el pitch.
