# Progent: Securing AI Agents with Privilege Control

- **Autores:** Tianneng Shi, Jingxuan He, Zhun Wang, Hongwei Li, Linyu Wu, Wenbo Guo, Dawn Song (UC Berkeley, UC Santa Barbara, National University of Singapore)
- **Año / venue:** 2025, preprint arXiv (cs.CR), arXiv:2504.11703. La versión v3 es del 14 de mayo de 2026. El título original de v1 era "Progent: Programmable Privilege Control for LLM Agents" (confirmado para v1 y v2 en la API de arXiv); el título actual en arXiv es el de arriba. Venue de conferencia: no verificado.
- **Enlace:** https://arxiv.org/abs/2504.11703
- **PDF local:** ~/papers-ia-safety/procedencia-ifc/shi-2025-progent.pdf (v3)
- **Verificado:** metadatos de arxiv.org/abs/2504.11703 (título actual, 7 autores, fecha 2025/04/16) y cabecera del PDF ("arXiv:2504.11703v3 [cs.CR] 14 May 2026"). Las cifras son de v3. Versiones anteriores reportaban otras cifras (41,2% → 2,2%, no verificado), así que conviene citar v3. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Progent asegura agentes con control de privilegios: una política de reglas simbólicas sobre nombres de herramientas y argumentos.
Cada llamada a herramienta se revisa contra la política con un procedimiento determinista, imponiendo mínimo privilegio.
Un LLM genera la política inicial a partir de la tarea del usuario (se asume que la consulta es benigna) y la actualiza durante la ejecución.
Un solver SMT clasifica cada actualización. Si es un estrechamiento, se aplica sola. Si es una expansión, requiere aprobación explícita (deniega automáticamente, pasa a un humano, etc.).
Eso da "confinamiento monótono": sin aprobación, el espacio de acciones solo puede encogerse, aunque haya inputs adversarios.
Cada regla tiene un "fallback". Puede terminar, avisar al usuario, o devolver un error explicativo al agente para que siga con la tarea legítima.
El fallback por defecto es el mensaje de error, lo que preserva la utilidad: el agente se reencamina.
Evalúa en AgentDojo y ASB, y muestra integración con LangChain y el OpenAI Agents SDK.
En AgentDojo baja la tasa de éxito de ataque (ASR) de 39,9% a 1,0% manteniendo la utilidad.
Los detectores de prompt injection comparados (DeBERTa, DataSentinel, PromptGuard2) generalizan mal.

## Ataque o defensa que propone
Defensa determinista de mínimo privilegio a nivel de llamada a herramienta. La política es un DSL de reglas `herramienta cuando {condiciones sobre argumentos}, fallback f`. La genera y actualiza un LLM, pero la imponen un chequeo determinista y un solver SMT que prohíbe las escaladas silenciosas.

## Números que reporta
- **AgentDojo** (gpt-4o como agente): **ASR 39,9% → 1,0%**, con utilidad mantenida con y sin ataque (Figura 3, sección 8). Solo la política inicial generada por LLM ya baja el ASR a **2,5%** (sección 6/7).
- **ASB:** **ASR 70,3% → 3,9%**, con utilidad comparable a la versión sin defensa (Figura 4).
- tool_filter pierde más utilidad y tiene más ASR por ser de grano grueso: bloquea o permite herramientas enteras, sin mirar argumentos.
- Distintos LLMs de política: efectivo en todos, con ASR de hasta 1% con el mejor (Figura 6).

## Conexión con MESH
- **Lo que tiene `sandbox.ts` hoy es un tool filter de grano grueso.** `DEFAULT_ALLOWED = {issue_refund}` permite `issue_refund` con cualquier monto, y `update_vendor_bank_account` siempre se bloquea. Progent muestra que el grano grueso o rompe la utilidad o deja pasar ataques. La versión fina sería una regla sobre argumentos y contexto.
- **Fallback explicativo.** Hoy un bloqueo devuelve `{status: "blocked_by_sandbox"}`. Al estilo Progent, sería `{status: "blocked_by_taint_policy", reason: "this thread started from an external email; bank changes require out-of-band verification"}`. El agente puede responder "escalé a verificación" en lugar de reintentar. Esto mejora la utilidad y la observabilidad en la traza (`sandbox.tool_attempt`).
- **Confinamiento monótono, aplicado a MESH.** Una vez que la sesión de un agente se contamina (leyó el correo o un mensaje con etiqueta externa), sus privilegios solo pueden bajar hasta una aprobación humana explícita. Se implementa en `agent-runner.ts` con un flag `tainted` que nunca vuelve a `false` dentro de la corrida.
- **Diferencia.** Progent asume que la consulta del usuario es benigna y deriva la política de ella. En BEC el pedido es el ataque. Por eso, para MESH, la política debe ser estática y escrita por el operador ("los cambios bancarios nunca desde un contexto externo"), no generada por LLM a partir del correo.
- **Métrica de pitch.** Copiar el formato ASR/utilidad de Progent: "ASR del sistema" (cambios ejecutados) frente a "ASR del modelo" (intentos), con y sin la política.
