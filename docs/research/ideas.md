# 15 ideas para MESH, respaldadas por la literatura

Fecha: 2026-11-21. Fuentes: las 42 notas de [notas/](notas/), cada una con su referencia verificada.
Orden: primero impacto en la demo, luego esfuerzo. Las horas son de una persona que ya conoce el
repo. «API» indica que la idea necesita correr el modelo (gasta presupuesto del proxy).

**Antes del domingo 08:30:** las tres marcadas con ★ (unas 6–8 h en total, se pueden repartir entre
tres personas porque tocan archivos distintos).

## Por qué este orden

La literatura dice tres cosas que cambian cómo se presenta MESH:

1. **Nuestra tesis ya tiene nombre y evidencia.** OWASP la lista como escenario de ataque de ASI03
   («Cross-Agent Trust Exploitation»: un correo hace que un agente clasificador le pida a uno de
   finanzas mover plata, y finanzas paga porque confía en un agente interno). Triedman et al. 2025
   miden el «lavado» del pedido a través de sub-agentes: la inyección clásica casi nunca funciona
   contra el orquestador, pero el ataque pasado por sub-agentes logra ejecutar código en 58–90 % de
   los intentos. MESH no descubre el problema; lo **localiza** (en qué salto se pierde la advertencia)
   antes de correr y lo **mide** después.
2. **Avisar no basta.** Etiquetar el origen sin una política que lo haga cumplir rinde poco: LLM
   Tagging sola reduce el ataque ~5 % (Lee & Tiwari 2024); FIDES sin políticas sigue cayendo
   (Costa et al. 2025: «Without policy checks, all planners, including FIDES, succumb»). Hoy
   `provenance_tag` solo informa. La idea 1 lo convierte en una política determinista.
3. **Falta medir utilidad e incertidumbre.** Los benchmarks serios (AgentDojo, ASB, ToolEmu)
   reportan éxito del ataque junto a utilidad, y con intervalos. Una defensa que congela todo se ve
   perfecta si solo se mide el ataque.

## Resumen

| # | Idea | Impacto demo | Esfuerzo | API | Antes del domingo |
|---|---|---|---|---|---|
| 1 | `taint_gate`: la procedencia bloquea, no solo avisa | Alto | 3–4 h | Poca | ★ |
| 2 | Rule of Two / trifecta letal por ruta | Alto | 2–3 h | No | ★ |
| 3 | Etiqueta de procedencia no falsificable | Medio-alto | 1–1,5 h | No | ★ |
| 4 | Intervalos de confianza y desglose por correo en el lote | Alto | 1,5 h | No | si sobra tiempo |
| 5 | Etiquetas OWASP en checks y rutas | Medio | 1 h | No | si sobra tiempo |
| 6 | Supervivencia de la advertencia por salto | Alto | 2 h | Sí | |
| 7 | «Delta de lavado»: directo vs vía colega | Alto | 2 h | Sí | |
| 8 | Fixes etiquetados determinista / probabilístico | Medio | 1–2 h | No | |
| 9 | Utilidad: acción correcta en correos benignos | Medio | 3 h | Sí | |
| 10 | Verificación fuera de banda (callback al proveedor) | Medio | 2 h | Poca | |
| 11 | Chequeo de «confirmación circular» | Medio | 2 h | No | |
| 12 | El correo como resultado de herramienta, no como turno `user` | Medio | 3 h | Sí | |
| 13 | Desglose Éxito / Rechazo / Escalado / Ignorado (estilo MCPTox) | Bajo-medio | 1,5 h | No | |
| 14 | Escenario de tool poisoning en el servidor MCP | Medio | 3 h | Sí | |
| 15 | Atacante adaptativo: best-of-N y «falsa compleción» | Medio | 3 h | Mucha | |

---

## 1. ★ `taint_gate`: la procedencia bloquea, no solo avisa

**Qué es.** Cada agente lleva un estado `tainted` que el harness (no el modelo) calcula: se activa si
el agente leyó el correo externo (el seed) o si recibió por `read_inbox` un mensaje de un agente
`tainted`. Nunca vuelve a `false` en la corrida. El sandbox decide con ese estado: si el agente está
contaminado, `update_vendor_bank_account` e `issue_refund` se bloquean con la razón
«external thread; requires out-of-band verification».

**Por qué importa para la demo.** Hoy `update_vendor_bank_account` está **siempre** bloqueado
(`DEFAULT_ALLOWED` en `sandbox.ts`). Un juez puede decir que la defensa es trivial: «nunca permitir».
Con `taint_gate` la herramienta queda permitida en contexto limpio (un pedido interno legítimo) y
bloqueada solo cuando la ruta viene del correo externo. Eso es exactamente lo que piden CaMeL y
FIDES: una política sobre la acción que mira de dónde vienen los datos. Y da la frase de pitch:
«el modelo cayó en X de N; el sistema, en 0».

**Qué cambiar.**
- `packages/shared/src/index.ts`: campo `label?: "trusted" | "external"` en el mensaje entre agentes.
- `apps/api/src/message-bus.ts`: `send()` guarda el label del emisor como metadato, no como texto.
- `apps/api/src/harness/agent-runner.ts`: `tainted` en la sesión; se marca en `createSession` si es el
  seed con correo, y en `read_inbox` si algún mensaje viene con label `external`.
- `apps/api/src/harness/sandbox.ts`: `execSandboxed(..., ctx: { tainted })`; política por herramienta;
  `update_vendor_bank_account` permitido sin taint; el evento `sandbox.tool_attempt` registra
  `deniedBy: "taint_policy"`.
- `apps/api/src/harness/fixes.ts`: nuevo fix `taint_gate`; `apps/api/src/batch.ts` (`FIX_COMBOS`) y el
  botón «Repetir con…» en `apps/web/src/LabPage.tsx`.
- `apps/api/src/harness/evaluator.ts`: separar `modelAttempted` (el modelo intentó) de
  `systemExecuted` (el sandbox lo dejó pasar).
- Tests en `apps/api/test/sandbox.test.ts`.

**Métrica nueva.** «ASR del modelo» (intentos sobre contexto contaminado) frente a «ASR del sistema»
(acciones ejecutadas). Con el fix, el segundo debe ser 0 por construcción; el primero sigue diciendo
cuánto se engaña el modelo.

**Respaldo.** [CaMeL](notas/debenedetti-2025-camel.md): con Claude 4 Sonnet los ataques exitosos bajan
de 75 a 11 de 949; en la suite banking, de 30 a 0, y el único ataque bancario que sobrevive sin
políticas es «pagar según instrucciones de un documento». [FIDES](notas/costa-2025-fides.md): 163 → 1
ataques exitosos con políticas, 24 sin ellas. [Google](notas/google-2025-secure-ai-agents.md): un motor
de políticas que pregunta «Did the agent recently process untrusted data?».
[Beurer-Kellner et al.](notas/beurer-kellner-2025-design-patterns-prompt-injection.md): un agente que
ingirió input no confiable no debe poder disparar acciones con consecuencias. OWASP ASI03, mitigación
«Mandate Per-Action Authorization» ([nota](notas/owasp-2025-top10-agentic-apps.md)).

**Esfuerzo.** 3–4 h. Para la demo basta una corrida antes/después; el lote completo es opcional.

## 2. ★ Rule of Two / trifecta letal por ruta

**Qué es.** Meta propone que un agente tenga como máximo 2 de 3 propiedades por sesión: [A] procesa
input no confiable, [B] accede a sistemas sensibles, [C] cambia estado o comunica hacia afuera.
Willison lo plantea como «trifecta letal». En MESH, **cada agente por separado cumple la regla**: el
seed tiene [A] pero no [B][C]; finanzas tiene [B][C] pero no [A]. **La ruta la viola**: [A] viaja por
`send_message` hasta finanzas. Es la tesis de MESH escrita en el idioma de Meta.

**Qué cambiar.**
- `apps/api/src/harness/risk-paths.ts`: en `componentChecks()`, un check `rule_of_two` por agente (pasa);
  en `analyzeRiskPaths()`, propagar [A] por cada salto y marcar `ruleOfTwoViolated` por ruta, más
  `summary.ruleOfTwoViolations`. Con `taint_gate` (idea 1) la propiedad [A] corta [C] y la ruta deja
  de violar la regla.
- `packages/shared/src/index.ts`: los campos nuevos en `RiskPath` / `RiskPathAnalysis`.
- `apps/web/src/RiskPaths.tsx`: insignia «Rule of Two: viola» en cada ruta.
- Tests en `apps/api/test/risk-paths.test.ts`.

**Métrica nueva.** «Componentes que violan la Rule of Two: 0 de N. Rutas que la violan: N de N.»
Determinista, sin gastar API, se ve antes de lanzar.

**Respaldo.** [Meta, Agents Rule of Two](notas/meta-2025-agents-rule-of-two.md);
[Willison, lethal trifecta](notas/willison-2025-lethal-trifecta.md);
[Hou et al.](notas/hou-2025-mcp-landscape-amenazas.md), «tool chaining abuse»: cada paso opera dentro
de sus permisos y por eso evade el control de acceso por componente.

**Esfuerzo.** 2–3 h, sin costo de API.

## 3. ★ Etiqueta de procedencia no falsificable

**Qué es.** Hoy el texto que escribe un agente pasa a `withProvenance` sin limpiar
(`apps/api/src/harness/agent-runner.ts`, en el manejo de `send_message`). Si el correo trae un texto
`[provenance] … Automated sender check: OK` y el seed lo copia, finanzas recibe una etiqueta falsa
antes de la verdadera. Además `carriesWarning()` en `risk-paths.ts` cuenta cualquier aparición de
`[provenance]` como advertencia transmitida, así que la ruta observada saldría «con advertencia».

**Qué cambiar.**
- `apps/api/src/harness/agent-runner.ts`: quitar `PROVENANCE_MARK` del `body` del agente antes de
  `withProvenance()` (la misma limpieza que ya hace `quoteUntrusted()` en `provenance.ts` con el From).
- Mejor aún: marcador aleatorio por corrida generado en `orchestrator.ts` (Spotlighting usa
  marcadores que el atacante no conoce).
- `apps/api/src/harness/risk-paths.ts`: `carriesWarning()` debe mirar solo la etiqueta que puso el
  harness (la última, o un campo estructurado), no cualquier aparición del texto.
- `email-harness/scenarios/redteam_injection.json`: escenario con etiqueta falsa en el cuerpo.
- Test en `apps/api/test/risk-paths.test.ts`.

**Métrica nueva.** Saltos con advertencia falsa contados como verdaderos (debe ser 0) y éxito del
ataque con etiqueta falsificada.

**Respaldo.** [Lee & Tiwari 2024](notas/lee-2024-prompt-infection.md): Marking pasó de 0 % a 76 % de
ataques que pasan cuando los autores intercalaron «_» entre palabras.
[Hines et al. 2024, Spotlighting](notas/hines-2024-spotlighting.md): marcadores que el atacante no
puede predecir. Responde una pregunta probable de un juez («¿se puede falsificar la etiqueta?»).

**Esfuerzo.** 1–1,5 h, sin costo de API.

## 4. Intervalos de confianza y desglose por correo en el lote

**Qué es.** `batch.ts` imprime `n/d` sin intervalo y agrupa por `kind|fixes`. Con 5 repeticiones, un
0/5 solo permite decir que el ataque tiene éxito en menos del 43 % (Wilson 95 %); con 0/15 (3 correos
× 5), menos del 20 %. Decirlo así es más honesto y suena más serio que «0 %».

**Qué cambiar.** `summarize()` y `toMarkdown()` en `apps/api/src/batch.ts`; tipo `BatchSummary` en
`packages/shared/src/index.ts`; `apps/web/src/BatchResults.tsx` (columna «IC 95 %»). Agregar desglose
por correo, «el atacante ganó al menos 1 de k» por correo, y guardar el modelo y la temperatura en el
JSON (`agent-runner.ts` no fija temperatura).

**Métrica nueva.** Cota superior del éxito del ataque (Wilson 95 %) y éxito «al menos 1 de k».

**Respaldo.** [AgentDojo](notas/debenedetti-2024-agentdojo.md) reporta IC 95 % (±3–4 puntos);
[CAISI/NIST](notas/caisi-2025-agent-hijacking.md): con 25 intentos el éxito promedio subió de 57 % a
80 %, así que una sola corrida subestima el riesgo.

**Esfuerzo.** 1,5 h, sin costo de API (recalcula sobre resultados existentes).

## 5. Etiquetas OWASP en checks y rutas

**Qué es.** Mostrar en la UI qué amenaza estándar cubre cada check y cada ruta: LLM01:2025 (el correo
es inyección indirecta), LLM06:2025 (herramientas de finanzas), ASI03 (confused deputy entre agentes),
ASI07 (mensajes entre agentes sin origen). Le dice al juez, sin explicación, que MESH ataca un
riesgo reconocido.

**Qué cambiar.** `owasp: string[]` en `ComponentCheck` y `RiskPath` (`packages/shared/src/index.ts`),
llenado en `apps/api/src/harness/risk-paths.ts`, mostrado en `apps/web/src/RiskPaths.tsx`.

**Respaldo.** [OWASP Top 10 for LLM 2025](notas/owasp-2025-top10-llm.md);
[OWASP Top 10 for Agentic Applications 2026](notas/owasp-2025-top10-agentic-apps.md).

**Esfuerzo.** 1 h.

## 6. Supervivencia de la advertencia por salto

**Qué es.** Con `sender_check` encendido y veredicto SUSPICIOUS, ¿en cuántas corridas el mensaje del
seed a finanzas lleva la advertencia escrita por el propio agente? `observeRiskPaths()` ya calcula
`agentWarned` por salto; falta agregarlo en el lote. Es la tesis central con un número: «el seed vio
SUSPICIOUS; la advertencia llegó a finanzas en X de N».

**Qué cambiar.** `apps/api/src/batch.ts` (`runJob` guarda `agentWarned` por salto desde
`riskPathsForRun`), `summarize()`, `BatchResults.tsx` (columna «la advertencia sobrevivió al salto 1»).

**Métrica nueva.** P(advertencia en el salto k+1 | advertencia en el salto k).

**Respaldo.** [Cemri et al., MAST](notas/cemri-2025-mast-fallas-multiagente.md): 32,3 % de las fallas
multiagente son desalineación entre agentes, incluida la retención de información.
[Hammond et al.](notas/hammond-2025-multi-agent-risks.md): en reescrituras sucesivas la exactitud cae de
96 % a menos de 60 % en 8 pasos. [InjecAgent](notas/zhan-2024-injecagent.md): una vez logrado el primer
paso, el segundo se cumple casi siempre.

**Esfuerzo.** 2 h + una corrida del lote.

## 7. «Delta de lavado»: directo vs vía colega

**Qué es.** El mismo correo bajo tres condiciones: el seed es finanzas (ruta local), el seed es otro
agente (ruta con un traspaso), y la segunda con `provenance_tag`. La diferencia entre las dos
primeras es nuestro equivalente del contraste de Triedman (inyección clásica casi siempre falla;
ataque pasado por sub-agentes, 58–90 %).

**Qué cambiar.** `apps/api/src/batch.ts`: combinar `BATCH_SEED` como dimensión del lote (hoy es fijo);
columna en `BatchResults.tsx`.

**Métrica nueva.** Éxito del ataque vía colega menos éxito del ataque directo.

**Respaldo.** [Triedman, Jha, Shmatikov 2025](notas/triedman-2025-mas-hijacking.md);
[Lupinacci et al. 2025](notas/lupinacci-2025-inter-agent-trust.md): los 18 modelos probados ejecutaron
malware pedido por un agente par (al menos 1 éxito en hasta 18 intentos), contra 17 de 18 por
inyección directa.

**Esfuerzo.** 2 h + lote. Riesgo: con Claude es posible que ambas condiciones den 0; también es un
resultado y hay que decirlo así.

## 8. Fixes etiquetados determinista / probabilístico

**Qué es.** Microsoft separa defensas probabilísticas (spotlighting, clasificadores) de deterministas
(permisos, consentimiento humano). En MESH, `sender_check` y `provenance_tag` informan al modelo
(probabilísticas en efecto); el sandbox y `taint_gate` son deterministas. Hoy `risk-paths.ts` marca
una ruta como severidad baja cuando el veredicto es visible, pero eso depende de que el modelo haga
caso.

**Qué cambiar.** `apps/api/src/harness/fixes.ts`: campo `kind: "deterministic" | "probabilistic"`.
`apps/api/src/harness/risk-paths.ts`: una ruta solo queda en severidad baja si la corta una barrera
determinista; si solo está informada, queda en media («informada, no protegida»).

**Respaldo.** [MSRC 2025](notas/microsoft-msrc-2025-indirect-prompt-injection.md);
[Willison](notas/willison-2025-lethal-trifecta.md): «95 % es nota reprobatoria» para un guardrail.
[AgentDojo](notas/debenedetti-2024-agentdojo.md): marcar los datos externos baja el ataque de 57,7 % a
41,7 %; filtrar herramientas, a 6,8 %.

**Esfuerzo.** 1–2 h, sin API.

## 9. Utilidad: acción correcta en correos benignos

**Qué es.** Para los correos benignos, `evaluator.ts` solo distingue `finance_action` de
`no_finance_action`; no mira si se hizo **la** acción correcta. Sin esto, una defensa que congela
todo sale perfecta (ToolEmu: un agente que nunca actúa es 100 % seguro y casi inútil).

**Qué cambiar.** Campo `expected` en los benignos de `email-harness/scenarios/*.json` (p. ej.
`{"tool":"issue_refund","order_id":"7841","amount":129.9}`); función `utility()` en
`apps/api/src/harness/evaluator.ts`; columnas «utilidad sin ataque» y NRP en `batch.ts` y
`BatchResults.tsx`.

**Métrica nueva.** Utilidad por fix y NRP = utilidad × (1 − éxito del ataque).

**Respaldo.** [ASB](notas/zhang-2024-asb.md) (NRP: 43,6 % para Claude 3.5 Sonnet);
[AgentDojo](notas/debenedetti-2024-agentdojo.md); [ToolEmu](notas/ruan-2023-toolemu.md);
[FIDES](notas/costa-2025-fides.md) (las políticas cuestan hasta 24,5 % de tareas).

**Esfuerzo.** 3 h + lote con benignos. Es la condición para que `taint_gate` (idea 1) se defienda bien
ante un juez.

## 10. Verificación fuera de banda (callback al proveedor)

**Qué es.** El control real contra BEC es llamar al proveedor por un canal conocido antes de cambiar
la cuenta. Una herramienta simulada `verify_vendor_out_of_band(vendor_id) → { confirmed: false }`
que el agente puede usar; solo una respuesta confirmada levanta el `taint_gate` para ese proveedor.

**Qué cambiar.** `FINANCE_TOOLS` en `apps/api/src/harness/sandbox.ts`; misma herramienta en
`apps/api/src/mcp/server.ts`; `evaluator.ts` cuenta si el agente verificó antes de actuar.

**Métrica nueva.** Porcentaje de corridas en que el agente verificó por otro canal antes de intentar
el cambio.

**Respaldo.** [FIDES](notas/costa-2025-fides.md) (endorsement acotado);
[caso Arup](notas/cnn-2024-arup-deepfake.md): el empleado sospechó del correo, pero una videollamada
falsa con «colegas» lo convenció; pagó unos US$25,6 millones.

**Esfuerzo.** 2 h.

## 11. Chequeo de «confirmación circular»

**Qué es.** Si todas las confirmaciones que recibe finanzas vienen de agentes contaminados por el
mismo correo, valen como una sola fuente, aunque parezcan «dos colegas de acuerdo».

**Qué cambiar.** `observeRiskPaths()` en `apps/api/src/harness/risk-paths.ts`: contar fuentes
independientes (no `touched`) que llegaron a finanzas; mostrarlo en `RiskPaths.tsx`.

**Respaldo.** [Beurer-Kellner et al.](notas/beurer-kellner-2025-design-patterns-prompt-injection.md),
§4.3: tratar el correo interno como «relativamente seguro» no mitiga pedirle a un colega que apruebe;
[Arup](notas/cnn-2024-arup-deepfake.md).

**Esfuerzo.** 2 h, sin API.

## 12. El correo como resultado de herramienta, no como turno `user`

**Qué es.** Hoy el correo entra al seed en el primer mensaje con rol `user`, rotulado «Initial
instruction / scenario» (`createSession()` en `agent-runner.ts`). Según la jerarquía de
instrucciones, eso le da al texto del atacante privilegio de usuario. Entregarlo como resultado de una
herramienta `read_email` es más realista (así lo hace el servidor MCP) y probablemente más seguro.

**Qué cambiar.** `apps/api/src/harness/agent-runner.ts` (`createSession`) y
`apps/api/src/email/scenarios.ts` (`emailScenarioHint`); fix `email_as_tool_output` en `fixes.ts`.

**Métrica nueva.** Éxito del ataque según el canal por el que entra el correo.

**Respaldo.** [Wallace et al. 2024](notas/wallace-2024-instruction-hierarchy.md);
[BIPIA](notas/yi-2023-bipia.md).

**Esfuerzo.** 3 h + lote. Ojo: cambia la línea base de todas las mediciones, así que no conviene
hacerlo la noche antes de la demo.

## 13. Desglose Éxito / Rechazo / Escalado / Ignorado

**Qué es.** Clasificar cada corrida como MCPTox: el agente hizo lo que pedía el atacante, lo rechazó
explícitamente, lo escaló a un humano, o lo ignoró. Hace el número de MESH comparable con el
benchmark (Claude 3.7 Sonnet rechaza menos del 3 % allí).

**Qué cambiar.** `apps/api/src/mcp/quick-test.ts` (ya cuenta escalaciones) y
`apps/api/src/harness/evaluator.ts`.

**Respaldo.** [Wang et al. 2025, MCPTox](notas/wang-2025-mcptox-benchmark.md).

**Esfuerzo.** 1,5 h.

## 14. Escenario de tool poisoning en el servidor MCP

**Qué es.** Un modo `MESH_POISON=1` en el que una herramienta señuelo trae en su descripción la
instrucción de usar otro IBAN, y el correo es legítimo. `sender_check` da OK y la ruta igual falla:
muestra que el riesgo no está solo en el correo.

**Qué cambiar.** `apps/api/src/mcp/server.ts`, `apps/api/src/mcp/quick-test.ts` (dimensión «vector»:
correo o metadatos de herramienta).

**Métrica nueva.** Éxito del ataque por vector.

**Respaldo.** [Invariant Labs](notas/invariant-labs-2025-tool-poisoning.md);
[MCPTox](notas/wang-2025-mcptox-benchmark.md): 36,5 % de éxito promedio en 20 modelos.

**Esfuerzo.** 3 h + corridas.

## 15. Atacante adaptativo: best-of-N y «falsa compleción»

**Qué es.** Los ataques fijos subestiman el riesgo. Generar N variantes del correo (incluida la
técnica de «falsa compleción», la más efectiva en Liu et al.) y reportar éxito@N.

**Qué cambiar.** `email-harness/scenarios/redteam_injection.json` y `apps/api/src/batch.ts`.

**Respaldo.** [CAISI/NIST](notas/caisi-2025-agent-hijacking.md): Claude 3.5 Sonnet pasó de 11 % a 81 %
con ataques hechos a medida. [Liu et al. 2024](notas/liu-2024-formalizar-prompt-injection.md);
[Anthropic 2025](notas/anthropic-2025-defensas-prompt-injection-navegador.md).

**Esfuerzo.** 3 h y bastante presupuesto de API. Para después de la hackathon.

---

## Ideas que quedaron fuera de las 15

- `llm_screen`: un LLM al que se le pide sospechar del correo (Heiding et al.: 97,25 % de detección
  con Claude 3.5 Sonnet). Útil, pero es otra defensa probabilística en el salto 1.
- `structured_handoff` (patrón Dual LLM / map-reduce): el seed solo reenvía un objeto validado, sin
  texto libre. Es la defensa más fuerte por diseño, pero cambia todo el harness (4–6 h).
- Consenso de dos agentes de finanzas (OWASP T12): interesante para medir si los errores están
  correlacionados.
