# The Attacker Moves Second: Stronger Adaptive Attacks Bypass Defenses Against LLM Jailbreaks and Prompt Injections
- **Autores:** Milad Nasr, Nicholas Carlini, Chawin Sitawarin et al. (14 autores, OpenAI, Anthropic, Google DeepMind, ETH Zürich y otros) · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2510.09023 · **Tema:** evaluación de defensas contra jailbreaks y prompt injection con atacantes adaptativos
- **Cobertura de lectura:** páginas 1–29, completo (texto extraído, incluye referencias y apéndices A–G). No fue necesario abrir el PDF: ninguna tabla salió ilegible en el texto.

## Resumen
El paper sostiene que la forma habitual de evaluar defensas contra jailbreaks y prompt injection está mal planteada: se usan conjuntos estáticos de prompts o optimizadores genéricos con poco presupuesto, que no fueron diseñados contra la defensa concreta. Proponen evaluar con atacantes adaptativos que ajustan su estrategia a cada defensa y gastan cómputo considerable (p. 1). Organizan los ataques en un bucle común de optimización con cuatro familias: gradiente, aprendizaje por refuerzo (RL), búsqueda evolutiva guiada por LLM y red-teaming humano (p. 4–5). Aplican estos ataques a 12 defensas de cuatro tipos: prompting, entrenamiento, filtros (detectores) y de conocimiento secreto (p. 5). Logran tasas de éxito superiores a 90% en la mayoría de los casos, y señalan que la mayoría de esas defensas había reportado casi cero (p. 1). El red-teaming humano logra éxito en todos los casos evaluados (p. 9). Concluyen que las evaluaciones empíricas no pueden probar robustez, solo fallar en romper la defensa (p. 9).

## Método
- **Modelo de amenaza:** tres configuraciones: whitebox, blackbox con logits y blackbox solo con generación (p. 3–4). Se asume un adversario con cómputo grande (p. 4).
- **Defensas (12):** prompting: Spotlighting, Prompt Sandwiching, RPO; entrenamiento: Circuit Breakers, StruQ, MetaSecAlign; filtros: Protect AI, PromptGuard, PIGuard, Model Armor; conocimiento secreto: Data Sentinel, MELON (Tabla 1, p. 17).
- **Benchmarks:** HarmBench para jailbreaks (p. 5, 18); AgentDojo para agentes, con un subconjunto de 80 muestras de las suites Slack, Travel y Workspace, sin la suite Banking (p. 18); OpenPromptInject y Alpaca para los no agénticos (p. 5, 18).
- **Atacante RL:** LLM sin alineación de seguridad; 5 rondas por sesión, 32 sesiones por muestra, actualización con GRPO (p. 16).
- **Atacante de búsqueda:** controlador MAP-Elites (OpenEvolve), mutador Gemini-2.5 Pro con máximo presupuesto de pensamiento, 8 candidatos por mutación, puntaje de un crítico de 1 a 10 (p. 20–21). Tope de 800 consultas; la mayoría se estanca entre 100 y 200 (p. 24–26).
- **Modelos objetivo de la búsqueda:** Gemini-2.5 Pro, GPT-5 Mini, Llama-3.3 70B y MetaSecAlign 70B, con cada defensa de AgentDojo (Tabla 7, p. 25).
- **Competencia humana:** más de 500 participantes, 40 desafíos y premios por US$ 20.000 (p. 5, 16–17). Cada envío puntúa 5.000 menos los tokens usados (p. 16, 22). Los humanos y el atacante de búsqueda se comparan en 29 escenarios (p. 23).
- **Métricas:** attack success rate (ASR). En AgentDojo cuenta solo la tarea de inyección, no la tarea del usuario (p. 21).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Defensas evaluadas con ataques adaptativos | 12 recent defenses | 1 |
| ASR de los ataques adaptativos en la mayoría de los casos | above 90% for most | 1 |
| ASR de ataques estáticos en Spotlighting y Prompt Sandwiching (AgentDojo) | as low as 1% | 5 |
| ASR con búsqueda adaptativa en Spotlighting y Prompt Sandwiching | above 95% for both defenses | 6 |
| ASR con RL contra RPO (HarmBench) | 98% | 6 |
| ASR estático reportado por MetaSecAlign (AgentDojo) | 2% | 7 |
| ASR con búsqueda contra MetaSecAlign (AgentDojo) | 96% | 7 |
| ASR con RL contra Circuit Breakers (HarmBench) | 100% | 7 |
| ASR con búsqueda contra MELON, Llama-3.3-70B | 76% | 8 |
| ASR en el subconjunto seleccionado: búsqueda vs. humanos colectivos | 69% vs. 100% | 9 |
| Gemini-2.5 Pro sin defensa (Tabla 7): ASR estático vs. búsqueda | 30% vs. 100% | 25 |

## Citas textuales
1. "We argue that this evaluation process is flawed." (p. 1)
2. "Indeed, defenses that merely report near-zero attack success rates on public benchmarks are often among the easiest to break once novel attacks are attempted." (p. 9)
3. "Overall, empirical evaluations cannot prove that a defense is robust; all it can (and should) do is fail to prove that the defense is broken!" (p. 9)

## Limitaciones
Reconocidas por los autores:
- Los ataques automáticos son "less reliable than image-based benchmarks like PGD" (p. 9).
- Los resultados no son comparables entre defensas: cada una usa su propio protocolo, y el paper no pretende comparar defensas (p. 5).
- Los clasificadores de seguridad usados como jueces son poco confiables y vulnerables a ejemplos adversarios (Lección 4, p. 9–10).
- En RL aparece reward hacking: repetir una cadena aumenta el puntaje sin probar nada sobre la defensa (p. 20).
- Comparar humanos con ataques automáticos es difícil: la habilidad varía, el costo por intento es distinto y los humanos invierten esfuerzo desigual por escenario (p. 23–24).
- La búsqueda corrió una sola vez por escenario, sin reinicios, y tiene alta varianza (p. 24).
- GPT-5 Mini queda por debajo del 80% de ASR en casi todas las combinaciones (p. 26).
- En la competencia humana, cada defensa se probó con un solo par usuario-inyección (p. 22).
- Los filtros tienen mala utilidad y falsos positivos altos en datos benignos (p. 7, 26).

Observación propia:
- El paper no evalúa compuertas deterministas (aprobación humana, límites de monto) ni verificación de procedencia. Todas sus defensas son modelos, prompts o detectores. No puede confirmar ni refutar directamente el approval_gate de MESH.
- El ASR del paper mide si el atacante cumple su tarea de inyección en un escenario de prueba. No es comparable con el conteo de fraudes sobre USD 500 de MESH (17/21 → 6/21, 8/21 → 3/21).
- El 100% humano sale de escenarios elegidos y con defensa conocida por el competidor. No es directamente comparable con los resultados de MESH.
- El paper trabaja con cientos de intentos por defensa. MESH tiene 21 por condición, así que el caso de "evaluaciones pequeñas engañosas" (Lección 1, p. 9) le aplica de lleno.

## Qué le sirve a MESH
1. **Respaldo para sacar la decisión del modelo (demostrado, parcial).** Los detectores basados en BERT (Protect AI, PromptGuard, Model Armor) superan 90% de ASR con búsqueda adaptativa, y PIGuard llega a 71% (p. 7). Esto respalda que la decisión de bloqueo no debe depender solo de clasificar el contenido. Inferencia: el approval_gate, que decide en el sandbox según monto y procedencia, no es un detector, y el paper no lo prueba.
2. **Etiqueta de procedencia (inferencia).** Los ataques del paper son texto inyectado dentro de datos que el agente procesa (p. 5–6, 27–29). Una etiqueta que pone el sistema, y no el modelo, no depende del contenido del correo. Un atacante adaptativo que controle el texto no controla la etiqueta. Esto no lo prueba el paper: MESH debería someter su etiqueta a un atacante adaptativo propio.
3. **Verificación del remitente (no respaldada).** El paper no la evalúa. No conviene citarlo como evidencia para ella. El resultado de MESH (8/12 con y sin verificación en Haiku) es coherente con la idea de que una defensa de identidad no cambia el contenido, pero la muestra es de 12 casos.
4. **Límite de USD 500 (inferencia).** El paper muestra que la búsqueda encuentra estrategias condicionales y específicas (p. 9, 19) y que el RL se ajusta a rechazos (p. 19–20). Un atacante con retroalimentación podría aprender montos justo bajo el umbral. Conviene probar montos cerca de 500 y reportar los fraudes bajo el límite como límite conocido, no como éxito de la defensa.
5. **Cómo reportar MESH (demostrado).** El paper pide reportar ataques adaptativos y no solo estáticos: Gemini-2.5 Pro sin defensa va de 30% estático a 100% con búsqueda (Tabla 7, p. 25). También pide no declarar robustez por ausencia de fallas (p. 9). Para MESH, esto implica presentar 17/21 → 6/21 y 8/21 → 3/21 como resultados de n chico, con intervalos, y los 0 falsos positivos en 12 controles como evidencia débil. El red-teaming humano también aparece como complemento necesario (Lección 3, p. 9).
6. **Frase para el pitch (demostrado, traducción propia).** "Defensas que reportan casi cero de ataques exitosos sobre benchmarks públicos suelen ser de las más fáciles de romper" (p. 9). Cita original: "defenses that merely report near-zero attack success rates on public benchmarks are often among the easiest to break once novel attacks are attempted." (p. 9)
