# Design Patterns for Securing LLM Agents against Prompt Injections

- **Autores:** Luca Beurer-Kellner, Beat Buesser, Ana-Maria Creţu, Edoardo Debenedetti, Daniel Dobos, Daniel Fabian, Marc Fischer, David Froelicher, Kathrin Grosse, Daniel Naeff, Ezinwanne Ozoani, Andrew Paverd, Florian Tramèr, Václav Volhejn (lista completa: 14 autores). La v3 en arXiv dice "Luca Beurer-Kellner and 13 other authors". Las afiliaciones son Invariant Labs, IBM, EPFL, ETH Zurich, Google, Microsoft, Swisscom, entre otras.
- **Año / venue:** 2025, preprint en arXiv (cs.LG/cs.CR), arXiv:2506.08837. La v1 es del 10-06-2025 y la v3 del 27-06-2025.
- **Enlace:** https://arxiv.org/abs/2506.08837
- **PDF local:** ~/papers-ia-safety/bec-y-patrones/beurer-kellner-2025-design-patterns.pdf (v3, 32 pp.)
- **Verificado:** página de arXiv y PDF v3 leído con `pdftotext`. El principio rector está en la p. 4 y el caso "Email and Calendar Assistant" en la §4.3, pp. 14-17. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
El paper parte de una premisa: no existe hoy una defensa general y confiable contra la prompt injection en agentes con herramientas.
Por eso pregunta qué agentes útiles se pueden construir hoy que resistan la inyección por diseño, y no por la buena voluntad del modelo.
El principio común: una vez que un agente ingirió input no confiable, debe quedar restringido de modo que ese input no pueda disparar acciones con consecuencias (p. 4).
Proponen seis patrones: Action-Selector, Plan-Then-Execute, LLM Map-Reduce, Dual LLM, Code-Then-Execute y Context-Minimization.
Todos aíslan los datos no confiables del flujo de control del agente, a cambio de quitarle algo de generalidad.
Aplican los patrones a diez casos de estudio, entre ellos un asistente de correo y calendario, un chatbot de atención, un agente SQL y un agente de ingeniería de software.
Cada caso parte de un diseño ingenuo vulnerable y propone diseños más robustos, evaluando utilidad y seguridad.
Separan los patrones de las "buenas prácticas" que todo agente debería tener (Apéndice A): sandbox de acciones, confirmación del usuario, mínimo privilegio.
Advierten que los patrones dan garantías sobre la elección de acciones, pero no siempre sobre sus parámetros.
Es un trabajo de consorcio (industria y academia) y lo citan Microsoft (MSRC), Simon Willison y Meta.

## Ataque o defensa que propone
- **Defensa:** patrones arquitectónicos con garantías estructurales.
  - *Action-Selector:* el LLM solo elige entre acciones fijas y nunca ve la respuesta de las herramientas.
  - *Plan-Then-Execute:* el plan se fija antes de leer datos no confiables, lo que da integridad de flujo de control.
  - *Map-Reduce:* cada documento no confiable lo procesa un sub-LLM aislado que devuelve un resultado acotado.
  - *Dual LLM:* un LLM privilegiado con herramientas que nunca lee datos no confiables, más un LLM en cuarentena sin herramientas que los procesa y devuelve variables simbólicas.
  - *Code-Then-Execute:* estilo CaMeL; el LLM escribe un programa que manipula los datos como variables.
  - *Context-Minimization:* se elimina el prompt no confiable del contexto antes de seguir.
- **Ataque relevante (§4.3):** el atacante envía un correo al asistente. Entre sus objetivos está "enviar un correo al compañero de trabajo de la víctima pidiéndole que apruebe una acción sensible o ignore una alerta" (p. 15).

## Números que reporta
No reporta métricas experimentales: es un paper de diseño y análisis cualitativo. Las cantidades son estructurales: **6 patrones** y **10 casos de estudio** (Tabla 1, p. 9). Hay una cita clave para MESH en §4.3, p. 16: es tentador considerar "relativamente seguro" un correo a un destinatario de la misma organización, pero eso "no mitigaría" el objetivo de pedirle a un colega que apruebe una acción sensible.

## Conexión con MESH
- **Valida la tesis casi palabra por palabra:** el paper advierte que el mensaje interno no es seguro porque el atacante puede usar al agente para pedirle algo a un colega. Es exactamente la ruta email → seed → agente de finanzas que calcula `analyzeRiskPaths()` en `apps/api/src/harness/risk-paths.ts`. El check `separation` ("el agente que lee el correo no puede pagar") pasa, pero el principio del paper (restringir a todo agente que ingirió input no confiable) se viola en cuanto el seed reenvía con `send_message` (`apps/api/src/harness/agent-runner.ts`).
- **Chequeo determinista derivado (principio p. 4):** en risk-paths.ts, propagar una marca `tainted` por cada salto `peer_message` (hoy todos pueden escribir a todos, así que la marca llega a cualquier agente alcanzable desde el seed) y fallar la ruta si el nodo final tiene herramientas con consecuencias (`issue_refund`, `update_vendor_bank_account`) sin una barrera de por medio. Las barreras serían aprobación humana, bloqueo por taint en `apps/api/src/harness/sandbox.ts` o un patrón Dual LLM.
- **Idea de arquitectura, el seed como "LLM en cuarentena" (Dual LLM / Map-Reduce):** el seed no reenvía texto libre, solo un objeto estructurado (por ejemplo, `{vendor_id, change_requested: true, source: "external_email"}`) que el harness valida. Se puede probar como un fix nuevo en `apps/api/src/harness/fixes.ts`, `structured_handoff`, y comparar `attack_succeeded` frente a `provenance_tag` con el evaluador (`apps/api/src/harness/evaluator.ts`).
- **Ya existe una de sus buenas prácticas:** el sandbox deny-by-default (`DEFAULT_ALLOWED` en sandbox.ts) corresponde al "action sandboxing" del Apéndice A, y `escalate_to_human` en `apps/api/src/mcp/server.ts` es una salida para la "confirmación del usuario".
