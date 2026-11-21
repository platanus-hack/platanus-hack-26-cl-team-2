# Benchmarking and Defending Against Indirect Prompt Injection Attacks on Large Language Models

- **Autores:** Jingwei Yi, Yueqi Xie, Bin Zhu, Emre Kiciman, Guangzhong Sun, Xing Xie, Fangzhao Wu
- **Año / venue:** Preprint arXiv:2312.14197 (v1 21-dic-2023, v4 27-ene-2025); publicado en KDD '25 (31st ACM SIGKDD, Toronto, ago-2025), DOI 10.1145/3690624.3709179
- **Enlace:** https://arxiv.org/abs/2312.14197
- **PDF local:** ~/papers-ia-safety/inyeccion-indirecta/yi-2023-bipia.pdf
- **Verificado:** título, 7 autores y comentario "Accepted by KDD 2025" en arxiv.org/abs/2312.14197; la referencia ACM (KDD '25, DOI) aparece en la primera página del PDF v4. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Presenta BIPIA, que según los autores es el primer benchmark de inyección de prompts indirecta.
Cubre cinco tareas de aplicación: Email QA, Web QA, Table QA, resumen y Code QA, con ataques de texto y de código separados en conjuntos de entrenamiento y prueba.
Evalúan 25 LLMs (de GPT-4 a modelos abiertos de 3B a 70B) y encuentran que todos son vulnerables.
Hallazgo contraintuitivo: los modelos más capaces (más Elo en Chatbot Arena) son *más* vulnerables, porque siguen mejor cualquier instrucción, también la inyectada.
Atribuyen el éxito de los ataques a dos causas: el modelo no distingue contexto informativo de instrucciones accionables, y no tiene conciencia de que no debe ejecutar instrucciones del contenido externo.
De ahí salen dos defensas: *boundary awareness* (que el modelo sepa dónde está el límite del contenido externo) y *explicit reminder* (recordarle que no ejecute instrucciones del contenido externo).
Caja negra: prompting con ejemplos en contexto o con el contenido externo en otro turno del diálogo (multi-turn), más un recordatorio explícito.
Caja blanca: fine-tuning adversarial con tokens especiales que delimitan el contenido externo.
La defensa de caja negra mitiga pero no resuelve; la de caja blanca deja el ASR cerca de cero sin perder calidad.
El código está publicado en github.com/microsoft/BIPIA.

## Ataque o defensa que propone
Ambos: un benchmark de ataques (BIPIA) y dos defensas basadas en "boundary awareness + explicit reminder", en caja negra (prompting: in-context learning o multi-turn dialogue, Sección 6.1) y caja blanca (fine-tuning adversarial con tokens especiales, Sección 6.2).

## Números que reporta
- **Tabla 2 (sin defensa):** ASR global GPT-4 **31,03%**, GPT-3.5-Turbo **26,16%**. En Email QA, GPT-4 **15,24%**, GPT-3.5-Turbo **16,34%**; promedio de los 25 modelos en Email QA **7,30%**. Figura 2: correlación entre capacidad (Elo) y ASR, Pearson 0,6423 en todas las tareas y 0,6635 en las de texto (p < 0,001); en código no hay correlación (−0,0254).
- **Tabla 3 (caja negra):** GPT-4, ASR global **31,03% → 24,08%** (in-context) y **→ 20,56%** (multi-turn: contenido externo en su propio turno). GPT-3.5-Turbo **26,16% → 18,43%** (multi-turn). En Email QA con GPT-4: **15,24% → 9,59%** (multi-turn).
- **Tabla 4 (caja blanca, fine-tuning):** Vicuna-7B **12,37% → 0,53%**; Vicuna-13B **15,31% → 0,47%** (respuestas generadas con GPT-4), con ROUGE y MT-Bench similares.
- Conclusión de los autores: las defensas de caja negra "reducen el ASR pero no vuelven robustos a los LLMs".

## Conexión con MESH
- **Valida que el prompting solo no alcanza:** con el mejor prompting, GPT-4 sigue con ~21% de ASR. MESH no confía en el prompt del agente para la seguridad: `sandbox.ts` bloquea siempre `update_vendor_bank_account` y `sender-check.ts` es determinista ("no se le puede convencer"). Buena cita para justificar ese diseño.
- **"Más capaz = más vulnerable"** apoya la decisión de MESH de medir con modelos fuertes (Claude) y no asumir que un modelo mejor arregla el problema. Además sugiere un experimento barato: correr `apps/api/src/batch.ts` con dos modelos (p. ej. Haiku vs Sonnet) sobre `bec_realistic.json` y comparar `attack_succeeded`.
- **Boundary awareness entre agentes:** BIPIA define el límite entre "instrucción del usuario" y "contenido externo" *dentro de un prompt*. En MESH ese límite se pierde *entre agentes*: el agente de finanzas recibe por `read_inbox` (`apps/api/src/harness/agent-runner.ts`) un mensaje de un colega interno, que ni siquiera parece contenido externo. `provenance_tag` es boundary awareness llevado al mensaje entre agentes; `risk-paths.ts` (`provenanceVisible` por salto) mide justamente si ese límite sobrevive.
- **Idea concreta:** el correo hoy entra en el *primer turno de usuario* del seed como "Initial instruction / scenario" (`createSession()` en `agent-runner.ts`). La defensa multi-turn de BIPIA (contenido externo en un turno aparte, no mezclado con la instrucción) bajó el ASR de GPT-4 ~10 puntos. Fix candidato `email_turn`: entregar el correo como resultado de una herramienta `read_email` o como un turno separado y etiquetado, y medirlo en `batch.ts`.
