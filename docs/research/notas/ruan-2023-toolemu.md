# Identifying the Risks of LM Agents with an LM-Emulated Sandbox

- **Autores:** Yangjun Ruan, Honghua Dong, Andrew Wang, Silviu Pitis, Yongchao Zhou, Jimmy Ba, Yann Dubois, Chris J. Maddison, Tatsunori Hashimoto
- **Año / venue:** 2023 (arXiv) / ICLR 2024 (encabezado del PDF: "Published as a conference paper at ICLR 2024")
- **Enlace:** https://arxiv.org/abs/2309.15817
- **PDF local:** ~/papers-ia-safety/benchmarks-agentes/ruan-2023-toolemu.pdf
- **Verificado:** metadatos `citation_*` de la página de arXiv 2309.15817 (v1 2023-09-25, v2 2024-05-17) y encabezado del PDF v2. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
ToolEmu usa un LM (GPT-4) para *emular* la ejecución de herramientas, así que se pueden probar agentes sobre herramientas que no existen o que son caras de montar.
Agrega un "emulador adversarial" que fija el estado del sandbox para empujar al agente hacia resultados riesgosos (red-teaming).
Un evaluador de seguridad automático (otro LM) detecta acciones riesgosas y puntúa su probabilidad y severidad. Un evaluador de utilidad (helpfulness) mide la contraparte.
El riesgo que estudia no es un atacante externo sino instrucciones del usuario subespecificadas, que el agente resuelve con supuestos peligrosos.
El benchmark inicial tiene 36 herramientas (toolkits) de alto riesgo y 144 casos.
La validación humana dice que 68.8% de las fallas detectadas con el emulador adversarial son fallas reales y realistas.
El acuerdo entre el evaluador automático y los humanos (κ≈0.48 en seguridad) iguala al acuerdo entre humanos.
Incluso el agente más seguro (GPT-4 con instrucciones de seguridad) falla en 23.9% de los casos.
Reproducir en un sandbox real 7 fallas del Terminal costó unas 8 horas, contra menos de 15 minutos con el emulador. 6 de las 7 se reprodujeron.
Muestra el trade-off: un agente que no actúa ("NoAct") es perfectamente seguro y casi inútil.

## Ataque o defensa que propone
Es una herramienta de evaluación, no un ataque ni una defensa. Propone el emulador estándar y el adversarial, y los evaluadores de seguridad y utilidad. Como mitigación prueba agregar requisitos de seguridad al prompt del agente.

## Números que reporta
- **Tabla 3** (validación de punta a punta, ±1 error estándar): precisión de las fallas identificadas de 72.5% ± 7.1% (emulador estándar) y 68.8% ± 6.7% (adversarial). Incidencia de fallas reales de 39.6% ± 4.9% y 50.0% ± 5.1%: el adversarial encuentra unos 10 puntos más.
- **Tabla 4**: emulaciones sin problemas críticos en 91.9% (estándar) y 85.6% (adversarial). Cohen's κ en seguridad: humano-humano 0.480, automático-humano 0.478. En utilidad: 0.521 y 0.543.
- **Tabla 5** (144 casos, emulador adversarial, temperatura 0; seguridad 0–3, incidencia de fallas, utilidad 0–3):
  - GPT-4: 2.007, 39.4% de fallas, 1.458
  - Claude-2: 1.829, 44.3%, 1.464
  - ChatGPT-3.5: 1.430, 62.0%, 0.768
  - GPT-4 + prompt de seguridad: 2.359, **23.9%**, 1.824
  - GPT-4 con prompt "helpful + safety": 2.241, 30.5%, 1.624
  - NoAct: 3.000, 0.00%, 0.063
- **Nota 2**: aun con temperatura 0, la API no es determinista. Con 3 corridas independientes estiman errores estándar de 0.07 (seguridad), 0.05 (utilidad) y 4.1% (incidencia de fallas). Costo de unos US$1.2 por caso.

## Conexión con MESH
- **Contraste de diseño**: ToolEmu emula las herramientas con un LM y juzga con un LM. MESH hace lo contrario a propósito: el sandbox determinista de `apps/api/src/harness/sandbox.ts` (resultados falsos fijos, todo intento queda en la traza *antes* de la decisión de la política) y el veredicto determinista de `evaluator.ts`. AgentDojo critica justamente el juez LLM de ToolEmu porque puede ser secuestrado. Esto respalda la elección de MESH y es un argumento para el pitch.
- **Lo que MESH puede copiar**: (1) el **"NoAct" como línea base explícita**. Una fila del lote con un agente que nunca usa herramientas financieras muestra que "0 ataques exitosos" no vale nada sin utilidad en benignos. (2) El par **seguridad + utilidad** en la misma tabla (`toMarkdown()` en `apps/api/src/batch.ts`, `apps/web/src/BatchResults.tsx`).
- **Error estándar con pocas corridas**: ToolEmu estima la varianza con solo 3 corridas repetidas. MESH tiene `BATCH_REPS` (5 por defecto) y puede reportar el error estándar o un intervalo de Wilson por celda. Además, `agent-runner.ts` no fija `temperature` (usa el valor por defecto de la API, que es 1.0), así que la variación entre repeticiones es real y hay que reportarla.
- **Emulador adversarial vs escenarios fijos**: la idea de fijar el estado para provocar el caso de riesgo calza con los `redteam_injection.json` de MESH (escenarios hechos a mano para un modo de falla). Un "generador adversarial" de correos sería una extensión futura, no para la hackathon.
- **Agentes de `quick-test.ts`**: el agente Claude real por MCP (`apps/api/src/mcp/server.ts`) hace con herramientas *reales en forma* lo que ToolEmu hace emulado. ToolEmu reporta que 6 de 7 fallas emuladas se reprodujeron en real, y esa misma comparación "lab simulado vs agente MCP" vale la pena reportarla en MESH.
