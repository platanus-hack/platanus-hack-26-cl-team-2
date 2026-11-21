# MCP Safety Audit: LLMs with the Model Context Protocol Allow Major Security Exploits

- **Autores:** Brandon Radosevich, John T. Halloran (Leidos; contribución igual)
- **Año / venue:** 2025, preprint arXiv:2504.03767 [cs.CR] (v2 del 11-abr-2025; el PDF dice "Preprint. Under review."). Venue publicado: no verificado.
- **Enlace:** https://arxiv.org/abs/2504.03767 (código: https://github.com/johnhalloran321/mcpSafetyScanner)
- **PDF local:** ~/papers-ia-safety/mcp-owasp/arxiv-2504.03767.pdf
- **Verificado:** página de arXiv y lectura del PDF v2 con pdftotext. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Muestra que LLMs líderes con servidores MCP estándar se pueden inducir a comprometer el sistema de quien los usa.
Prueba Claude 3.7 y Llama-3.3-70B-Instruct con servidores MCP por defecto (filesystem, everything, Slack, Chroma, etc.).
Demuestra 3 clases de ataque: ejecución de código malicioso (MCE), control de acceso remoto (RAC) y robo de credenciales (CT).
Claude a veces se niega, por ejemplo cuando el comando viene codificado en octal, pero cumple con cambios simples de redacción.
Llama-3.3 solo se negó cuando el prompt incluía palabras explícitas como "hack", "steal", "backdoor" o "break into".
Introduce RADE (Retrieval-Agent DEception): el atacante no le habla al modelo. Planta comandos en datos públicos
que terminan en una base vectorial del usuario, y cuando el usuario pide consultar ese tema, el agente ejecuta los comandos.
La demostración de punta a punta en Claude Desktop busca API keys de OpenAI y HuggingFace en variables de entorno y las publica en Slack.
Concluye que no hay que depender de los guardrails del LLM: los falsos positivos de las pruebas dan una falsa sensación de seguridad.
Propone McpSafetyScanner, una herramienta agéntica (varios agentes) que audita un servidor MCP y genera un reporte con remediaciones.

## Ataque o defensa que propone
- **Ataque:** RADE, una inyección indirecta de comandos a través de datos recuperados, sin acceso directo a la víctima y encadenando varios servidores MCP (Chroma para consultar, everything para buscar variables de entorno, Slack para exfiltrar).
- **Defensa:** McpSafetyScanner. Unos agentes generan muestras adversarias a partir de las herramientas y recursos del servidor, buscan vulnerabilidades y remediaciones relacionadas, y escriben un reporte de seguridad. Además el paper plantea que la remediación debe estar también en el diseño del servidor MCP, no solo en el modelo.

## Números que reporta
No reporta tasas de éxito. Son demostraciones cualitativas con capturas, de éxitos y de negativas por modelo. El único dato cuantitativo es de contexto: el repositorio oficial de MCP tenía más de 27k estrellas y 2,8k forks a los 4 meses del lanzamiento.

## Conexión con MESH
- **Valida la metodología:** "las pruebas directas del guardrail dan falsos positivos". Esto respalda que MESH mida acciones (intentos de herramienta registrados en `apps/api/src/mcp/server.ts` y `dangerousAttempted` en `apps/api/src/mcp/quick-test.ts`) en vez de preguntarle al modelo si el correo es sospechoso.
- **RADE es la misma forma que el BEC de MESH:** el atacante no tiene acceso al agente, solo deja contenido (el correo de `email-harness/scenarios/*.json`) en un lugar que el agente va a leer con una herramienta legítima (`read_email`).
- **Paralelo de diseño:** el paper pide remediar en el servidor y no solo en el LLM. MESH ya lo hace: `update_vendor_bank_account` siempre queda bloqueado en `apps/api/src/harness/sandbox.ts` (`DEFAULT_ALLOWED`) y el bloqueo lo decide el servidor, no el modelo.
- **Idea:** el patrón de agente "hacker" contra "auditor" de McpSafetyScanner se parece a `apps/api/src/harness/judge.ts`, que recomienda fixes del catálogo de `fixes.ts`. Se podría citar como precedente de "auditoría agéntica de servidores MCP" en el pitch. MESH se diferencia en que audita rutas entre agentes, no un servidor aislado.
