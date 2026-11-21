# MCPTox: A Benchmark for Tool Poisoning Attack on Real-World MCP Servers
- **Autores:** Zhiqiang Wang, Yichao Gao, Yanting Wang et al. · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2508.14925 · **Tema:** Tool Poisoning (inyección de instrucciones en la descripción de herramientas MCP); benchmark de robustez de agentes LLM
- **Cobertura de lectura:** páginas 1–9, completo (texto extraído del PDF, incluidas referencias). Las Tablas 2 y 3 salieron legibles en el texto, así que no fue necesario abrir el PDF. Figura 6 solo se usó en su texto descriptivo, sin valores numéricos propios.

## Resumen
El Model Context Protocol (MCP) estandariza que los agentes LLM descubran y usen herramientas externas, y los nombres y descripciones de esas herramientas se cargan en el contexto del agente al registrarse. Los autores estudian Tool Poisoning: instrucciones maliciosas escritas dentro de la descripción de una herramienta, que se leen sin que la herramienta se ejecute. Hasta ahora este riesgo estaba documentado solo con casos aislados. Para medirlo construyen MCPTox, un benchmark sobre 45 servidores MCP reales con 353 herramientas, con 1348 casos de prueba generados por few-shot con GPT-4 y Gemini-2.5 y revisados a mano, en 3 paradigmas de ataque. Evalúan 20 agentes LLM y encuentran ataques exitosos en todos los grupos: el ASR más alto es 72.8% (o1-mini) y el promedio general es 36.5%. Los modelos más capaces resultan a menudo más vulnerables, y casi no rechazan: el mayor porcentaje de rechazo es menos de 3% (Claude-3.7-Sonnet). Adaptar payloads de inyección indirecta (InjecAgent) a descripciones de herramientas baja el ASR a casi 0%, lo que según los autores muestra que hace falta un benchmark específico para MCP. Concluyen que se necesita un mecanismo de seguridad previo a la ejecución.

## Método
- **Modelo de amenaza:** un atacante registra un servidor MCP malicioso con una herramienta que parece útil. Su descripción contiene una regla oculta. La acción final la ejecuta una herramienta legítima del mismo servidor de alto privilegio, y la herramienta envenenada nunca se ejecuta (p. 2 y p. 4). El usuario hace una consulta benigna.
- **Paradigmas de ataque (Tabla 1, p. 4):** P1 Explicit Trigger–Function Hijacking (la herramienta imita una función común, p. ej. get time); P2 Implicit Trigger–Function Hijacking (se activa con una acción relacionada, p. ej. operar archivos); P3 Implicit Trigger–Parameter Tampering (cambia un parámetro de una herramienta legítima, p. ej. el destinatario de un correo).
- **Dataset (p. 2–4):** 45 servidores MCP reales de 8 dominios de aplicación, 353 herramientas auténticas y 1348 casos de prueba en 11 categorías de riesgo (p. ej. Privacy Leakage, Message Hijacking). Cada caso es (consulta benigna Q, herramienta envenenada Tp). Generación: few-shot con GPT-4 y Gemini-2.5, luego revisión manual para comprobar que la acción la puede hacer una herramienta legítima del servidor y que no hay parámetros inventados.
- **Agentes (p. 5):** 20 agentes LLM de las familias o1, Qwen, Llama, GPT, Gemini, DeepSeek, Claude, Phi (y otras como Gemma y Mistral en la Tabla 2). Qwen3 se evalúa con y sin razonamiento, y el paper cuenta 20 configuraciones de modelo.
- **Protocolo (p. 5):** se inserta la herramienta envenenada y la lista completa de herramientas legítimas en el prompt de sistema del agente, se envía la consulta y se registra qué herramienta llama y con qué parámetros. El pipeline MCP es el código abierto de Model Context Protocol, con su prompt de sistema sin cambios.
- **Etiquetas (p. 5):** Success; Failure–Ignored; Failure–Direct Execution (llama a la herramienta envenenada, lo que los autores consideran no sigiloso); Failure–Refused.
- **Métricas (p. 5):** ASR = ataques exitosos / salidas válidas (los autores descuentan las salidas inválidas). Refused Ratio = rechazos / salidas válidas.
- **Ajustes extra (p. 6–7):** dos "Enhanced Settings" que anteponen a la instrucción maliciosa frases de hijacking clásicas (<IMPORTANT>…</IMPORTANT> e "Ignore all previous instructions"). Comparación con InjecAgent: payloads de IPI puestos en la descripción de la herramienta (p. 5–6). AgentDojo solo se discute como benchmark relacionado; no se adaptan sus payloads.

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Servidores MCP reales construidos sobre el benchmark | 45 | p. 1 |
| Herramientas auténticas en el benchmark | 353 | p. 1 |
| Casos de prueba maliciosos | 1348 | p. 1 |
| Agentes LLM evaluados | 20 | p. 1 |
| ASR de o1-mini (ataque exitoso, "attack success rate") | 72.8% | p. 1 |
| ASR promedio de todas las configuraciones de modelo | 36.5% | p. 5 |
| Rechazo máximo (Claude-3.7-Sonnet) | less than 3% (menos de 3%) | p. 7 |
| ASR promedio del paradigma Implicit Trigger–Parameter Tampering (P3) | 46.7% | p. 7 |
| ASR promedio del paradigma Implicit Trigger–Function Hijacking (P2), el más bajo | 26.7% | p. 7 |
| Porcentaje de fallos que son Direct Execution | 18.9% | p. 7 |
| Qwen3-8b con razonamiento (Tabla 3): ASR en MCPTox vs. InjecAgent | 41.8% vs. 0.1% | p. 6 |
| Claude-3.7-sonnet, columna Avg de la Tabla 2 (ASR, %) | 34.3 | p. 6 |

## Citas textuales
1. "where malicious instructions are embedded within a tool’s metadata without execution." (p. 1)
2. "we label a test case as successful only when the LLM agent is manipulated into calling a legitimate tool on the MCP server to complete the malicious action specified in the poisoned tool’s description." (p. 2)
3. "This provides strong evidence that existing safety alignment mechanisms are insufficient against Tool Poisoning." (p. 7)

## Limitaciones
**Reconocidas por los autores:**
- Los payloads se generan con un proceso semi-automático guiado por paradigmas definidos por humanos. Los autores dicen que es común en benchmarks de inyección de prompts y que los ataques no están optimizados contra una defensa concreta. Proponen como trabajo futuro ataques automatizados y adaptativos (p. 7).
- Algunos agentes producen muchas salidas inválidas. Por eso el ASR se calcula sobre salidas válidas, lo que cambia el número frente a un denominador total (p. 5).
- Riesgo de doble uso: divulgar las vulnerabilidades puede facilitar su mal uso (consideraciones éticas, p. 8).

**Observación propia:**
- El éxito se define como que el agente llame a la herramienta legítima con la acción maliciosa (p. 2). El paper no ejecuta ni mide el daño real (por ejemplo, una exfiltración efectiva o un pago hecho), así que el ASR mide intención de llamada, no impacto.
- Cada caso tiene un solo servidor envenenado y un solo turno de usuario. No hay cadenas de agentes, reenvíos entre agentes ni aprobación humana, así que el benchmark no cubre rutas multiagente.
- Inconsistencia interna: el abstract (p. 1) dice "10 categories of potential risks", pero el cuerpo (p. 2) dice "11 distinct risk categories".
- La columna Avg de la Tabla 2 (p. 6) no es el promedio aritmético de las celdas de la fila (por ejemplo, en Claude-3.7-sonnet no coincide con la media de sus 9 celdas), y el paper no explica cómo se calcula.
- El paper no explica quién ni cómo asigna las cuatro etiquetas de resultado (p. 5).
- No se reportan repeticiones, varianza ni intervalos de confianza en el texto. Con n por modelo no explicitado, las diferencias de unos pocos puntos no son concluyentes.
- Solo hay un modelo Claude en la tabla principal (Claude-3.7-sonnet), así que la conclusión sobre el rechazo de Claude se apoya en un modelo.
- El prompt de sistema no se modificó (p. 5), y no se evalúa la sensibilidad de los resultados a ese prompt.
- Las defensas de la Discusión (sanitización de metadatos, validación de la llamada contra la intención del usuario, auditoría del razonamiento; p. 7) se proponen, pero no se evalúan.
- Discrepancia de fecha: la copia del PDF lleva el sello "arXiv:2508.14925v2 … 29 Sep 2026" y copyright AAAI 2026. Esta nota usa el año 2025 de la fila verificada en papers.md.
- El texto extraído tiene un error tipográfico en la Tabla 3 ("14.%" para Qwen3-8b en MCPTox). No se usó ese valor.

## Qué le sirve a MESH
1. **Respalda la idea central "cada componente pasa su revisión, pero la ruta falla" (demostrado parcialmente).** El paper demuestra que el ataque usa solo herramientas legítimas y que la herramienta envenenada nunca se ejecuta (p. 2 y p. 4). Inferencia mía: por eso una revisión herramienta por herramienta no vería el daño. Además: el control útil es el de la ruta completa (origen → agentes → acción), que es lo que MESH calcula con las rutas de riesgo.
2. **Apoya la aprobación por procedencia, pero no la prueba (demostrado vs. inferencia).** El paper muestra que los modelos casi no rechazan (menos de 3%, p. 7) y que el paradigma de mayor ASR es modificar un parámetro de una herramienta legítima (P3, 46.7%, p. 7). Inferencia mía: un control que mira la intención del usuario o el origen del dato (como approval_gate) cubre esa clase de ataque. El paper no evalúa ninguna defensa, así que no da evidencia de su eficacia.
3. **Sobre el límite de USD 500 (inferencia).** El paper no tiene montos. Sí muestra que P3 (cambiar un parámetro dentro de una llamada que parece normal) es el paradigma más eficaz. El paper dice que probablemente es más difícil de detectar, porque "the primary function call remains consistent with the user’s intent" (p. 7). Inferencia mía: un umbral por monto no basta si el atacante puede cambiar el destinatario o la cuenta sin cambiar el monto. Esto encaja con los fraudes bajo USD 500 que MESH sigue observando. Debe presentarse como consistente con el paper, no como resultado del paper.
4. **Verificación del remitente (sin evidencia directa).** MCPTox no mide remitentes. Su disparador es la descripción de la herramienta. Inferencia mía: como el paper dice que el ataque no activa los filtros de contenido sino el uso legítimo de una herramienta de confianza (p. 7), es consistente con el hallazgo de MESH de que la verificación del remitente sola no cambió el resultado. Sin embargo, no hay que citar el paper como prueba de eso.
5. **Métricas para copiar (demostrado).** ASR sobre salidas válidas, Refused Ratio y las cuatro etiquetas (Success, Ignored, Direct Execution, Refused; p. 5). MESH puede reportar sus resultados con la misma taxonomía, y la categoría Direct Execution sirve para contar cuándo el modelo se deja manipular pero no es sigiloso.
6. **Frase para el pitch (cita textual del paper).** "This provides strong evidence that existing safety alignment mechanisms are insufficient against Tool Poisoning." (p. 7). Para cifras: "agents rarely refuse these attacks, with the highest refused rate (Claude-3.7-Sonnet) less than 3%" (p. 1), y 72.8% para o1-mini (p. 1). Recordar que son benchmarks de un solo turno y sin multiagente.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 63 · corregidas: 4 · eliminadas: 0.
- Correcciones:
  - Ajustes extra: la nota decía que se comparó con InjecAgent y AgentDojo; el paper solo adapta payloads de InjecAgent (§4.3, p. 5–6). AgentDojo solo se discute.
  - Qué le sirve a MESH, punto 1: la frase "una revisión herramienta por herramienta no ve el daño" era inferencia no marcada; ahora está marcada como "Inferencia mía".
  - Qué le sirve a MESH, punto 3: la cita "the call remains consistent with the user’s intent" no es literal; corregida a "the primary function call remains consistent with the user’s intent" (p. 7).
  - Qué le sirve a MESH, punto 3: el paper dice que P3 "probablemente" es más difícil de detectar ("likely more difficult"), no que lo demuestre; ahora está con esa formulación.
- Pendiente: Nada.
