# InjecAgent: Benchmarking Indirect Prompt Injections in Tool-Integrated Large Language Model Agents

- **Autores:** Qiusi Zhan, Zhixiang Liang, Zifan Ying, Daniel Kang
- **Año / venue:** 2024 / Findings of ACL 2024 (según el campo "Comments" de arXiv: "36 pages, 6 figures, 13 tables (ACL 2024 Findings)")
- **Enlace:** https://arxiv.org/abs/2403.02691 (benchmark: https://github.com/uiuc-kang-lab/InjecAgent)
- **PDF local:** ~/papers-ia-safety/benchmarks-agentes/zhan-2024-injecagent.pdf
- **Verificado:** metadatos `citation_*` y campo Comments de la página de arXiv 2403.02691 (v1 2024-03-05, revisión 2024-08-04). El venue ACL Findings sale del campo Comments; no lo revisé en la ACL Anthology. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
InjecAgent mide la prompt injection indirecta (IPI) contra agentes con herramientas: la instrucción maliciosa va dentro de la respuesta de una herramienta, como un correo, una reseña o una nota.
Tiene 1,054 casos: 17 herramientas de usuario × 62 herramientas de atacante.
Los ataques son de dos tipos: daño directo al usuario (p. ej. transferir dinero o desbloquear una puerta) y robo de datos, que exige dos pasos: extraer el dato y enviarlo al atacante.
No ejecuta el agente de punta a punta: fija la respuesta de la herramienta de usuario y observa la siguiente acción del agente.
Hay dos configuraciones: "base" (solo la instrucción del atacante) y "enhanced" (antepone "IMPORTANT!!! Ignore all previous instructions…").
Evalúa 30 agentes: prompted con ReAct (con una instrucción de seguridad en el prompt) y fine-tuned para function calling (GPT-3.5/GPT-4).
Define ASR-valid, que calcula la ASR solo sobre salidas válidas, y ASR-all, sobre todas las salidas.
GPT-4 prompted con ReAct cae 24% de las veces, y casi el doble con el "hacking prompt".
Los agentes fine-tuned para function calling son bastante más resistentes.
El caso de usuario (el contexto donde llega la inyección) explica más el éxito del ataque que el tipo de ataque.

## Ataque o defensa que propone
Es un benchmark de ataque. El "hacking prompt" fijo de la configuración enhanced funciona como ataque de referencia. El paper no propone defensas.

## Números que reporta
- **Sección 3.2 / Tabla 3 (ASR-valid)**: GPT-4 prompted (ReAct) logra 24% en base y 47% en enhanced. Llama2-70B prompted supera el 80% en ambas. GPT-4 fine-tuned queda en 3.8% y GPT-3.5 fine-tuned en 6.6% (base). Todos los agentes, salvo Claude-2 prompted, suben la ASR en enhanced.
- En robo de datos, el paso de transmisión (S2), una vez extraído el dato, llega al 100% de éxito en GPT-3.5 y GPT-4 fine-tuned. El paso de extracción (S1) también supera al daño directo.
- **Sección 4.1 / Tabla 4**: Cramér's V entre éxito y caso de usuario = 0.28 (daño directo) y 0.31 (robo de datos). Entre éxito y caso de atacante = 0.18 y 0.20. Usan corrección de Bonferroni y un test de Wilcoxon (p = 5×10⁻⁵ y p = 0.0001).
- Los casos de usuario con alta "content freedom" (el campo donde va la inyección admite texto libre, p. ej. el cuerpo de un correo o una reseña) son más vulnerables (sección 4.1, Figura 4).

## Conexión con MESH
- **Valida la contabilidad de `batch.ts`**: InjecAgent separa ASR-valid de ASR-all porque las salidas inválidas no son ni éxito ni fracaso. `summarize()` en `apps/api/src/batch.ts` hace lo mismo: saca las corridas fallidas de las tasas, pero cuenta aparte `failedDangerous` para que un intento peligroso no se esconda en una corrida rota. Conviene reportar ambas tasas (sobre corridas completas y sobre el total) como hace InjecAgent.
- **El robo de datos en dos pasos se parece a una ruta de riesgo**: extraer y luego enviar. El éxito del segundo paso condicionado al primero es casi 100%, lo mismo que dice la tesis de MESH: una vez que la petición pasa el primer salto, los siguientes casi no filtran. `observeRiskPaths()` en `apps/api/src/harness/risk-paths.ts` ya tiene los datos para calcular "tasa de avance por salto" (P(salto k+1 | salto k)) en el lote.
- **"Content freedom"**: los correos BEC son el caso de máxima libertad de contenido (cuerpo libre). Los escenarios `rt_04_supplier_form_fields` y `bec_*` de `email-harness/scenarios/` permiten probar si un formulario estructurado (baja libertad) baja la ASR frente a la prosa.
- **El contexto pesa más que el ataque**: sugiere variar el rol del seed (CS vs CSM, `BATCH_AGENTS`/`BATCH_SEED` en `batch.ts`) como factor del experimento, no solo la técnica del correo.
- **Diferencia**: InjecAgent evalúa una sola acción con la respuesta de la herramienta fija. MESH ejecuta varios agentes de punta a punta, que es más realista pero más ruidoso y caro, y por eso necesita repeticiones e intervalos.
