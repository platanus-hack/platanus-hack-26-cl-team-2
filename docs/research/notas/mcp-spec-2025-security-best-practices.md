# Security Best Practices (Model Context Protocol specification)

- **Autores:** proyecto Model Context Protocol (mantenedores de la especificación; documento originado en Anthropic). Sin autor individual.
- **Año / venue:** especificación oficial en modelcontextprotocol.io. Leí la versión **draft** (menciona la versión de protocolo `2026-07-28`). La página enlaza la versión del `2025-11-25`. También leí la spec `2025-11-25`: página principal ("Security and Trust & Safety") y página de Tools ("Security Considerations").
- **Enlace:** https://modelcontextprotocol.io/specification/draft/basic/security_best_practices · https://modelcontextprotocol.io/specification/2025-11-25 · https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- **PDF local:** página web, sin PDF
- **Verificado:** lectura directa de las tres páginas oficiales con WebFetch (títulos, secciones y frases MUST/SHOULD citadas). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
La página "Security Best Practices" complementa la spec de autorización. Se dirige a quienes implementan OAuth, operan servidores y evalúan seguridad.
Los ataques que cubre son de infraestructura y autorización: Confused Deputy (proxy OAuth con client ID estático), Token Passthrough (prohibido),
SSRF en el descubrimiento OAuth, State Handle Hijacking, compromiso de servidores MCP locales, validación de URLs de autorización (XSS/RCE),
stdio en arquitecturas proxy, mix-up attacks, suplantación de redirect URI en localhost, políticas de confianza CIMD y minimización de scopes.
**No trata la prompt injection, el tool poisoning ni el uso indebido de herramientas legítimas.**
Eso aparece solo como principio general en la spec principal ("Tool Safety"): "descriptions of tool behavior such as annotations should be considered untrusted, unless obtained from a trusted server",
y "Hosts must obtain explicit user consent before invoking any tool".
La página de Tools agrega: "there SHOULD always be a human in the loop with the ability to deny tool invocations".
También agrega que los clientes SHOULD pedir confirmación en operaciones sensibles, mostrar los inputs antes de llamar al servidor y validar los resultados antes de pasarlos al LLM.
A los servidores les exige (MUST) validar inputs, aplicar control de acceso, limitar la tasa de invocaciones y sanitizar outputs. La spec admite que "MCP itself cannot enforce these security principles at the protocol level".

## Ataque o defensa que propone
Las defensas normativas relevantes para MESH son:
- Tools: un humano en el loop que pueda denegar invocaciones (SHOULD).
- Tools: confirmación del usuario en operaciones sensibles (SHOULD).
- Tools: mostrar los inputs de la herramienta antes de llamarla (SHOULD).
- Tools: el servidor valida inputs y aplica control de acceso (MUST).
- Las anotaciones de herramientas son no confiables salvo que vengan de un servidor confiable (MUST, página de Tools).
- Scope minimization: privilegio mínimo progresivo y elevación incremental.
- Confused Deputy: consentimiento por cliente (MUST), aunque en el sentido OAuth, no en el sentido semántico de agentes.

## Números que reporta
No reporta números. Es una especificación normativa con requisitos MUST/SHOULD.

## Conexión con MESH
- **Valida la tesis por omisión.** Un servidor MCP puede cumplir toda la página de Security Best Practices (OAuth correcto, sin token passthrough, sin SSRF, stdio, scopes mínimos) y aun así ejecutar un BEC. El ataque de MESH no rompe ningún control de protocolo: entra como el texto de un correo legítimamente leído (`read_email` en `apps/api/src/mcp/server.ts`) y sale como una llamada válida a una herramienta autorizada. Es la frase del pitch hecha norma: la spec revisa componentes (transporte, tokens, consentimiento) y la ruta semántica queda fuera de alcance.
- **"Confused deputy" tiene dos sentidos:** el de la spec es OAuth. El de MESH es semántico (el agente de finanzas actúa con su privilegio por pedido de un correo externo). OWASP ASI03 cubre el segundo. Conviene aclararlo en el pitch para que no suene a lo mismo.
- **Cumplimiento actual de `server.ts`:** usa transporte stdio (lo que la spec recomienda para servidores locales). Valida inputs con zod antes del handler (MUST). El control de acceso de `update_vendor_bank_account` lo decide el servidor (MUST "proper access controls"). Registra cada intento (`MESH_MCP_LOG`).
- **Idea concreta:** `quick-test.ts` hoy hace de cliente MCP sin confirmación humana, que es el peor caso que la spec desaconseja con un SHOULD. Se podría agregar un modo de cliente `QUICK_HITL=deny-sensitive` que simule un humano que rechaza las llamadas peligrosas y le devuelve al agente "denied by user". Mediría si el agente reintenta por otra ruta (por ejemplo `issue_refund`) o escala. Eso cuantifica cuánto aporta el "SHOULD human in the loop" de la spec y cuánto se escapa por rutas alternativas.
