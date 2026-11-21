# How Microsoft defends against indirect prompt injection attacks

- **Autores:** Andrew Paverd (Microsoft Security Response Center, MSRC)
- **Año / venue:** 2025, blog del MSRC, 29-07-2025
- **Enlace:** https://www.microsoft.com/en-us/msrc/blog/2025/07/how-microsoft-defends-against-indirect-prompt-injection-attacks
- **PDF local:** página web, sin PDF
- **Verificado:** leí la página oficial en microsoft.com con WebFetch: título, autor, fecha y descripción de cada defensa. Paverd también es coautor del paper de design patterns (arXiv:2506.08837). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
El MSRC explica cómo Microsoft defiende sus productos de IA (por ejemplo, Copilot) frente a la prompt injection indirecta.
Distingue entre defensas probabilísticas, que bajan la probabilidad de éxito, y deterministas, que garantizan que un ataque concreto no funcione.
Prefiere las deterministas cuando es posible, pero reconoce que detectar la inyección de forma determinista sigue siendo un problema abierto.
Organiza las defensas en tres grupos: prevención, detección y mitigación del impacto.
Prevención: system prompts y "Spotlighting", que marca el texto externo para que el modelo lo distinga de las instrucciones.
Spotlighting tiene tres modos: delimitadores aleatorios, "datamarking" (un token intercalado en todo el texto no confiable) y codificación (base64/ROT13).
Detección: Prompt Shields, un clasificador probabilístico multilingüe integrado con Defender for Cloud.
Mitigación: gobierno de datos (etiquetas de Purview, DLP), bloqueo determinista de vías de exfiltración (imágenes markdown, enlaces) y consentimiento explícito del usuario.
En "Draft with Copilot" de Outlook el usuario aprueba el texto y envía el correo él mismo.
Como investigación cita TaskTracker (activaciones internas), FIDES (control de flujo de información determinista), LLMail-Inject y los design patterns.

## Ataque o defensa que propone
- **Defensa en profundidad:** combina Spotlighting y system prompts (probabilístico), Prompt Shields (probabilístico) y, como capa determinista, permisos, DLP, bloqueo de exfiltración y consentimiento humano.
- **FIDES:** "an approach for deterministically preventing indirect prompt injection in agentic systems", basado en control de flujo de información (Costa et al., arXiv:2505.23643; no lo leí).

## Números que reporta
- **3 modos** de Spotlighting.
- LLMail-Inject: **más de 800 participantes** y **más de 370.000 prompts** en el dataset abierto.
- Menciona que la prompt injection es el primer riesgo del OWASP Top 10 for LLM Applications 2025.
- No da tasas de efectividad de sus defensas en este post. El paper base de Spotlighting (Hines et al., arXiv:2403.14720) sí reporta reducciones, pero no lo verifiqué.

## Conexión con MESH
- **`provenance_tag` es un primo de Spotlighting:** `provenanceTag()` en `apps/api/src/harness/provenance.ts` agrega una marca `[provenance]` al final del mensaje y cita el `From:` entre comillas JSON (`quoteUntrusted`). Spotlighting "datamarking" marca todo el texto no confiable, no solo el final. Idea: un fix `datamark` en `apps/api/src/harness/fixes.ts` que, cuando un agente reenvía contenido del correo, intercale un marcador en los fragmentos citados. Se compara la tasa de `attack_succeeded` con la del tag al final. Las dos son probabilísticas, y así hay que presentarlas.
- **La clasificación probabilística/determinista se puede reutilizar en la UI:** cada fix del catálogo `FIXES` (fixes.ts) se etiquetaría como `kind: "probabilistic" | "deterministic"`. `sender_check` es determinista en su veredicto (`apps/api/src/email/sender-check.ts`), pero su efecto depende de que el modelo lo respete. `provenance_tag` es probabilístico. El sandbox (`apps/api/src/harness/sandbox.ts`) es determinista. En `analyzeRiskPaths()` (`apps/api/src/harness/risk-paths.ts`), una ruta solo debería quedar como `low` si la cubre al menos una barrera determinista.
- **El consentimiento humano como mitigación del impacto:** es el mismo patrón que Google (confirmación) y Meta (supervisión cuando se necesitan [A][B][C]). En MESH, `escalate_to_human` (`apps/api/src/mcp/server.ts`) ya existe como salida inerte. Falta que el harness lo exija para los sinks cuando hay taint.
- **FIDES (control de flujo de información) es la versión académica de la propagación de taint** que proponemos para las rutas de riesgo: etiquetar datos con su confidencialidad e integridad y prohibir que datos de baja integridad (el correo externo) alimenten acciones de alta integridad (el pago).
