# Why Do Multi-Agent LLM Systems Fail?

- **Autores:** Mert Cemri, Melissa Z. Pan, Shuyi Yang, Lakshya A. Agrawal, Bhavya Chopra, Rishabh Tiwari, et al. (13 autores, entre ellos Kurt Keutzer, Dan Klein, Matei Zaharia, Joseph E. Gonzalez e Ion Stoica; UC Berkeley e Intesa Sanpaolo)
- **Año / venue:** 2025. NeurIPS 2025, Track on Datasets and Benchmarks (según el encabezado del PDF v3). arXiv v1 17-mar-2025, v3 26-oct-2025.
- **Enlace:** https://arxiv.org/abs/2503.13657
- **PDF local:** ~/papers-ia-safety/multiagente/cemri-2025-mast.pdf (v3)
- **Verificado:** página arxiv.org/abs/2503.13657 (título, 13 autores, versiones) y PDF v3 ("39th Conference on Neural Information Processing Systems (NeurIPS 2025) Track on Datasets and Benchmarks"). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Pregunta por qué los sistemas multiagente rinden poco mejor que un agente solo en los benchmarks, y estudia sus fallas de forma sistemática.
Construyen **MAST**, la primera taxonomía de fallas de sistemas multiagente, a partir de 150 trazas anotadas por expertos (acuerdo entre anotadores κ = 0,88).
Luego anotan **MAST-Data**: más de 1600 trazas (1642 en la figura principal) de 7 frameworks (MetaGPT, ChatDev, HyperAgent, AppWorld, AG2, Magentic-One, entre otros).
La taxonomía tiene 14 modos de falla en 3 categorías: FC1 diseño del sistema, FC2 **desalineación entre agentes** y FC3 verificación de la tarea.
FC2 incluye: reinicio de conversación, no pedir aclaración, desvío de la tarea, **ocultar información** (information withholding), ignorar lo que dice otro agente y que el razonamiento no coincida con la acción.
Para escalar la anotación usan un juez LLM validado contra humanos.
Encuentran tasas de falla de 41% a 86,7% en 7 sistemas de código abierto del estado del arte.
Argumentan que las fallas de FC2 ocurren aunque los agentes hablen el mismo protocolo: es un "colapso de teoría de la mente", porque los agentes no modelan qué información necesita el otro. Estandarizar mensajes (MCP, A2A) no basta.
Muestran que mejoras de diseño ayudan (por ejemplo, +15,6% en ChatDev al agregar verificación del objetivo de alto nivel), pero no resuelven todo.
No es un paper de seguridad: estudia fallas benignas, sin adversario.

## Ataque o defensa que propone
- Ni ataque ni defensa: una taxonomía (MAST), un dataset (MAST-Data) y un anotador LLM-as-a-judge. Las intervenciones de ejemplo son verificación de alto nivel y especificación de roles.

## Números que reporta
- Acuerdo humano en la taxonomía: κ = 0,88. El juez LLM tiene 94% de exactitud y κ = 0,77 contra expertos. En sistemas y benchmarks no vistos, κ = 0,79.
- Fig. 1 (v3, 1642 trazas): FC1 diseño del sistema **44,2%**, FC2 desalineación entre agentes **32,3%** y FC3 verificación **23,5%**.
- Modos de FC2: no pedir aclaración 6,8%, desvío de la tarea 7,4%, **ocultar información 0,85%**, ignorar a otro agente 1,9%, razonamiento ≠ acción 13,2%, reinicio de conversación 2,2%.
- Verificación: sin verificación o incompleta 8,2%, verificación incorrecta 9,1%, terminación prematura 6,2%.
- Tasas de falla por sistema: de 41% a 86,7% (Fig. 5, Apéndice B).
- Intervenciones: +9,4% de éxito en ChatDev con un mejor prompt (mismo LLM, GPT-4o); +15,6% con verificación de alto nivel.

## Conexión con MESH
- **Valida desde el lado "no adversario":** cerca de un tercio de las fallas de sistemas multiagente son de coordinación *entre* agentes y no de un agente aislado. Las fallas son de ruta, no de componente.
- **La falla de MESH tiene nombre en MAST:** cuando el seed ve "SOSPECHOSO" en el `sender_check` pero no se lo pasa a finanzas, eso es "information withholding" (FM-2.4), combinado con no pedir aclaración (FM-2.2) del lado de finanzas.
  - MAST la registra rara en tareas benignas (0,85%). MESH puede mostrar que bajo ataque BEC es la falla dominante. Es un aporte claro.
- **Idea de métrica determinista, la "tasa de advertencia perdida":** en las corridas con `sender_check` encendido y veredicto `SUSPICIOUS`, contar cuántas veces el mensaje seed→finanzas no lleva advertencia escrita por el agente.
  - Se calcula con `agentWarned` en `observeRiskPaths()` (`apps/api/src/harness/risk-paths.ts`), sin LLM.
  - Se agrega como columna en `apps/api/src/batch.ts`.
  - Responde con números a la tesis "la advertencia se pierde en el primer traspaso".
- **Idea para `judge.ts`:** pedirle al juez (`apps/api/src/harness/judge.ts`) que etiquete cada corrida con los modos FC2 de MAST relevantes. Así los resultados de MESH quedan en un vocabulario reconocido en NeurIPS. Ojo: es un LLM-as-judge, así que es complementario al veredicto determinista de `evaluator.ts`.
