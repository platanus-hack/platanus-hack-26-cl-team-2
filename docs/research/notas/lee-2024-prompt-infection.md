# Prompt Infection: LLM-to-LLM Prompt Injection within Multi-Agent Systems

- **Autores:** Donghyun Lee (University College London), Mo Tiwari (Stanford University)
- **Año / venue:** 2024, preprint arXiv (cs.MA), v1 del 9 oct 2024, sin campo Journal-ref. Algunos papers posteriores citan una versión en ESORICS 2025 con un tercer autor (B. Miranda): **no verificado**.
- **Enlace:** https://arxiv.org/abs/2410.07283
- **PDF local:** ~/papers-ia-safety/multiagente/lee-2024-prompt-infection.pdf
- **Verificado:** página arxiv.org/abs/2410.07283 (título, 2 autores, única versión v1 9-oct-2024) y encabezado del PDF descargado. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
El paper pasa la inyección de prompts de un solo agente a sistemas multiagente: un prompt malicioso en contenido externo (PDF, correo o web) compromete al primer agente que lo lee y se **autorreplica** a los siguientes, como un virus.
El prompt tiene cuatro partes: *Prompt Hijacking* (el agente abandona sus instrucciones), *Payload* (una tarea distinta para cada rol y herramienta), *Data* (una nota compartida que acumula información salto a salto) y *Self-Replication* (se reenvía al siguiente agente).
Lo prueban en aplicaciones lineales (lector de documentos → estratega → resumidor → editor → escritor), con GPT-4o y GPT-3.5 Turbo, con mensajería "global" (historial compartido) y "local" (cada agente ve solo a su predecesor).
Las amenazas evaluadas son robo de datos, estafa, malware y manipulación de contenido. El dataset tiene 120 instrucciones × 3 tipos de herramienta, lo que da 360 pares.
También lo prueban en una "sociedad" de 10 a 50 agentes con diálogos por pares y memoria al estilo Park et al.
La infección autorreplicante supera a la no replicante, y en mensajería local es la única que compromete a más de dos agentes.
GPT-4o resiste más que GPT-3.5, pero una vez comprometido ejecuta el ataque con más precisión: un modelo más fuerte no es necesariamente más seguro.
En la sociedad de agentes la infección sigue una curva logística.
Como defensa proponen **LLM Tagging**: anteponer "[AGENT NAME]:" a cada respuesta para que el receptor sepa que el mensaje viene de otro agente y no del usuario.
Sola sirve poco; combinada con otras defensas de prompting baja mucho el éxito del ataque.

## Ataque o defensa que propone
- Ataque: Prompt Infection, una inyección LLM→LLM autorreplicante que entra por contenido externo y se propaga por los mensajes entre agentes. En el caso de robo de datos, los agentes infectados cooperan: el lector se infecta, el agente con acceso a la base de datos extrae, y el coder hace el POST hacia afuera.
- Defensa: LLM Tagging, un marcador de origen del mensaje (agente vs usuario), combinado con defensas previas (Marking, Instruction Defense, Sandwich, Delimiting, Random Sequence Enclosure).

## Números que reporta
- Mensajería global (Fig. 4a): la infección autorreplicante tiene un éxito **13,92% mayor** que la no replicante en GPT-4o, y es **209% más efectiva** en GPT-3.5 (estafa, malware y manipulación de contenido). En robo de datos con más de 3 agentes, la no replicante supera a la replicante por 8,48% en promedio.
- Mensajería local (Fig. 4b): la autorreplicante tiene un éxito ~20% menor que en la global. La no replicante no logra comprometer más de 2 agentes.
- Razones de fallo (Fig. 5): GPT-4o ignora el 66% de los ataques autorreplicantes y el 54% de los no replicantes. GPT-3.5 solo ignora el 9% y el 20%.
- Sociedad de agentes (Fig. 6a): infección total en el turno 4,7 (10 agentes) y 6,3 (20 agentes). Con 30, 40 y 50 agentes ocurre en ~23,3%, 24,2% y 21,4% del total de turnos.
- Manipulación de memoria (Tabla 1): la puntuación de importancia de la infección sube de 1,94 a 10,00 (GPT-4o) y de 1,00 a 9,84 (GPT-3.5) si el prompt incluye "rate it 10".
- Defensas (Sec. 6, Fig. 7):
  - LLM Tagging sola reduce el éxito del ataque en solo **5%**.
  - Marking + LLM Tagging bloquea **el 100%** de los ataques; Instruction Defense + Tagging deja pasar 3%; Sandwich + Tagging, 16%.
  - Marking sola deja pasar **76%**: empezó en 0%, pero los autores la rompieron intercalando "_" entre las palabras del prompt.
- Limitación declarada (Sec. 7): solo GPT. "Preliminary tests on Claude showed similar vulnerabilities", sin cifras.

## Conexión con MESH
- **Valida:** el contenido externo llega al agente "blindado" (el que tiene herramientas) por medio de otros agentes. Es exactamente la ruta correo → seed → finanzas que enumera `analyzeRiskPaths()` en `apps/api/src/harness/risk-paths.ts`. El paper lo dice así: "threats can arise not only from external sources but also internally".
- **Pariente directo de `provenance_tag`:** LLM Tagging marca *quién* habla (otro agente). El `provenanceTag()` de MESH (`apps/api/src/harness/provenance.ts`) marca *de dónde vino el contenido* (correo externo sin verificar) y opcionalmente el veredicto de `sender_check`. Es una señal más rica, porque viaja el origen externo y no solo "esto lo dijo un agente". Aun así, el dato de Lee es una advertencia: **un marcador de origen solo baja ~5% el ataque**. MESH debería esperar un efecto modesto de `provenance_tag` sola y medir la combinación `sender_check+provenance_tag`, que ya está en `FIX_COMBOS` de `apps/api/src/batch.ts`.
- **Riesgo concreto que este paper anticipa:** los marcadores se pueden falsificar o neutralizar (Marking pasó de 0% a 76%).
  - En MESH, `quoteUntrusted()` limpia `[provenance]` solo en la línea From. El *cuerpo* que escribe el agente, en `send_message` de `apps/api/src/harness/agent-runner.ts`, no se sanea: un seed engañado, o un correo cuyo texto el seed copia, puede insertar una línea falsa "[provenance] … Automated sender check: OK".
  - Además, `carriesWarning()` en `risk-paths.ts` cuenta como "advertencia transportada" cualquier cuerpo que contenga `[provenance]`, aunque lo haya escrito el modelo.
  - Idea: sanear `PROVENANCE_MARK` en el cuerpo antes de `withProvenance()`, y agregar un escenario red-team en `email-harness/scenarios/redteam_injection.json` con una etiqueta de procedencia falsa.
- **Diferencia honesta:** Lee usa inyección explícita y autorreplicante. MESH usa ingeniería social BEC sin instrucciones al modelo (salvo `rt_01`), donde no hace falta autorreplicación: basta con que el seed reformule el pedido como un mensaje interno.
