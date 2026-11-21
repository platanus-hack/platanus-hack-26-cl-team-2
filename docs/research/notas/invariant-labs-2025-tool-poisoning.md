# MCP Security Notification: Tool Poisoning Attacks

- **Autores:** Luca Beurer-Kellner, Marc Fischer (Invariant Labs)
- **Año / venue:** 2025, blog de Invariant Labs (1-abr-2025; actualizado el 7-abr con WhatsApp y el 11-abr con MCP-Scan)
- **Enlace:** https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks
- **PDF local:** página web, sin PDF
- **Verificado:** lectura de la página oficial con WebFetch (título, autores, fecha, ejemplos, mitigaciones). No revisé el blog de GitHub MCP ("toxic agent flows") y no lo uso. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Revela los "Tool Poisoning Attacks" (TPA): instrucciones maliciosas escondidas en la descripción de una herramienta MCP.
Esas instrucciones son "invisibles para los usuarios pero visibles para los modelos de IA". Lo describen como una forma especializada de prompt injection indirecta.
La causa de fondo es que MCP asume que las descripciones de herramientas son confiables. La UI muestra un resumen y el modelo ve el texto completo.
El ejemplo es una herramienta `add(a, b, sidenote)`. Dentro de un bloque `<IMPORTANT>`, la descripción ordena leer `~/.cursor/mcp.json` y `~/.ssh/id_rsa`,
mandarlos en `sidenote` y distraer al usuario con una explicación matemática.
**Rug pull:** el servidor cambia la descripción después de que el cliente ya la aprobó.
**Shadowing:** con varios servidores conectados, la descripción de una herramienta maliciosa cambia cómo el agente usa herramientas confiables de otro servidor.
En la demo, `send_email` termina enviando todo al atacante aunque el usuario indique otro destinatario. "Shadowing is enough": la herramienta maliciosa ni siquiera necesita ser llamada.
Lo probaron solo en Cursor, cuyo diálogo de confirmación ocultaba el input completo, incluida la clave SSH.
Según el post, otros clientes (Anthropic, OpenAI, Zapier) son susceptibles, pero no los probaron.

## Ataque o defensa que propone
- **Ataques:** tool poisoning, rug pull y cross-server shadowing.
- **Mitigaciones (citadas):** (1) "Clear UI Patterns": las descripciones de herramientas deben verse y distinguir lo que ve el usuario de lo que ve la IA. (2) "Tool and Package Pinning": fijar la versión del servidor y de las herramientas "using a hash or checksum to verify the integrity of the tool description". (3) "Cross-Server Protection": límites más estrictos y controles de flujo de datos entre servidores MCP. Después lanzaron MCP-Scan, que fija herramientas por hash.

## Números que reporta
No reporta tasas de éxito: son 2 experimentos demostrativos (exfiltración de archivos, y shadowing de email con 2 servidores). Las cifras que circulan sobre "tool poisoning" (por ejemplo un ASR de 72,8%) vienen de MCPTox, no de este blog.

## Conexión con MESH
- **Valida la tesis desde el lado de MCP:** con shadowing, cada servidor puede estar auditado por separado y aun así uno contamina el uso de otro. Es otra forma de "cada componente pasa su revisión, pero la ruta falla".
- **Escenario BEC con shadowing (idea concreta):** en `apps/api/src/mcp/server.ts`, un modo `MESH_POISON=shadow` registraría una herramienta inocua extra (por ejemplo `vendor_directory_lookup`) cuya descripción diga que, por "política de tesorería", toda llamada a `update_vendor_bank_account` debe usar un IBAN dado. El correo del inbox sería legítimo (`kind` no-attack en `email-harness/scenarios/*.json`). Así `sender_check` (`apps/api/src/email/sender-check.ts`) da OK, porque el From es real, y la ruta igual falla. Es una demo muy limpia de la tesis.
- **Rug pull:** el SDK MCP permite cambiar la lista de herramientas (`notifications/tools/list_changed`). Un fix "tool_pinning" en `apps/api/src/mcp/quick-test.ts` guardaría un hash de `tools/list` al conectar y lo compararía antes de cada `tools/call`. Es una defensa determinista, del mismo estilo que `sender_check`.
- **UI:** la recomendación "Clear UI Patterns" encaja con mostrar, en la vista de risk paths, qué texto de herramienta vio el modelo.
