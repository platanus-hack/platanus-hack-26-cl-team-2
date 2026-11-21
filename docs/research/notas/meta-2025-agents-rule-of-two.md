# Agents Rule of Two: A Practical Approach to AI Agent Security

- **Autores:** Meta (blog de Meta AI). La página no nombra autores individuales. Fuentes secundarias lo atribuyen al equipo de AI Security de Meta, pero eso no lo verifiqué.
- **Año / venue:** 2025, blog de Meta AI, 31-10-2025
- **Enlace:** https://ai.meta.com/blog/practical-ai-agent-security/
- **PDF local:** página web, sin PDF
- **Verificado:** leí la página oficial en ai.meta.com con WebFetch: título, fecha, redacción exacta de las propiedades [A], [B] y [C] y los ejemplos. Simon Willison lo comenta en https://simonwillison.net/2025/Nov/2/new-prompt-injection-papers/ y dice que Meta cambió la etiqueta de las combinaciones de dos propiedades de "safe" a "lower risk"; ese cambio no lo verifiqué directamente. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Meta propone una regla simple para agentes mientras la prompt injection siga sin resolverse.
Dentro de una sesión, un agente debe cumplir como máximo dos de tres propiedades.
[A] puede procesar inputs no confiables; [B] tiene acceso a sistemas sensibles o datos privados; [C] puede cambiar estado o comunicarse hacia afuera.
Si una tarea necesita las tres y no se puede reiniciar con un contexto limpio, el agente no debe operar en forma autónoma.
En ese caso necesita, como mínimo, supervisión: aprobación humana u otro medio confiable de validación.
Es una extensión explícita de la "lethal trifecta" de Willison: agrega "cambiar estado" además de exfiltrar.
Da ejemplos: Email-Bot, asistente de viajes, asistente de investigación web y agente de código interno.
Permite cambiar de configuración dentro de una sesión siempre que el cambio sea en un solo sentido (por ejemplo, de [AC] a [B] desactivando la comunicación).
El principio guía es romper la cadena de explotación [A] → [B] → [C].
Aclara que la regla no basta por sí sola: complementa el mínimo privilegio y la defensa en profundidad.

## Ataque o defensa que propone
- **Defensa:** una restricción de configuración por sesión.
  - **Email-Bot:** [BC] solo lee correo de remitentes confiables; [AC] no tiene datos sensibles; [AB] solo envía a destinatarios confiables o con aprobación humana.
  - **Asistente de viajes [AB]:** exige confirmación humana para reservas o pagos de depósitos y limita las URL.
  - **Agente de código [BC]:** filtra inputs por "author-lineage", es decir, por la procedencia de quién escribió el contenido.
- **Futuro:** "oversight agents", LlamaFirewall y la idea de declarar la configuración Rule of Two en las llamadas a herramientas, por ejemplo vía MCP.

## Números que reporta
No reporta números empíricos. La estructura es "como máximo 2 de 3 propiedades por sesión".

## Conexión con MESH
- **Es la regla más fácil de convertir en un chequeo determinista.** Propuesta concreta para `apps/api/src/harness/risk-paths.ts`:
  1. **Propiedades por agente**, calculadas con `RiskSetup`: `A = (id === seedAgentId) || alcanzable desde el seed por peer_message` (hoy todos son alcanzables, porque todos pueden escribir a todos); `B = agent.finance` (datos maestros de proveedores); `C = agent.finance` (`issue_refund` y `update_vendor_bank_account` cambian estado). Un agente sin finanzas que puede `send_message` también tiene una forma débil de [C], porque comunica a otros agentes.
  2. **Check por componente** ("Rule of Two local", usando solo la entrada directa): el seed tiene A pero no B ni C, finanzas tiene B y C pero no A directa. Pasa, igual que el check `separation` actual.
  3. **Check por ruta:** `ruleOfTwoViolated` en `RiskPath` cuando el nodo final tiene B+C y A le llega por la ruta, salvo que haya una "barrera". Una barrera sería un salto donde el harness bloquea o exige aprobación para el sink cuando hay taint. Un aviso al modelo, como `provenance_tag`, no cuenta. La mayoría de las rutas actuales fallarían, y eso hace visible la tesis.
  4. **Métrica de resumen:** `summary.ruleOfTwoViolations` (n de rutas) junto a `componentsAllOk`. El titular de la demo sería "todos los componentes OK, 100 % de las rutas violan la Rule of Two".
- **"Author-lineage" equivale a `provenance_tag`:** el ejemplo del agente de código de Meta filtra por la procedencia de quién escribió el contenido, que es lo que hace `provenanceTag()` en `apps/api/src/harness/provenance.ts`, con la diferencia de que Meta lo usa para filtrar y MESH solo para anotar. Un fix `lineage_gate` en `apps/api/src/harness/sandbox.ts` haría que `execSandboxed` bloquee `issue_refund` cuando el mensaje que lo motivó tiene la marca `PROVENANCE_MARK`. Eso convierte el aviso en una barrera.
- **"Sin autonomía si se necesitan las tres":** el escenario legítimo `bec_ben_02_customer_duplicate_charge` necesita las tres (correo externo, datos de órdenes y devolución). Según Meta debería pasar por `escalate_to_human` (`apps/api/src/mcp/server.ts`). Métrica de utilidad: devoluciones legítimas escaladas frente a ejecutadas.
