# Defeating Prompt Injections by Design

- **Autores:** Edoardo Debenedetti, Ilia Shumailov, Tianqi Fan, Jamie Hayes, Nicholas Carlini, Daniel Fabian, Christoph Kern, Chongyang Shi, Andreas Terzis, Florian Tramèr (Google, Google DeepMind, ETH Zurich)
- **Año / venue:** 2025, preprint arXiv (cs.CR), arXiv:2503.18813. La versión actual de arXiv dice "Updated version with newer models and link to the code". Venue de conferencia: no verificado.
- **Enlace:** https://arxiv.org/abs/2503.18813 (código: https://github.com/google-research/camel-prompt-injection)
- **PDF local:** ~/papers-ia-safety/procedencia-ifc/debenedetti-2025-camel.pdf
- **Verificado:** metadatos `citation_title`, `citation_author` y `citation_date` (2025/03/24) de la página arxiv.org/abs/2503.18813; las cifras salen del PDF descargado (abstract, sección 6, Tablas 4 y 5). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
CaMeL es una capa de sistema alrededor del LLM que protege al agente aunque el modelo siga siendo vulnerable a prompt injection.
Toma la idea del Dual LLM de Willison: un LLM privilegiado (P-LLM) solo ve la consulta del usuario, que es confiable, y la traduce a un programa en un dialecto de Python.
Un LLM en cuarentena (Q-LLM), sin herramientas, solo extrae datos estructurados de contenido no confiable.
Un intérprete propio ejecuta el programa y lleva un grafo de dependencias de datos. Cada valor tiene "capabilities": su procedencia (fuente) y quién puede leerlo.
Antes de cada llamada a herramienta, unas políticas de seguridad escritas en Python revisan las capabilities de los argumentos y responden Allowed o Denied. Cuando la respuesta es Denied, se pide consentimiento al usuario.
Así los datos no confiables no pueden cambiar el flujo de control, y si cambian el flujo de datos hacia una herramienta sensible, la política lo detecta.
La evaluación usa AgentDojo (949 ataques; suites workspace, banking, slack y travel) con varios modelos, entre ellos Claude 4 Sonnet, Gemini 2.5 y o3.
Resuelve el 77% de las tareas con seguridad demostrable, contra 84% del sistema sin defensa.
El paper deja explícitamente fuera del alcance los ataques texto-a-texto y el phishing inducido por inyección.
Un caso que lo ilustra: en banking, el único ataque que pasa sin políticas es "pagar según las instrucciones de un documento". Ese es el patrón BEC.

## Ataque o defensa que propone
Defensa por diseño en tres partes:
1. **Separación de control y datos.** El plan sale solo de la consulta confiable, y lo no confiable se queda en variables.
2. **Capabilities por valor.** Cada valor lleva su fuente y sus lectores permitidos, que se propagan por el grafo de dependencias.
3. **Políticas deterministas por herramienta.** Ejemplo (sección 6.2.2): la política de `send_money` exige que el destinatario y el monto vengan del usuario y que no haya ninguna fuente no confiable entre sus ancestros en el grafo de dependencias.

Fuera del alcance (sección 3.1): ataques que no afectan el flujo de control ni de datos, phishing al usuario, y la autonomía total sin humano.

## Números que reporta
- Abstract: **77% de tareas resueltas con seguridad demostrable, contra 84% sin defensa** (AgentDojo).
- Tabla 4, ataques exitosos de un total de 949:
  - **Claude 4 Sonnet:** 75 con tool calling nativo, 13 con CaMeL sin políticas, **11 con CaMeL**. En la suite banking baja de **30 a 0**.
  - **Gemini 2.5 Pro:** 163 → 0.
  - **Gemini 2.5 Flash:** 297 → 1.
  - **o3 High:** 11 → 0.
  - Los ataques que quedan son de la suite travel, del tipo texto-a-texto que el paper deja fuera del alcance.
- Sección 6.2.1: con Gemini 2.5 Pro, los ataques exitosos pasan de **300 a 0** solo con la separación (sin políticas). Esta cifra no coincide con la de la Tabla 4 (163), probablemente por otra configuración de la corrida: no verificado.
- Sección 6.3, comparación con Claude 3.5 Sonnet: CaMeL tiene 0 ataques exitosos y la siguiente mejor defensa (tool filter) tiene 8. GPT-4o-mini con instruction hierarchy sigue siendo vulnerable a 276 ataques.
- Tabla 5 (utilidad de otras defensas): Tool Filter 73,2%, modelo sin defensa 90,7%, Spotlighting 92,8%.
- Sección 6.1.3: usar Claude 3.5 Haiku como Q-LLM baja la utilidad ~1% y el costo ~12%.
- Sección 6.2.2: las políticas se disparan más en banking porque la política de `send_money` es muy estricta.

## Conexión con MESH
- **Valida la tesis.** El ataque bancario que sobrevive sin políticas es "hacer un pago según instrucciones en un documento" (sección 6.2.1), es decir, BEC. Con política sobre el argumento destinatario cae a 0. La separación arquitectónica no basta sola; lo que cierra la ruta es la política sobre el flujo de datos hacia la herramienta financiera.
- **Contradice nuestro `provenance_tag` como defensa final.** `apps/api/src/harness/provenance.ts` solo informa al modelo. CaMeL sostiene que la seguridad debe venir de algo determinista. Hoy `risk-paths.ts` marca una ruta como `severity: "low"` cuando el veredicto es visible en el sumidero. Eso sigue dependiendo de que el modelo haga caso: sería más honesto llamarlo "informada" y no "segura".
- **Diferencia clave con MESH.** En CaMeL la consulta del usuario es confiable. En BEC, el pedido mismo viene del correo externo. No hay un "plan confiable" que proteger, así que la única defensa aplicable es la de flujo de datos: el IBAN y la orden de cambio tienen ancestro externo, por lo tanto se deniegan.
- **Idea implementable.** Escribir el análogo de la política de `send_money` en `apps/api/src/harness/sandbox.ts`: `update_vendor_bank_account` (y `issue_refund` sobre cierto monto) solo se permite si el contexto del agente no tiene ancestro externo. El rastreo sería a nivel de contexto, no de argumento, como FIDES. `execSandboxed` recibiría `ctx: { tainted: boolean; taintSources: string[] }` y emitiría `deniedBy: "taint_policy"` en el evento `sandbox.tool_attempt`.
- **Para la UI.** CaMeL propone usar la procedencia para mostrar al humano de dónde viene el texto (sección 3.1). Eso es justo lo que hoy hace `provenance_tag`. Es útil, pero CaMeL lo clasifica como mitigación de UX, no como garantía.
