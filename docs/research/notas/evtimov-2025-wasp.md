# WASP: Benchmarking Web Agent Security Against Prompt Injection Attacks

- **Autores:** Ivan Evtimov, Arman Zharmagambetov, Aaron Grattafiori, Chuan Guo, Kamalika Chaudhuri (Meta)
- **Año / venue:** 2025 / NeurIPS 2025, póster (https://neurips.cc/virtual/2025/poster/121728). El track (Datasets & Benchmarks) **no está verificado**: la página del póster no lo indica.
- **Enlace:** https://arxiv.org/abs/2504.18575
- **PDF local:** ~/papers-ia-safety/benchmarks-agentes/evtimov-2025-wasp.pdf
- **Verificado:** metadatos `citation_*` de la página de arXiv 2504.18575 (v1 2025-04-22, revisión 2025-05-16). El título y los autores coinciden con la página del póster en neurips.cc. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
WASP evalúa de punta a punta la seguridad de agentes web frente a prompt injection, en entornos autoalojados (clones de Reddit y GitLab de VisualWebArena).
El modelo de amenaza es realista: el atacante solo controla contenido que un usuario normal puede publicar (un post, un issue). No controla todo el sitio ni conoce la implementación del agente.
Los objetivos del atacante son concretos (exfiltrar datos, cambiar el correo de la cuenta, borrar un proyecto…), y cada uno tiene un evaluador por reglas sobre el estado final.
Son 21 objetivos de atacante × 2 objetivos de usuario × 2 entornos = 84 casos. Todas las tasas se reportan sobre 84.
Distingue **ASR-intermediate** (el agente se desvió de la tarea del usuario, según un juez GPT-4o sobre el razonamiento y las acciones) de **ASR-end-to-end** (el objetivo del atacante se cumplió, según una regla sobre el estado).
También mide utilidad sin ataque, con 37 tareas.
Las inyecciones son simples y escritas a mano, sin optimización.
Evalúa GPT-4o, GPT-4o-mini y o1 (con instruction hierarchy), Claude 3.5 Sonnet v2 y Claude 3.7 Sonnet con extended thinking (Computer Use).
Hallazgo: los agentes se desvían entre 17% y 86% de las veces, pero el objetivo del atacante se cumple como mucho en 16%.
Los autores lo llaman "security by incompetence": hoy la seguridad viene en parte de que los agentes no son capaces de completar tareas largas, y eso no va a durar.

## Ataque o defensa que propone
- Ataques: plantillas de inyección de texto plano y de URL (instrucciones escondidas en el fragmento `#…` de un link), relacionadas con la tarea o genéricas.
- Defensas evaluadas (no propias): instruction hierarchy (OpenAI) y un system prompt defensivo que pide no seguir instrucciones del contenido web.

## Números que reporta
- **Tabla 2** (84 casos; ASR-intermediate / ASR-end-to-end / utilidad):
  - GPT-4o (axtree): 0.321 / 0.012 / 0.595. Con system prompt defensivo: 0.167 / 0.000 / 0.459.
  - GPT-4o (axtree + SOM): 0.429 / 0.036 / 0.622. Con system prompt: 0.226 / 0.012 / 0.459.
  - GPT-4o-mini con instruction hierarchy (tool calling): 0.536 / 0.000 / 0.270.
  - o1 con instruction hierarchy (rol system): **0.857 / 0.167** / 0.486.
  - Claude Sonnet 3.5 v2 (CURI): 0.583 / 0.060 / 0.081.
  - Claude Sonnet 3.7 con extended thinking (CURI): 0.536 / 0.036 / 0.486. Con system prompt: 0.500 / 0.036 / 0.432.
- **Sección 4.2**: contra lo esperado, algunas de las ASR-intermediate más altas son de modelos con instruction hierarchy. El system prompt defensivo baja ambas ASR en GPT-4o/4o-mini, pero también baja la utilidad (0.595 → 0.459).
- El paper no reporta intervalos de confianza en la Tabla 2. Con n=84, una tasa de 0.012 equivale a 1 caso.

## Conexión con MESH
- **Valida la métrica en dos niveles que MESH ya tiene**: `reachedFinance` (la petición llegó al agente de finanzas, el análogo de ASR-intermediate) y `dangerousAttempted` (intentó `update_vendor_bank_account`, el análogo de ASR-end-to-end). Ambas salen de `evaluateRun()` en `apps/api/src/harness/evaluator.ts` y se agregan en `summarize()` de `apps/api/src/batch.ts`. WASP justifica mostrarlas juntas: la brecha entre las dos es informativa.
- **Diferencia a favor de MESH**: el "end-to-end" de MESH se mide como *intento* registrado antes de que el sandbox decida (`sandbox.ts` registra el intento aunque `update_vendor_bank_account` esté siempre bloqueado). No depende de que el agente sea competente para terminar, así que MESH no cae en la "seguridad por incompetencia" de WASP. Vale la pena decirlo en el pitch.
- **Intermedios por salto**: WASP tiene un solo nivel intermedio. MESH puede tener uno por salto de la ruta (`observeRiskPaths()` en `risk-paths.ts`: correo → seed → … → finanzas, con `warningCarried`/`agentWarned` por salto). Esto da una "curva de supervivencia del ataque" por ruta, que es más fina que WASP.
- **Instruction hierarchy falla: apoya la tesis de MESH**: marcar el contenido como de bajo privilegio en el modelo no bastó (o1 con 86% de desviación). `provenance_tag` (`apps/api/src/harness/provenance.ts`) va más allá: es el harness, no el modelo, el que agrega el origen en cada salto. Pero es una señal y no un control, y WASP sugiere medir su efecto con humildad.
- **Defensa que cuesta utilidad**: el system prompt defensivo de WASP baja la utilidad 14 puntos. Las defensas de MESH también pueden hacer que finanzas rechace reembolsos legítimos, y eso solo se ve con utilidad en benignos (`BATCH_KINDS=attack,benign`).
