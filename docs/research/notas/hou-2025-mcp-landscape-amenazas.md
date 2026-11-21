# Model Context Protocol (MCP): Landscape, Security Threats, and Future Research Directions

- **Autores:** Xinyi Hou, Yanjie Zhao, Shenao Wang, Haoyu Wang (Huazhong University of Science and Technology)
- **Año / venue:** 2025, preprint arXiv:2503.23278 [cs.CR] (v1 30-mar-2025, v3 7-oct-2025). El PDF usa plantilla ACM, pero el venue publicado: no verificado.
- **Enlace:** https://arxiv.org/abs/2503.23278
- **PDF local:** ~/papers-ia-safety/mcp-owasp/arxiv-2503.23278.pdf
- **Verificado:** página de arXiv (título, autores, fechas de versiones) y lectura del PDF v3 con pdftotext. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Es un estudio de sistematización (vision paper) sobre MCP desde la arquitectura y la seguridad.
Define el ciclo de vida de un servidor MCP en 4 fases (creación, despliegue, operación, mantenimiento) y 16 actividades.
Sobre ese ciclo construye una taxonomía de 16 escenarios de amenaza agrupados por 4 tipos de atacante:
desarrolladores maliciosos, atacantes externos, usuarios maliciosos y fallas de seguridad.
Entre las amenazas están namespace typosquatting, conflicto de nombres de herramientas, preference manipulation,
tool poisoning, rug pulls, cross-server shadowing, inyección de comandos o backdoor, installer spoofing,
prompt injection indirecta, robo de credenciales, sandbox escape, tool chaining abuse, acceso no autorizado,
redespliegue de versiones vulnerables, privilegios que persisten tras una actualización y configuration drift.
Cada amenaza viene con un caso de estudio y salvaguardas por fase del ciclo de vida.
También revisa la adopción industrial (OpenAI, Cursor, Cloudflare), los marketplaces de servidores y las líneas de investigación abiertas.

## Ataque o defensa que propone
No presenta un ataque nuevo: cataloga ataques. Los dos más relevantes para MESH son:
- **Prompt injection indirecta (§5.2.2):** el texto que devuelve una herramienta MCP llega en "formatos estándar como JSON o texto plano" y por eso "a menudo parece confiable" para el modelo. Al atacante le basta con publicar contenido (un issue de GitHub, un correo) que la herramienta vaya a leer.
- **Tool chaining abuse (§5.3.3):** varias herramientas de bajo riesgo, encadenadas por el modelo, producen una operación de alto impacto. "Cada paso opera dentro de los permisos autorizados del modelo", por lo que estos ataques "suelen evadir el control de acceso tradicional". Es una forma de misuse "sigilosa y que cumple la política".
Defensas que propone (§6.3.3, fase de operación): un filtro de intención que revise cada comando del modelo antes de que llegue al servidor, un sandbox activo durante la ejecución, sesiones con tokens de vida corta y un log de cada herramienta invocada (nombre, hora, resumen del resultado).

## Números que reporta
Es un paper cualitativo: no mide tasas de éxito de ataques. Los únicos números son descriptivos:
- 4 fases, 16 actividades, 4 tipos de atacante, 16 escenarios de amenaza.
- De 300 servidores tomados al azar de MCP.so, 30 tenían "MCP" en el título sin tener relación con el protocolo y 18 estaban en desarrollo o no disponibles. Esto muestra que los directorios inflan sus cifras y no verifican identidad ni seguridad.

## Conexión con MESH
- **Valida la tesis.** El "tool chaining abuse" es el argumento de MESH dicho por un paper revisado y muy citado: cada paso respeta sus permisos y el control de acceso por componente no ve el problema. En MESH la cadena es read_email, luego send_message, luego update_vendor_bank_account. `apps/api/src/harness/risk-paths.ts` ya hace esto: `analyzeRiskPaths()` corre los "component checks" y muestra que una ruta falla aunque cada componente pase.
- **Prompt injection indirecta por un canal MCP:** es lo que mide `apps/api/src/mcp/server.ts` (`read_email` devuelve el correo atacante como texto plano) con `apps/api/src/mcp/quick-test.ts`.
- **Idea concreta (§5.1.4 y §5.1.6, tool poisoning y shadowing):** hoy las descripciones de herramientas de `server.ts` vienen de `FINANCE_TOOLS` en `apps/api/src/harness/sandbox.ts` y son benignas. Se podría agregar un modo con una herramienta "señuelo" envenenada para medir el vector de metadatos además del vector correo. Ver la nota de MCPTox.
- **Idea concreta (§6.3.3, log por invocación):** `server.ts` ya registra cada intento antes de decidir si lo permite o lo bloquea (`McpToolAttempt`, `MESH_MCP_LOG`). Sirve como evidencia de que MESH implementa la recomendación de "registrar cada herramienta invocada" del paper.
