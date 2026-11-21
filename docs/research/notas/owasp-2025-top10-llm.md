# OWASP Top 10 for LLM Applications 2025

- **Autores:** OWASP Gen AI Security Project (OWASP Foundation). Documento colectivo, sin autor individual en la portada.
- **Año / venue:** publicado el 17-nov-2024 como edición "2025" (el PDF dice "OWASP Top 10 for LLM Applications v2.0"). Licencia CC BY-SA 4.0.
- **Enlace:** https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/ (lista: https://genai.owasp.org/llm-top-10/)
- **PDF local:** ~/papers-ia-safety/mcp-owasp/owasp-2025-top10-llm.pdf (45 páginas, bajado del botón "Download" oficial)
- **Verificado:** página oficial genai.owasp.org (título, fecha, lista LLM01–LLM10) y lectura del PDF con pdftotext (secciones LLM01 y LLM06). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Es la lista de referencia de la industria de los 10 riesgos principales en aplicaciones con LLM, edición 2025.
LLM01 Prompt Injection, LLM02 Sensitive Information Disclosure, LLM03 Supply Chain, LLM04 Data and Model Poisoning,
LLM05 Improper Output Handling, LLM06 Excessive Agency, LLM07 System Prompt Leakage, LLM08 Vector and Embedding Weaknesses,
LLM09 Misinformation, LLM10 Unbounded Consumption.
**LLM01** separa la inyección directa de la indirecta (instrucciones dentro de contenido externo que el modelo procesa: web, documentos, correos).
Entre sus mitigaciones están el mínimo privilegio, "Require human approval for high-risk actions" y "Segregate and identify external content",
además de pruebas adversarias tratando al modelo como un usuario no confiable.
**LLM06** define la agencia excesiva con 3 causas: funcionalidad excesiva, permisos excesivos y autonomía excesiva.
Sus mitigaciones incluyen aprobación humana para acciones de alto impacto y "Complete mediation", es decir, autorizar en el sistema downstream "rather than relying on an LLM to decide".
Su escenario de ejemplo es un asistente de correo al que un correo malicioso (inyección indirecta) convence de reenviar información sensible.
Aviso: OWASP publicó una edición 2026 que renumera la lista (según fuentes secundarias, Excessive Agency pasa a LLM03). No lo verifiqué en la página oficial. Conviene citar siempre con el sufijo ":2025".

## Ataque o defensa que propone
Es un marco de riesgos, no un ataque. Las defensas relevantes para MESH son:
- LLM01 #6 "Segregate and identify external content": separar y marcar claramente el contenido no confiable.
- LLM01 #5 y LLM06 #6: humano en el loop para acciones privilegiadas o de alto impacto.
- LLM06 #7 "Complete mediation": la autorización vive en el sistema downstream, no en el LLM.
- LLM06 (para limitar daño): loguear y monitorear la actividad de las extensiones, y aplicar rate limiting.

## Números que reporta
No reporta números empíricos. Es una clasificación de riesgos con descripciones, ejemplos y mitigaciones.

## Conexión con MESH
**Mapeo para el pitch: "MESH cubre LLM01:2025 + LLM06:2025".**
- **LLM01:2025 (inyección indirecta):** el correo BEC de `email-harness/scenarios/*.json` es inyección indirecta. `read_email` en `apps/api/src/mcp/server.ts` lo entrega al agente.
- **LLM01 #6 "Segregate and identify external content":** es lo que hacen los dos fixes de MESH. `sender_check` (`apps/api/src/email/sender-check.ts` y el banner en `read_email`) identifica el contenido externo en el primer salto. `provenance_tag` (`apps/api/src/harness/provenance.ts`) mantiene esa identificación en cada mensaje entre agentes. La contribución de MESH es mostrar que identificar en el salto 1 no basta: la marca se pierde en la ruta.
- **LLM06:2025 (agencia excesiva):** los agentes con `issue_refund` y `update_vendor_bank_account` (`apps/api/src/harness/sandbox.ts`) son el componente con autonomía. MESH mide si se ejerce mal.
- **LLM06 #7 "Complete mediation":** `update_vendor_bank_account` siempre está bloqueado por el sandbox (`DEFAULT_ALLOWED`), no por el juicio del modelo. Es mediación completa y por eso se puede medir el intento sin daño real.
- **LLM06 #6 humano en el loop:** `escalate_to_human` en `server.ts` es la salida segura. `quick-test.ts` ya cuenta `escalations`, que es la métrica natural de "el agente pidió aprobación humana".
- **Idea:** etiquetar cada `RiskPath` y cada `ComponentCheck` de `apps/api/src/harness/risk-paths.ts` con sus IDs OWASP (por ejemplo `["LLM01:2025","LLM06:2025","ASI03"]`) para que la UI y el reporte hablen el idioma de los auditores.
