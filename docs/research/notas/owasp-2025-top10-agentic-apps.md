# OWASP Top 10 for Agentic Applications for 2026

- **Autores:** OWASP Gen AI Security Project, Agentic Security Initiative (ASI). Más de 100 colaboradores, sin autor individual en la página.
- **Año / venue:** publicado el 9-dic-2025 como "Version 2026" (PDF de 57 páginas). Licencia CC BY-SA 4.0.
- **Enlace:** https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- **PDF local:** ~/papers-ia-safety/mcp-owasp/owasp-2026-top10-agentic.pdf
- **Documento compañero (también verificado):** "Agentic AI – Threats and Mitigations", OWASP ASI. La página oficial dice 17-feb-2025 (v1.0), pero el PDF que se descarga hoy es la **Version 1.1, December 2025**, con amenazas T1–T17. Página: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/. PDF local: ~/papers-ia-safety/mcp-owasp/owasp-2025-agentic-threats-mitigations.pdf
- **Verificado:** páginas oficiales genai.owasp.org (título, fecha, enlace de descarga) y lectura de ambos PDFs con pdftotext. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Es el Top 10 de riesgos para sistemas agénticos autónomos, complementario del Top 10 de LLM.
ASI01 Agent Goal Hijack · ASI02 Tool Misuse and Exploitation · ASI03 Identity and Privilege Abuse · ASI04 Agentic Supply Chain Vulnerabilities ·
ASI05 Unexpected Code Execution (RCE) · ASI06 Memory & Context Poisoning · ASI07 Insecure Inter-Agent Communication ·
ASI08 Cascading Failures · ASI09 Human-Agent Trust Exploitation · ASI10 Rogue Agents.
ASI01 parte de que los agentes "cannot reliably distinguish instructions from related content". Incluye "forged agent-to-agent messages".
ASI02: el agente opera "within its authorized privileges" pero usa una herramienta legítima de forma insegura.
ASI03 es "the agentic evolution of Excessive Agency (LLM06:2025)". Incluye "Cross-Agent Trust Exploitation (Confused Deputy)":
un agente de bajo privilegio retransmite instrucciones de aspecto válido a uno de alto privilegio, que las ejecuta sin volver a verificar.
ASI07: mensajes entre agentes sin autenticación, integridad ni "semantic validation". ASI08: las fallas se amplifican entre agentes conectados.
Cada entrada se mapea a LLM01–LLM10 y a las amenazas T del documento compañero (ASI03↔T3, ASI07↔T12+T16, ASI01↔T6+T7, ASI08↔T5+T8).

## Ataque o defensa que propone
Es un marco de riesgos. El escenario de ataque número 3 de ASI03 es, casi palabra por palabra, el escenario de MESH:
> "Cross-Agent Trust Exploitation: A crafted email from IT instructs an email sorting agent to instruct a finance agent to move money to a specific account. The sorter agent forwards it, and the finance agent, trusting an internal agent, processes the fraudulent payment without verification." (p. 16)

En ASI09 hay otro muy parecido: "Invoice Copilot Fraud", donde una factura envenenada lleva al agente a sugerir un pago urgente a la cuenta del atacante.
Mitigaciones relevantes:
- ASI03 #3 "Mandate Per-Action Authorization": verificar de nuevo cada paso privilegiado con un motor de políticas central, lo que "stopping Cross-Agent Trust Exploitation".
- ASI03 #4: humano en el loop para acciones irreversibles.
- ASI09 #6 "Content provenance and policy enforcement": adjuntar metadatos verificables de origen y bloquear las acciones "lacking trusted provenance".
- ASI09 #5: señales como "unverified source".
- ASI07: autenticación de mensajes y esquemas tipados, con mitigaciones centradas en "integrity, provenance, and controlled communication patterns".
- Threats & Mitigations T12: "cryptographic message authentication", y "multi-agent consensus verification" para decisiones críticas.
- Threats & Mitigations T16 (protocolos como MCP o A2A): "Sanitize and validate all protocol-level data, including context payloads and tool metadata".

## Números que reporta
No reporta números empíricos. Las cifras son de proceso: más de 100 colaboradores, publicado el 9-dic-2025, 57 páginas. El documento compañero lista 17 amenazas (T1–T17).

## Conexión con MESH
**Mapeo para el pitch: "MESH reproduce el escenario Cross-Agent Trust Exploitation de ASI03 y mide ASI01 + ASI02 + ASI03 + ASI07 (T2, T3, T6, T9, T12)".**
- **ASI01 / T6 (Goal Hijack):** el correo redirige el objetivo del agente seed. Ruta: `read_email` → `send_message` (`apps/api/src/harness/tools.ts`).
- **ASI02 / T2 (Tool Misuse):** `issue_refund` y `update_vendor_bank_account` son herramientas legítimas usadas con autorización formal (`apps/api/src/harness/sandbox.ts`).
- **ASI03 / T3 (Confused Deputy entre agentes):** el agente de finanzas confía en un colega interno. Es exactamente lo que `apps/api/src/harness/risk-paths.ts` detecta, porque en cada salto pregunta si el receptor todavía puede saber que el contenido vino de afuera.
- **ASI07 / T12 (Inter-Agent Communication):** `send_message`/`read_inbox` no llevan origen ni integridad. `provenance_tag` (`apps/api/src/harness/provenance.ts`) es una implementación concreta de la mitigación "provenance" de ASI07/ASI09. Lo agrega el harness y no el modelo, así que el atacante no puede falsificarlo. Además cita el From como dato (`quoteUntrusted`).
- **T9 (Identity Spoofing):** el From falsificado del correo. `sender_check` (`apps/api/src/email/sender-check.ts`) es la defensa determinista.
- **ASI08 (Cascading Failures):** un error en el salto 1 se propaga hasta finanzas. `observeRiskPaths()` reconstruye esa cascada desde la traza.
- **Idea concreta (ASI03 #3 "Per-Action Authorization"):** un tercer fix, `per_action_authz`, en `apps/api/src/harness/fixes.ts` y `sandbox.ts`: toda llamada a una herramienta financiera cuyo hilo empezó en un correo externo exige `escalate_to_human` antes. La métrica nueva sería "harm con fix" frente a "harm sin fix" y el costo en escalaciones. Es la defensa que OWASP recomienda contra este mismo escenario.
- **Idea (T12 "multi-agent consensus"):** pedir que 2 agentes de finanzas aprueben antes de un cambio bancario. Mediría si el consenso entre LLMs ayuda o si los dos caen igual (correlación de errores).
