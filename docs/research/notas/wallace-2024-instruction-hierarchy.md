# The Instruction Hierarchy: Training LLMs to Prioritize Privileged Instructions

- **Autores:** Eric Wallace, Kai Xiao, Reimar Leike, Lilian Weng, Johannes Heidecke, Alex Beutel (OpenAI)
- **Año / venue:** 2024. Preprint arXiv:2404.13208 (v1, 19-abr-2024). Venue revisado por pares: no verificado (la página de arXiv no indica ninguno).
- **Enlace:** https://arxiv.org/abs/2404.13208
- **PDF local:** ~/papers-ia-safety/inyeccion-indirecta/wallace-2024-instruction-hierarchy.pdf
- **Verificado:** título, 6 autores y fecha en arxiv.org/abs/2404.13208 y en la cabecera del PDF. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Sostienen que la vulnerabilidad de fondo detrás de inyecciones, jailbreaks y extracción de prompts es que el LLM trata con la misma prioridad el texto del desarrollador, el del usuario y el de terceros.
Proponen una *jerarquía de instrucciones*: System Message (desarrollador) > User Message > Model Output > Tool Output (búsquedas, APIs, contenido de terceros).
Las instrucciones de menor privilegio se siguen si están "alineadas" con las de mayor privilegio y se ignoran si están "desalineadas" o en conflicto.
Para enseñarlo generan datos sintéticos: *context synthesis* para instrucciones alineadas (se descomponen y se reparten por niveles) y *context ignorance* para las desalineadas (el modelo debe responder como si no las hubiera visto).
Hacen fine-tuning de GPT-3.5 Turbo con SFT y RLHF y lo comparan con un modelo base entrenado igual pero sin datos de jerarquía.
La robustez sube en todas las evaluaciones, incluidas inyecciones indirectas vía navegación y vía herramientas.
Generaliza a ataques no vistos en entrenamiento (jailbreaks, extracción de contraseñas, inyección vía herramientas).
Las capacidades generales (TriviaQA, LAMBADA, HellaSwag) no se degradan.
Costo observado: algo de *sobre-rechazo*; el modelo a veces ignora instrucciones benignas de menor privilegio.
Plantean como trabajo futuro extender la jerarquía a entradas multimodales y a arquitecturas que separen privilegios en el modelo.

## Ataque o defensa que propone
Defensa a nivel de modelo (entrenamiento): asignar privilegio según el *rol o canal* por el que llega el texto, y entrenar al modelo para ignorar instrucciones de menor privilegio en conflicto. El contenido de terceros (Tool Output) queda en el nivel más bajo.

## Números que reporta
Robustez (%; más alto es mejor), modelo base → modelo con jerarquía, GPT-3.5 Turbo afinado:
- **Figura 2 (principales):** Prompt Injection Hijacking **59,2 → 79,2**; New Instructions **89,6 → 93,7**; User Conflicting Instructions **62,2 → 92,6**; **inyección indirecta vía navegación 77,5 → 85,0**; System Message Extraction **32,8 → 95,9**.
- **Figura 3 (generalización, no entrenado):** **inyección indirecta vía herramientas 77,6 → 87,0**; TensorTrust Password Extraction **53,8 → 84,2**; Gandalf **51,8 → 73,7**; Jailbreakchat **83,8 → 89,2**; ChatGPT Jailbreaks **37,4 → 71,2**.
- Texto (Sección 4): mejora de hasta **63%** en las evaluaciones principales y de hasta **34%** en generalización.
- **Figura 4 (sobre-rechazo):** cumplimiento con instrucciones benignas casi igual al base en la mayoría, con regresiones en "System Message Probing Questions" y "Jailbreakchat with Allowed Prompts".
- Nota: aun con la jerarquía, ~13–15% de las inyecciones indirectas siguen teniendo éxito en sus evaluaciones.
- Nota: los pares de valores se leyeron del gráfico de barras del PDF; el orden base/jerarquía se dedujo de que el texto dice que la jerarquía mejora en todas.

## Conexión con MESH
- **El hallazgo más importante para MESH: la jerarquía depende del canal, y en MESH el canal miente.** En `createSession()` (`apps/api/src/harness/agent-runner.ts`) el correo externo entra en el primer mensaje con rol `user`, rotulado "Initial instruction / scenario". Según Wallace, ese es el nivel de privilegio del usuario, no el de Tool Output. El harness le da al correo del atacante más privilegio del que merece.
- **Peor en el salto 2:** el agente de finanzas recibe el pedido como `tool_result` de `read_inbox`, con `from` = un id de agente interno. En la jerarquía es Tool Output, pero su contenido viene de un colega con el que el sistema le dice que colabore (`systemPrompt()` lista a los peers). La jerarquía no tiene un nivel para "un agente interno que repite algo externo": es el hueco de procedencia que mide `risk-paths.ts`.
- **Valida el diseño de `provenance_tag`:** la jerarquía funciona si el modelo sabe de dónde viene cada texto. `provenanceTag()` (`apps/api/src/harness/provenance.ts`) devuelve esa información, pero dentro del mismo string `body`. Idea concreta: pasar el origen como campo estructurado en la respuesta de `read_inbox` (p. ej. `origin: { external: true, from, senderVerdict }`), fuera del texto que escribe el agente, para que no se pueda falsificar desde el cuerpo.
- **Idea concreta (fix `email_as_tool_output`):** que el seed no reciba el correo en el turno `user`, sino al llamar a una herramienta `read_email` (como `tool_result`). Es el canal que Claude está entrenado a tratar como dato. Cambios en `createSession()` y `handleTool()` de `agent-runner.ts`, y en `emailScenarioHint()` de `apps/api/src/email/scenarios.ts`. Medir `attack_succeeded` en `apps/api/src/batch.ts`.
- **Sobre-rechazo:** el costo de la jerarquía es rechazar pedidos benignos. MESH ya tiene correos benignos (`kind` benign o `real_email` en `email-harness/scenarios/*.json`, `BATCH_KINDS=attack,benign`). Cualquier fix nuevo debería reportar ASR *y* tasa de acción legítima bloqueada.
