# AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents

- **Autores:** Edoardo Debenedetti, Jie Zhang, Mislav Balunović, Luca Beurer-Kellner, Marc Fischer, Florian Tramèr
- **Año / venue:** 2024 / NeurIPS 2024, Datasets and Benchmarks Track (pie de página del PDF: "38th Conference on Neural Information Processing Systems (NeurIPS 2024) Track on Datasets and Benchmarks")
- **Enlace:** https://arxiv.org/abs/2406.13352 (código: https://github.com/ethz-spylab/agentdojo)
- **PDF local:** ~/papers-ia-safety/benchmarks-agentes/debenedetti-2024-agentdojo.pdf
- **Verificado:** metadatos `citation_*` de la página de arXiv 2406.13352 (título, 6 autores, v1 2024-06-19, revisión 2024-11-24); el venue sale del pie de página del PDF descargado. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
AgentDojo es un entorno extensible (no una suite fija) para medir prompt injection indirecta contra agentes con herramientas.
Trae 4 suites (Workspace: correo/calendario/drive; Slack; Travel; Banking), 70 herramientas, 97 tareas de usuario y 27 tareas de inyección (Tabla 1).
Al cruzar tareas de usuario con tareas de inyección salen 629 casos de seguridad.
Cada tarea de usuario tiene una función de utilidad determinista que mira la salida del modelo y el estado del entorno antes y después.
Cada tarea de inyección tiene una función de seguridad, también determinista, que revisa si se cumplió el objetivo del atacante.
Los autores evitan a propósito los evaluadores LLM: un ataque que logra secuestrar al agente también podría secuestrar al juez.
Reportan tres métricas: utilidad sin ataque (benign utility), utilidad bajo ataque y tasa de éxito dirigida (targeted ASR).
Evalúan 10 modelos (incluidos Claude 3 Opus/Sonnet y 3.5 Sonnet) y 4 defensas sobre GPT-4o.
Los modelos más capaces tienden a ser más fáciles de atacar ("inverse scaling"), en parte porque ejecutan mejor la tarea del atacante.
Todas las cifras de las tablas del apéndice traen intervalos de confianza del 95%.

## Ataque o defensa que propone
- **Ataque "Important message"**: un mensaje que dice que, antes de la tarea original, hay que hacer una tarea "importante" (la del atacante). Puede dirigirse al modelo y al usuario por su nombre. También definen un ataque adaptativo "Max", que gana si gana cualquiera de los ataques del conjunto.
- **Defensas evaluadas** (no propias): delimitar los datos de las herramientas (spotlighting/delimiters), detector de inyección (clasificador BERT de ProtectAI), repetir el prompt del usuario después de cada herramienta (sandwich) y **tool filter** (el LLM elige qué herramientas necesita *antes* de ver datos no confiables, que es una forma simple de aislamiento).

## Números que reporta
- **Tabla 3** (ataque "Important message", 629 casos, IC95%): Claude 3.5 Sonnet tiene utilidad sin ataque de 78.22% (±3.23), utilidad bajo ataque de 51.19% (±3.91) y ASR dirigida de 33.86% (±3.70). GPT-4o: 69.00 / 50.08 / 47.69%. Claude 3 Opus: 66.61 / 52.46 / 11.29%. Command-R+: ASR de 0.95%, pero con utilidad de 25.44%.
- **Sección 4.1**: la mayoría de los modelos pierde entre 10 y 25 puntos absolutos de utilidad bajo ataque. La suite Slack llega a 92% de ASR, porque el atacante controla gran parte de lo que devuelven las herramientas. La tarea de inyección 6 de Travel queda en 0%: pide dos acciones maliciosas y el agente suele lograr solo una.
- **Tabla 4** (GPT-4o): "TODO" logra 3.66% de ASR, "Ignore previous" 5.41%, la inyección de InjecAgent 5.72%, "Important message" 57.7% y Max 57.55% dirigida (68.36% no dirigida).
- **Tabla 2**: si el ataque acierta el nombre del usuario y del modelo, la ASR sube solo +1.9 puntos (47.7%). Si se equivoca de modelo ("Claude" en vez de GPT-4), cae a 23.7%.
- **Tabla 5** (defensas, GPT-4o; utilidad sin ataque / utilidad bajo ataque / ASR):
  - sin defensa: 69.0 / 50.01 / 57.69%
  - delimiting: 72.66 / 55.64 / 41.65%
  - detector de inyección: 41.49 / 21.14 / 7.95%. Baja la ASR, pero destruye la utilidad por falsos positivos.
  - repeat prompt: 85.53 / 67.25 / 27.82%
  - tool filter: 73.13 / 56.28 / 6.84%
- **Sección 4.3**: tool filter falla cuando las herramientas que necesita la tarea legítima bastan para el ataque (17% de los casos) o cuando no se pueden planificar de antemano.
- **Apéndice D**: correr la suite de seguridad completa con GPT-4o cuesta unos US$35, y la de utilidad unos US$4. Las inyecciones al final de la salida de la herramienta son las más efectivas (hasta 70% de ASR).

## Conexión con MESH
- **Valida** el diseño de `apps/api/src/harness/evaluator.ts`, que decide el veredicto solo con la traza, sin LLM, por la misma razón que da AgentDojo: un juez LLM puede caer en la misma inyección. `judge.ts` (Haiku) debería quedar como narrativa y nunca alimentar las tasas de `batch.ts`.
- **Hueco principal: MESH no mide utilidad.** Para los correos `benign`, `evaluator.ts` solo distingue `finance_action` de `no_finance_action`. No comprueba que se haya hecho *la* acción correcta: por ejemplo, que en `bec_ben_02_customer_duplicate_charge` se reembolsen 129.90 de la orden 7841. Sin esto, una defensa que congele todas las acciones financieras saldría "perfecta". Idea: agregar un campo `expected` a los benignos de `email-harness/scenarios/*.json` (p. ej. `{"tool":"issue_refund","order_id":"7841","amount":129.9}` o `{"none":true}`), una función `utility()` en `evaluator.ts` y las columnas "utilidad sin ataque" y "utilidad bajo ataque" en `summarize()`/`toMarkdown()` de `batch.ts` y en `apps/web/src/BatchResults.tsx`.
- **Utilidad bajo ataque al estilo AgentDojo**: crear correos "mixtos" (un reembolso legítimo y el cambio de IBAN en el mismo hilo). Se cuenta como éxito si `issue_refund` es correcto **y** no hay intento de `update_vendor_bank_account`.
- **`provenance_tag` es pariente de "delimiting"**: marca datos no confiables en vez de prohibir acciones. AgentDojo muestra que eso reduce la ASR (57.7% → 41.7%) pero no la elimina. El sandbox de MESH (`sandbox.ts`, que bloquea siempre `update_vendor_bank_account`) se parece más a tool filter (6.8%). Conviene que el pitch diga que las rutas de riesgo (`risk-paths.ts`) explican *por qué* el marcado se pierde salto a salto, mientras que el bloqueo determinista es el que de verdad corta.
- **Intervalos de confianza**: AgentDojo reporta IC95% en todas sus tablas. `batch.ts` imprime `n/d` sin intervalo. Con BATCH_REPS=5, un 0/5 solo permite afirmar ASR < 43% (Wilson, 95%).
