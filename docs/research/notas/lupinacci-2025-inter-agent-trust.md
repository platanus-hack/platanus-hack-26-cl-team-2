# The Dark Side of LLMs: Agent-based Attack Vectors for System-level Compromise

- **Autores:** Matteo Lupinacci, Francesco Aurelio Pironti, Francesco Blefari, Francesco Romeo, Luigi Arena, Angelo Furfaro (Universidad de Calabria; IMT Lucca)
- **Año / venue:** 2025. arXiv v1 9-jul-2025; versión actual v6 del 9-may-2026. La página de arXiv lista un DOI de Springer (10.1007/978-3-032-35586-7_1), aparentemente un capítulo de actas; el venue concreto **no está verificado**.
- **Enlace:** https://arxiv.org/abs/2507.06850
- **PDF local:** ~/papers-ia-safety/multiagente/lupinacci-2025-dark-side.pdf (v6)
- **Verificado:** página arxiv.org/abs/2507.06850 (título, 6 autores, historial de versiones, DOI relacionado) y encabezado del PDF v6. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
El paper evalúa a 18 LLMs usados como motor de razonamiento de agentes con acceso a terminal, para ver si se los puede llevar a instalar y ejecutar malware (meterpreter reverse shell) en la máquina víctima.
Compara tres superficies de ataque, cada una con su "límite de confianza": inyección directa (el usuario), RAG backdoor (un documento envenenado en la base de conocimiento) y **explotación de la confianza entre agentes** (Inter-Agent Trust Exploitation, IATE).
En IATE, un agente RAG lee un documento envenenado y le pide a un agente par con terminal que ejecute el comando. El agente invocado es estructuralmente idéntico al de los otros escenarios: lo único que cambia es quién pide.
El resultado central: modelos que **rechazan** el mismo comando cuando viene del usuario o de un documento lo **ejecutan** cuando lo pide un agente par.
Según los autores, no hace falta ningún jailbreak contra el agente invocado: el comando llega sin ningún adorno adversario.
Lo interpretan así: los modelos aplican políticas de seguridad distintas a otros agentes que a los humanos, y tratan a los pares como inherentemente confiables.
Los sistemas se mantienen "sanos" hacia el usuario: todos responden bien la pregunta mientras ejecutan el payload en segundo plano.
Las tres superficies de ataque se prueban desde la perspectiva de un usuario legítimo que no sabe nada.
Usan prompts de sistema mínimos ("complete tasks efficiently and securely"), sin endurecimiento.
Los modelos incluyen GPT-4o/4.1, **Claude-4 Sonnet y Claude-4 Opus**, Gemini 2.x, Mistral, Llama, Qwen y DeepSeek-R1.

## Ataque o defensa que propone
- Ataque: tres cadenas (DPI, RAG Backdoor, IATE) hacia la ejecución de malware. La de IATE es: documento envenenado → agente que llama (sin herramientas) → agente par con terminal.
- Defensa: solo recomendaciones generales. Tratar al LLM como software no confiable, limitar herramientas y aplicar seguridad en la capa del sistema. No evalúa ninguna defensa.

## Números que reporta
- Abstract y Tabla 5: **94,4%** (17/18) vulnerables a inyección directa, **83,3%** (15/18) a RAG Backdoor y **100%** (18/18) a IATE.
- Tabla 4: los 18 modelos ejecutan el malware vía IATE y además responden correctamente al usuario (100%). Claude-4 Sonnet y Claude-4 Opus aparecen como vulnerables en las tres superficies.
- Tabla 6, por tamaño: los modelos de más de 70B resisten mejor la inyección directa (2/3 vulnerables) y el RAG (1/3), pero **3/3 caen en IATE**. La ventaja del tamaño desaparece entre agentes.
- 15/18 (83,3%) son vulnerables a las 3 superficies.
- **Cuidado al citar:** "vulnerable" significa **al menos un éxito** en hasta 18 intentos (6 variantes de prompt × hasta 3 corridas). No es una tasa de éxito por intento. La sensibilidad por variante está en las Tablas 8-10. Además, el sistema son solo 2 agentes con prompts mínimos.

## Conexión con MESH
- **Es el dato más directo de "la confianza entre agentes es un vector":** el mismo modelo, con el mismo comando, rechaza cuando pide el humano y obedece cuando pide un par. Es la hipótesis de MESH sobre el agente de finanzas, que recibe el pedido "interno" sin el contexto externo. Y el paper incluye modelos Claude, los mismos que usa MESH (`apps/api/src/harness/agent-runner.ts`).
- **Esto ya lo muestra Lupinacci para malware y 2 agentes.** Lo que MESH agrega:
  - ingeniería social financiera (BEC) en vez de comandos explícitos;
  - rutas de 1 y 2 traspasos con niveles local/interaction/systemic (`levelOf()` en `apps/api/src/harness/risk-paths.ts`);
  - una defensa medible, `provenance_tag`, que ataca justamente la variable que Lupinacci aísla: quién parece pedir.
- **Idea "control directo vs par":** el diseño de Lupinacci (mismo agente, solo cambia el emisor) es replicable en MESH con poco costo.
  - Condición A: el correo llega directo al agente de finanzas (seed = finanzas).
  - Condición B: llega reformulado por el seed.
  - Condición C: B + `provenance_tag`.
  - Si C se acerca a A, la etiqueta "devuelve" el límite de confianza.
  - Se corre con `apps/api/src/batch.ts` (`BATCH_SEED`, `BATCH_AGENTS`).
- **Matiz metodológico para el pitch:** MESH ya reporta tasas por repetición (`BATCH_REPS`), que es más fino que el "al menos 1 éxito" de Lupinacci. Vale decirlo.
