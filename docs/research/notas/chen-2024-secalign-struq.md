# SecAlign: Defending Against Prompt Injection with Preference Optimization

- **Autores:** Sizhe Chen, Arman Zharmagambetov, Saeed Mahloujifar, Kamalika Chaudhuri, David Wagner, Chuan Guo (UC Berkeley / Meta)
- **Año / venue:** Preprint arXiv:2410.05451 (v1 7-oct-2024, v3 3-jul-2025); publicado en ACM CCS 2025 (Taipéi), DOI 10.1145/3719027.3744836
- **Enlace:** https://arxiv.org/abs/2410.05451
- **PDF local:** ~/papers-ia-safety/inyeccion-indirecta/chen-2024-secalign.pdf (y el paper previo StruQ: ~/papers-ia-safety/inyeccion-indirecta/chen-2024-struq.pdf)
- **Verificado:** título, 6 autores y comentario "ACM CCS 2025" en arxiv.org/abs/2410.05451; referencia ACM en la primera página del PDF v3. Paper relacionado (base de SecAlign): **StruQ: Defending Against Prompt Injection with Structured Queries**, Sizhe Chen, Julien Piet, Chawin Sitawarin, David Wagner, arXiv:2402.06363; título y autores verificados en la cabecera del PDF, que dice "to appear at USENIX Security Symposium 2025" (venue no comprobado aparte en la web de USENIX). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Contexto (StruQ): separar instrucciones y datos con una "consulta estructurada". Un front-end seguro pone el prompt y los datos en canales distintos con delimitadores reservados que se filtran de los datos, y el LLM se afina para seguir solo las instrucciones del canal de prompt.
SecAlign parte de ahí: StruQ (fine-tuning supervisado) resiste ataques simples, pero cae ante ataques por optimización (GCG, AdvPrompter, NeuralExec).
Propuesta: construir un dataset de preferencias con entradas inyectadas, una salida *segura* (responde a la instrucción legítima) y una *insegura* (responde a la inyección).
Luego aplican optimización de preferencias (DPO) para que el modelo prefiera la salida segura. Es entrenamiento adversarial barato, sin generar ataques optimizados en el bucle.
Evalúan en cinco modelos (Llama-7B, Mistral-7B, Llama3-8B y sus versiones Instruct).
Consiguen 0% de ASR contra ataques sin optimización y, por primera vez según los autores, ASR mayormente bajo 10% contra ataques por optimización.
La utilidad (AlpacaEval2) queda prácticamente igual; en MMLU pierden 2–3%.
Las defensas solo de prompt (instrucciones, recordatorio, "sandwich", aislamiento) se rompen con ataques sin optimización.
Generalizan a benchmarks fuera de distribución, incluido InjecAgent (agentes con herramientas).
Los autores dicen haber usado después una versión mejorada para construir un modelo abierto de 70B con defensa incorporada.

## Ataque o defensa que propone
Defensa a nivel de modelo: (1) StruQ, separación de canales prompt/datos con delimitadores reservados más fine-tuning supervisado; (2) SecAlign, la misma separación más optimización de preferencias (DPO) entre respuesta segura e insegura ante datos inyectados.

## Números que reporta
- **Tabla 2 (ASR máximo sin optimización, %):** Llama3-8B-Instruct: sin defensa **51**; Instructional **38**; Reminder **35**; Isolation **50**; Sandwich **55**; In-Context **0,5**; **SecAlign 0**. Llama-7B: sin defensa **75**; mejor defensa de prompt **38** (Sandwich); **SecAlign 0**.
- **Tabla 3 (fuera de distribución, Llama3-8B-Instruct):** **InjecAgent ASR: 75,9% sin defensa → 2,2% StruQ → 0% SecAlign**. SEP "Ignore" ASR (inyección al inicio): 54,7 → 2,1 (StruQ) → 11,0 (SecAlign). Utilidad SEP: 50,0 → 18,9 (StruQ) → 46,6 (SecAlign).
- **Abstract / Sección 1:** ataques por optimización: ASR de SecAlign mayormente **< 10%**, reducción **> 4×** frente a StruQ; las defensas de prompt o fine-tuning previas tienen ASR por optimización **> 40%**.
- **Utilidad:** diferencia en AlpacaEval2 **< 0,7%** (dentro del error estándar); MMLU **−2 a −3%** (Tabla 4).
- **Tabla 1:** con el modelo de BIPIA (Vicuna-7B), SecAlign queda seguro con un costo trivial en utilidad, mientras que la defensa de BIPIA casi reduce a la mitad el WinRate de AlpacaEval2.

## Conexión con MESH
- **Lección de diseño 1: las defensas de prompt no son una barrera de seguridad.** En la Tabla 2, "Reminder" (35%) y "Sandwich" (55%) apenas mueven el ASR. El prompt de los agentes de MESH (`systemPrompt()` en `apps/api/src/harness/agent-runner.ts`) es neutro a propósito, "no 'resist' or 'obey' hints", y la seguridad dura vive fuera del modelo (`sandbox.ts`, que bloquea siempre `update_vendor_bank_account`). Esto respalda esa decisión con datos.
- **Lección de diseño 2: StruQ es exactamente "separar canales + filtrar delimitadores reservados".** MESH puede copiar la parte de *front-end* sin reentrenar nada: (a) el correo en un canal propio (resultado de herramienta, no turno `user`) y (b) filtrar del correo y de los mensajes de agentes los marcadores reservados del harness (`----- email -----` en `apps/api/src/email/scenarios.ts`, `[provenance]` en `apps/api/src/harness/provenance.ts`). Hoy `quoteUntrusted()` solo filtra `[provenance]` en el From, no en el cuerpo.
- **Límite que MESH demuestra y SecAlign no cubre:** SecAlign define ataque exitoso cuando el modelo *responde a la instrucción inyectada en los datos*. En la ruta de MESH el agente de finanzas no ve datos inyectados: ve una instrucción legítima en apariencia de un colega (el seed ya parafraseó). Un modelo "SecAlign perfecto" en finanzas no tendría nada que rechazar. Es un argumento para el pitch: la robustez a inyección por componente no se compone a lo largo de la ruta (`risk-paths.ts`, `provenanceAtSink`).
- **Idea de métrica (de Tabla 3):** reportar ASR *y* utilidad en la misma tabla. En `apps/api/src/batch.ts` ya se puede correr `BATCH_KINDS=attack,benign`; añadir a `apps/api/results/batch-latest.json` y a `apps/web/src/BatchResults.tsx` una columna "benignos bloqueados / sin acción" por combinación de fixes, como el par ASR/utilidad de SEP.
