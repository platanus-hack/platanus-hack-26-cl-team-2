# Magentic-UI: Towards Human-in-the-loop Agentic Systems
- **Autores:** Hussein Mozannar, Gagan Bansal, Cheng Tan et al. · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2507.22358 · **Tema:** agentes con humano en el bucle, control de acciones de alto riesgo (action guard), inyección de prompts en web y archivos, sandboxing
- **Cobertura de lectura:** páginas 1–40, completo (incluye referencias, pp. 27–34, y apéndices A–D, pp. 35–40). Leído desde el .txt en tres tramos (líneas 1–1000, 1001–1500 y 1501–2030). No hizo falta el PDF.

## Resumen
Magentic-UI es un prototipo abierto de interfaz web para agentes con humano en el bucle, construido sobre una adaptación de Magentic-One: un Orchestrator coordina a WebSurfer, Coder, FileSurfer, agentes MCP opcionales y al propio usuario, tratado como un agente más (UserProxy). Los autores proponen seis mecanismos: co-planning, co-tasking, action approval (action guard), answer verification, memoria y multi-tasking. El action guard clasifica cada acción como siempre, quizá o nunca irreversible; las "quizá" pasan a un juez LLM que decide si pide aprobación humana (p. 14). En benchmarks web, con o4-mini iguala a Magentic-One en GAIA y AssistantBench (p. 16). Con un usuario simulado que tiene información lateral, la precisión en GAIA validación sube de 30.3% a 51.9% (p. 19). En 24 escenarios adversariales, la configuración por defecto no fue efectiva en ninguno; en una versión de desarrollo con las mitigaciones desactivadas, las inyecciones de prompt sí lograron exfiltrar llaves SSH y otros datos (pp. 23–24). Los autores concluyen que las mitigaciones de seguridad son necesarias, no solo la supervisión humana.

## Método
- **Sistema:** equipo multiagente sobre AutoGen AgentChat. WebSurfer (navegador en Docker, con lista de sitios permitidos), Coder (ejecuta código en Docker y reintenta hasta tres veces), FileSurfer y UserProxy (pp. 9, 13–14). Los agentes corren en contenedores separados, con un navegador propio sin cookies ni credenciales del usuario (pp. 9, 23).
- **Modelos:** o4-mini (2025-04-16) y GPT-4o (2024-08-06). Evaluaciones en abril y mayo de 2025 (p. 15).
- **Benchmarks autónomos (p. 15):** GAIA (165 pares de validación y 300 de test, según el texto), AssistantBench (214; 33 val y 181 test), WebVoyager (643 instrucciones, 15 sitios reales, juez GPT-4 con capturas) y WebGames (53 tareas). Métrica: tasa de completitud exacta (Tabla 1, p. 16).
- **Usuario simulado (pp. 17–19):** GAIA validación (162 tareas, según Fig. 11). Dos variantes: un usuario con o4-mini (más inteligente que los agentes) y un usuario con GPT-4o que conoce un plan humano escrito para cada tarea. Los agentes usan GPT-4o.
- **Estudio cualitativo (pp. 19–23):** 12 participantes, una hora, tres tareas en paralelo, escala SUS y entrevista semiestructurada. No mide productividad.
- **Seguridad (pp. 23–24, 38–39):** 24 escenarios internos en la configuración por defecto: direct (4), social_eng (7), injection_file (3), injection_web (9) y self_access (1). Luego, una versión de desarrollo con mitigaciones desactivadas, con GPT-4o. Modelo de amenaza implícito: contenido web o archivos con instrucciones maliciosas, phishing, pedidos de permisos OAuth y acceso a llaves privadas. No hay modelo formal de amenaza.
- **Action guard (pp. 14, 36–37):** heurística por acción (always / maybe / never irreversible). Las "maybe" van a un juez LLM con prompt que responde YES o NO y, ante la duda, pide aprobación.

## Números clave
| Dato | Valor | Página |
|---|---|---|
| GAIA (test), tasa de completitud exacta, Magentic-UI (o4-mini) | 42.52 | 16 |
| GAIA (test), Human | 92.00 | 16 |
| WebVoyager, Magentic-UI (o4-mini), solo WebSurfer | 82.2 | 16 |
| WebVoyager, Magentic-UI (GPT-4o) | 72.2% | 16 |
| WebVoyager, duración mediana de tareas correctas vs incorrectas | 113.9s vs 236.7s | 16 |
| GAIA validación, precisión de Magentic-UI autónomo → con usuario simulado que tiene información lateral (GPT-4o) | 30.3% → 51.9% | 19 |
| GAIA validación, tareas en que Magentic-UI pide ayuda al usuario simulado | 10% | 19 |
| WebGames, probabilidad de replanificar | 52.9% | 17 |
| Estudio cualitativo, participantes | 12 | 19 |
| Estudio cualitativo, SUS (System Usability Scale) | 74.58 | 20 |
| Estudio cualitativo, participantes que usarían el sistema con frecuencia | 41.7% | 20 |
| Escenarios adversariales internos, configuración por defecto | 24 | 23 |

## Citas textuales
1. "Their growing autonomy and ability to interact with the outside world, also introduces safety and security risks including potentially misaligned actions and adversarial manipulation." (p. 1)
2. "In both cases, Docker sandboxing is crucial for isolating agent activity and mitigating numerous security risks." (p. 9)
3. "However, prompt injections proved to be a more reliable exploit: by varying the text in Figure 15, we were able to convince Magentic-UI to:" (p. 24)

## Limitaciones
Reconocidas por los autores:
- El rendimiento en benchmarks generales sigue por debajo del humano. Falla en coding avanzado (SWE-Bench), video, secuencias largas de acciones web y computer use general (p. 26).
- Diseñado y probado solo en inglés. Las salidas pueden tener errores, fabricaciones o sesgos heredados del modelo (p. 26).
- No mide beneficios de productividad. Solo hay simulación y evaluación cualitativa; eso requeriría ensayos controlados de largo plazo (p. 26).
- Los resultados con usuario simulado son "a lower bound" del valor del feedback humano, porque los usuarios reales pueden intervenir en cualquier momento (p. 18).
- Varios participantes consideraron excesivas las solicitudes de aprobación. Calibrar cuándo interrumpir sigue abierto (p. 25).
- En multitarea, verificar que el agente cumplió la meta es difícil. El resultado final no basta (pp. 25–26).
- El plan es un DSL de pasos en lenguaje natural: no admite ramas ni pasos paralelos (p. 25).
- Las prácticas de evaluación de WebVoyager varían entre trabajos (p. 15).

Observación propia:
- Las corridas de benchmark se hicieron con los action guards apagados ("all actions are auto-approved", p. 14). Los números de tarea no miden el costo ni el efecto de la aprobación humana.
- La seguridad se reporta como comportamiento observado por escenario (Apéndice D, pp. 38–39). No hay repeticiones, N por categoría ni tasa de éxito de ataque en la configuración por defecto. El resultado es cualitativo ("none of the adversarial scenarios were effective", pp. 23–24). En la versión sin mitigaciones tampoco hay conteo.
- El juez LLM del action guard (Apéndice B, pp. 36–37) no tiene medición de precisión ni de falsos negativos.
- Inconsistencias internas: GAIA validación figura con 165 (p. 15) y con 162 (p. 18). GAIA test figura con 300 (p. 15) y con N=301 (Fig. 10, p. 18). WebGames figura con 53 tareas (p. 15) y con N=51 (Fig. 10, p. 18). En la Tabla 1, la fila de Magentic-UI (o4-mini) lleva 45.5** en WebGames, pero la nota ** dice que se usó GPT-4o (p. 16).
- Los modelos (o4-mini, GPT-4o) y la fecha de evaluación (abril-mayo 2025) limitan la comparación con modelos actuales.

## Qué le sirve a MESH
1. **Respalda (lo demuestra el paper, en su experimento):** la configuración por defecto, con sandbox y aprobación humana, no fue efectiva en ninguno de los 24 escenarios. Sin mitigaciones, la inyección de prompt sí exfiltró llaves SSH (pp. 23–24). Esto apoya que la defensa de MESH esté fuera del modelo. No prueba nada sobre fraude BEC de montos bajos.
2. **Contraste clave (lo demuestra el paper, el resto es inferencia mía):** el action guard decide por tipo de acción y, en los casos "maybe", con un juez LLM (p. 14). No usa la procedencia del dato. MESH decide en el sandbox, por procedencia (correo externo) y monto (más de USD 500), sin pasar por el modelo. Inferencia mía: un reembolso pedido por un correo externo puede verse como "maybe irreversible" para el juez, y el paper no mide con qué frecuencia lo deja pasar. Es el argumento más fuerte para el pitch.
3. **Sandbox como frontera (cita):** "In both cases, Docker sandboxing is crucial for isolating agent activity and mitigating numerous security risks." (p. 9). Sirve para decir que el límite lo impone el entorno, no el prompt, y el paper lo documenta con navegador separado y sin credenciales (p. 23).
4. **Verificación del remitente:** el paper no tiene verificación de origen. Lo más cercano es la lista de sitios permitidos, que pide aprobación con la URL exacta, el título y el motivo (pp. 13, 26). Es un control por destino, no por origen del contenido. Conviene citarlo como contraste, no como respaldo.
5. **Etiqueta de procedencia y límite de USD 500:** no aparecen en el paper. No lo respalda ni lo contradice. Hay que presentarlos como decisión propia de MESH, sin atribuirlos a Magentic-UI.
6. **Qué copiar:** la tabla de 24 escenarios con categorías (direct, social_eng, injection_file, injection_web, self_access) y su columna "Observed Behavior" (Apéndice D, pp. 38–39) sirve de formato para el catálogo de rutas de MESH. La Figura 15 (p. 40) describe una página que anticipa que la va a resumir un LLM y que apunta a la llave privada, un caso de inyección indirecta reutilizable como prueba.
- **Frase para el pitch:** "prompt injections proved to be a more reliable exploit" (p. 24). Respalda que la inyección indirecta es el vector que hay que cubrir, no solo el phishing.
