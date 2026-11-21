# Defeating Prompt Injections by Design
- **Autores:** Edoardo Debenedetti, Ilia Shumailov, Tianqi Fan, Jamie Hayes, Nicholas Carlini, Daniel Fabian, Christoph Kern, Chongyang Shi, Andreas Terzis, Florian Tramèr (Google, Google DeepMind, ETH Zurich) · **Año:** 2025 (arXiv 2503.18813v2, 24 jun 2025) · **Enlace:** https://arxiv.org/abs/2503.18813 · **Tema:** defensa por arquitectura contra inyección de prompts indirecta en agentes con herramientas: control de flujo, flujo de datos, capacidades y políticas de seguridad.
- **Cobertura de lectura:** pp. 1–26 completas (cuerpo, Secciones 1–11, figuras y captions); p. 27 solo el inicio; pp. 30–32 (Apéndice A, completo); pp. 33–41 (Apéndices B–G: Tablas 2–14, políticas del Apéndice E y arranque del H.1); pp. 124–125 (Apéndice I). No leídas: pp. 28–29 (lista de referencias) y pp. 42–123 (listados completos de prompts H.1–H.2, caso de estudio H.3 y trazas de tareas fallidas H.4). Los datos de este resumen salen de las partes leídas.

## Resumen
El paper aborda la inyección de prompts indirecta: un agente con herramientas lee datos no confiables (correos, documentos, páginas) que pueden alterar qué herramienta se llama o con qué argumentos. Los autores señalan que la defensa habitual de "aislar un LLM que lee datos" (Dual LLM, Willison 2023) no basta, porque un dato malicioso puede cambiar los argumentos de una herramienta aunque el plan no cambie (p. 3). Proponen CaMeL, una capa de sistema alrededor del LLM que no modifica el modelo: un LLM "privilegiado" (P-LLM) escribe en un subconjunto de Python el plan a partir de la consulta del usuario; un LLM "cuarentenado" (Q-LLM) sin herramientas extrae datos estructurados; un intérprete propio asigna a cada valor capacidades (procedencia y lectores permitidos) y aplica políticas antes de cada llamada a herramienta (pp. 3–9). En AgentDojo, CaMeL resuelve 77% de las tareas frente a 84% sin defensa, según el resumen del paper (p. 1). En la evaluación de seguridad con 949 ataques, CaMeL sin políticas deja entre 0 y 13 ataques exitosos según el modelo: cero en Gemini 2.5 Pro y 13 en Claude 4 Sonnet (Tabla 4, p. 34). Los autores admiten side channels, costo en tokens y dependencia de políticas escritas a mano (pp. 19–25).

## Método
- **Benchmark:** AgentDojo (Debenedetti et al., 2024b), con suites banking, slack, travel y workspace. Se reportan 949 ataques en total (Figura 9, p. 14).
- **Modelos:** en la evaluación principal, gemini-2.5-flash-preview-05-20, gemini-2.5-pro-preview-05-06, claude-3-5-haiku-20241022, claude-sonnet-4 (con y sin 16 000 tokens de razonamiento), gpt-4.1, o4-mini (alto esfuerzo) y o3 (alto esfuerzo) (p. 12). Las comparaciones con otras defensas (tool filter, spotlighting, prompt sandwiching) y los casos de estudio usan Claude 3.5 Sonnet (pp. 16–17).
- **Arquitectura:** P-LLM sin acceso a datos de herramientas ni a la salida del Q-LLM; Q-LLM sin herramientas, con esquema Pydantic y un campo booleano adicional `have_enough_information`; intérprete CaMeL con grafo de dependencias y modos NORMAL y STRICT (pp. 6–10).
- **Métricas:** utilidad (tasa de tareas resueltas, con API nativa de tool calling como línea base); número de ataques exitosos y ASR; tasa de activación de políticas; incremento de tokens de entrada y salida frente a tool calling nativo (Tablas 2–4, 8–13).
- **Modelo de amenaza:** el atacante controla datos no confiables que el agente procesa; el prompt del usuario es confiable y la memoria no está comprometida (p. 5). Fuera de alcance: ataques text-to-text sin efecto en el flujo de datos y phishing por prompt injection (p. 5). En el Apéndice E hay una lista de políticas escritas por los autores para cada herramienta (pp. 36–37).
- **Tamaño de muestra:** 949 ataques. Para el análisis de fallos de utilidad, la Tabla 1 (p. 13) reparte 96 tareas de Claude 3.5 Sonnet, de las cuales 62 son correctas. Los intervalos "±" aparecen en las tablas, pero no leí una definición explícita de cómo se calculan.

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Tareas resueltas con CaMeL, según el resumen (con "provable security") | 77% | 1 |
| Tareas resueltas sin defensa, según el resumen | 84% | 1 |
| Ataques totales en la evaluación de seguridad (Figura 9) | 949 | 14 |
| Ataques exitosos, Gemini 2.5 Pro, sin CaMeL (texto de la sección 6.2.1) | 300 | 14 |
| Ataques exitosos, Gemini 2.5 Pro, API nativa de tool calling (overall, Tabla 4) | 163 ± 140.1 | 34 |
| Ataques exitosos, Gemini 2.5 Pro, CaMeL (overall, Tabla 4) | 0 ± 0.0 | 34 |
| Ataques exitosos con CaMeL, Claude 3.5 Sonnet (Tabla 7) | 0 ± 0.0 | 35 |
| Ataques exitosos con la siguiente mejor defensa, tool filter (texto) | 8 | 17 |
| Ataques exitosos, GPT-4o mini con tool calling API (texto) | 276 | 17 |
| Incremento mediano de tokens de entrada con CaMeL (texto) | 2.82× | 19 |
| Incremento mediano de tokens de salida con CaMeL (texto) | 2.73× | 19 |
| Utilidad overall, Claude 4 Sonnet, API nativa frente a CaMeL (Tabla 2) | 86.6% ± 6.8 frente a 74.2% ± 8.7 | 33 |

Nota: la fila de 300 y la de 2.82×/2.73× no coinciden con las tablas. Ver Limitaciones (observación propia).

## Citas textuales
- "CaMeL explicitly extracts the control and data flows from the (trusted) query; therefore, the untrusted data retrieved by the LLM can never impact the program flow." (p. 1)
- "Importantly, CaMeL comes with security guarantees, while all other solutions currently are probabilistic and provide no such guarantees, relying on the agents to make all the important security decisions." (p. 17)
- "No, prompt injection attacks are not fully solved." (p. 24)

## Limitaciones
Reconocidas por los autores:
- Fuera de alcance: ataques que no cambian el flujo de control ni el de datos, como resumir un correo de otra forma o el phishing inducido por prompt injection. El grafo de datos sirve para mostrar el origen del contenido en la interfaz (p. 5).
- CaMeL no es un sistema totalmente autónomo: las consultas ambiguas pueden requerir preguntar al usuario (p. 5).
- Un plan no puede basarse en datos que el P-LLM no puede leer: falla "Data requires action", que afecta 5 tareas de Claude 3.5 Sonnet (Tabla 1, p. 11 y 13).
- Q-LLM no puede indicar qué información le falta, porque eso sería un vector de inyección (p. 12). Las APIs mal documentadas bajan la utilidad, sobre todo en travel: 25% (3.5), 55% (3.7) y 75% (4) en la familia Sonnet (p. 12).
- Sin atomicidad ni rollback: si una herramienta con efectos secundarios falla, no hay forma de deshacerla (p. 10).
- Excepciones como canal lateral: un atacante puede inducir un error condicionado a un dato privado y observar si el programa llega a una llamada posterior (pp. 20–21). Mitigación: modo STRICT, que hace depender de la condición todas las sentencias posteriores a una llamada al Q-LLM (p. 21). El paper dice que esto es una limitación de usar excepciones, no del diseño (p. 21).
- Canal lateral por conteo de llamadas (imagen externa repetida N veces según un dato privado), que el modo STRICT bloquea (pp. 19–20). Canal temporal que no es posible en la implementación actual porque no hay módulo `time` (p. 21).
- Los autores admiten que los canales laterales "undermine the claim of strong security guarantees" en parte (p. 19), aunque su explotación se ve limitada por el ancho de banda (p. 24).
- Ataques que siguen funcionando sin políticas: un ataque de transferencia de 30 000 USD en bancos y un ataque de reseña en travel. Los autores los consideran fuera de alcance, y el segundo no es una inyección (pp. 14–15). Con políticas, el ataque de travel sigue ocurriendo; los autores dicen que su diseño no lo previene, y que las anotaciones de procedencia permiten marcar el texto como no confiable en la interfaz (p. 16).
- Flujo de datos que se vuelve flujo de control: si el agente elige herramientas según el contenido de un correo, un atacante puede dirigir la ejecución sin tocar el plan. El paper lo muestra con Claude 3.5 Sonnet, o3-mini y o1, y lo considera una limitación abierta (pp. 17–18).
- Las políticas las escribe el motor CaMeL, no el usuario (p. 9). El trabajo exige que el usuario mantenga políticas, lo que causa carga y fatiga de confirmaciones (p. 24).
- Las herramientas externas deben entender capacidades; si no, la utilidad se degrada (p. 23).
- El paper no tiene verificación formal; la recomienda como trabajo futuro (p. 25). Dice que "provable security" en el resumen (p. 1), pero el propio cuerpo declara que la verificación formal es un paso pendiente (p. 25).
- CaMeL no se evaluó contra ataques adaptativos. Los autores mencionan que, con prompts adaptativos, otras defensas sí caen (p. 17), pero en el cuerpo que leí no encontré una evaluación adaptativa de CaMeL.
- Costo: 2.82× tokens de entrada y 2.73× de salida para la mediana de tareas, el más alto de las defensas analizadas (p. 19).

Observación propia:
- Discrepancia en el número de ataques de Gemini 2.5 Pro: el texto de la p. 14 dice 300 sin defensa, mientras que la Tabla 4 (p. 34) da 163 ± 140.1. La Tabla 4 también puede corresponder a otra versión del experimento. Conviene no citar la cifra de 300 sin verificar.
- Discrepancia en tokens: el texto (p. 19) y la leyenda de la Figura 13 (p. 18) dan 2.82× de entrada y 2.73× de salida. La Tabla 10 (p. 38) pone 2.73 como mediana de entrada y 2.82 como mediana de salida. Hay que citar con cuidado.
- Los números de "77% frente a 84%" del resumen no aparecen como tal en una tabla. Coinciden con la fila de o3 High de la Tabla 2 (84.5% sin defensa y 77.3% con CaMeL, p. 33), pero el paper no lo dice. Es inferencia mía.
- El "0 ataques" depende del modelo. Con CaMeL sin políticas, Claude 4 Sonnet tiene 13 ataques exitosos y Claude 4 Sonnet con razonamiento tiene 10 (Tabla 4, p. 34). Gemini 2.5 Pro tiene 0. Por eso el resultado cero no generaliza.
- La utilidad cae mucho en algunos modelos. Gemini 2.5 Pro pasa de 73.2% a 41.2% en overall, y de 60.0% a 0.0% en travel (Tabla 2, p. 33). Gemini 2.5 Flash tiene 0.0% en travel con CaMeL.
- Las políticas del Apéndice E (pp. 36–37) las redactaron los autores para AgentDojo. No sé cuánto cambiaría el resultado con políticas escritas por otro equipo.
- El entorno es simulado (AgentDojo). No hay evaluación en correo real ni en flujos de pago reales.

## Qué le sirve a MESH
1. **Etiqueta de procedencia (demostrado en el paper, con matiz).** El paper asigna a cada valor procedencia (usuario, CaMeL o una herramienta concreta) y lectores permitidos, y el intérprete, no el modelo, los propaga (p. 9). Esto respalda decir que la etiqueta "la pone el sistema". Inferencia mía: en MESH la etiqueta "externo" tiene que propagarse entre agentes igual que las capacidades de CaMeL; el paper no tiene un caso multiagente como el de Camila, Mateo y Tomás.
2. **Aprobación por procedencia (respaldado en parte).** CaMeL dice que en una aplicación real las violaciones "will not be blocked, but they will require user confirmation" (p. 11). Eso coincide con el diseño de retención de MESH. La política de envío de dinero de AgentDojo permite el pago si el destinatario viene del usuario, y si no, exige que el destinatario pueda leer todo el mensaje (Apéndice E, p. 36). Inferencia mía: es el análogo más cercano a proteger la cuenta bancaria de un proveedor, y sugiere probar una regla por origen del dato bancario, además del umbral por monto de MESH.
3. **Rutas de riesgo (respaldado en el modelo de amenaza).** El paper describe exactamente el camino que MESH modela: el atacante controla datos que el agente procesa y no el prompt del usuario (p. 5). El ejemplo del Dual LLM muestra que aislar el planificador no basta porque el flujo de datos puede manipularse "analogous to an SQL injection" (p. 3). Inferencia mía: las rutas de MESH son el objeto correcto de análisis; el paper, sin embargo, no calcula rutas, así que esa parte es propia de MESH.
4. **Límite de USD 500 (no lo prueba el paper).** CaMeL no usa montos. Sus políticas son binarias por origen y lectores (pp. 9, 36–37). Esto sugiere que un fraude bajo el límite de USD 500 no lo detiene un monto, sino un origen. Inferencia mía: el resultado propio de MESH (fraudes bajo el umbral que siguen pasando) encaja con este problema, y la regla por origen podría reemplazar o complementar el umbral.
5. **Verificación del remitente (no evaluada en el paper).** El paper no prueba la verificación del remitente. Lo más cercano son las políticas de destinatario que deben venir del usuario (p. 36–37). Inferencia mía: el resultado propio de MESH (verificación sola sin efecto en Haiku) es consistente con la idea de que la procedencia del destinatario, y no el remitente, es lo que decide.
6. **Métrica y frase para el pitch.** Copiar el formato de reporte del paper: ataques exitosos por modelo y defensa, con intervalos, y utilidad con y sin ataque (Tablas 2–4). Para el pitch, la frase con cita es "Importantly, CaMeL comes with security guarantees, while all other solutions currently are probabilistic and provide no such guarantees" (p. 17). Antes de usarla hay que agregar que la verificación formal sigue pendiente (p. 25). Recomiendo decir "evaluado empíricamente" y no "probado", y evitar la palabra "provable" sin matiz.
