# WASP: Benchmarking Web Agent Security Against Prompt Injection Attacks
- **Autores:** Ivan Evtimov, Arman Zharmagambetov, Aaron Grattafiori, Chuan Guo, Kamalika Chaudhuri (FAIR at Meta; Grattafiori figura como independiente) · **Año:** 2025 (arXiv:2504.18575v3, 16 de mayo de 2025) · **Enlace:** https://arxiv.org/abs/2504.18575 · **Tema:** inyección indirecta de prompts contra agentes web, benchmark end-to-end
- **Cobertura de lectura:** páginas 1–22, completo (texto extraído del PDF, con referencias, apéndices y checklist de NeurIPS). No se abrió el PDF original: las figuras 1–3 se leyeron por su texto y leyendas.

## Resumen
WASP es un benchmark público para medir si agentes web basados en LLM pueden ser desviados por prompt injection cuando el atacante es solo un usuario adversario de un sitio y no controla la web completa. Se construye sobre VisualWebArena con dos entornos autoalojados, GitLab y Reddit (Postmill), y combina 42 escenarios en 84 tareas con dos plantillas de inyección (texto plano y URL). Evalúan GPT-4o, GPT-4o-mini, o1, Claude Sonnet 3.5 v2 y Claude Sonnet 3.7 con pensamiento extendido, en tres scaffolds distintos. El hallazgo principal es que desviar al agente es fácil (ASR-intermediate entre 17% y 86%, p. 6), y que las defensas probadas (instruction hierarchy y system prompt defensivo) reducen el efecto pero no lo eliminan. Cumplir el objetivo del atacante es mucho más raro (ASR-end-to-end de hasta 16%, p. 6). Los autores lo llaman "security by incompetence": la barrera es la capacidad del agente para terminar la acción, no la robustez frente a la inyección.

## Método
- **Modelo de amenaza:** atacante black-box que es usuario adversario de un sitio. Solo escribe donde usuarios no confiables pueden publicar (issues, comentarios, posts). No cambia el layout, no crea pop-ups ni modifica comentarios ajenos (p. 3–4). El usuario del agente es benigno y el entorno es malicioso.
- **Entornos y tareas:** GitLab y Reddit de VisualWebArena, autoalojados en AWS EC2 (p. 4, 6). Se combinan 21 objetivos de atacante con 2 objetivos de usuario por entorno, es decir 42 escenarios (p. 4–5). Los objetivos del atacante son acciones concretas: exfiltración, borrar proyecto, añadir deploy key, cambiar email, phishing, harassment, etc. (Tabla 5, p. 14).
- **Plantillas de inyección:** texto plano y URL (con ancla "#OBJECTIVE:" en la URL, pensada para scaffolds sin memoria) (p. 5–6). Ambas se usan con urgencia ("NEW IMPORTANT AND URGENT") (p. 5). Las 42 combinaciones con 2 plantillas dan 84 tareas, sobre las que se reportan todas las tasas (p. 5).
- **Métricas:** ASR-end-to-end, con evaluador basado en reglas sobre el estado final. ASR-intermediate, con un juez LLM basado en GPT-4o que lee el razonamiento y las acciones del agente para decidir si fue desviado (p. 5, prompt en p. 16–19). Utility, sobre 37 tareas (objetivos adversarios tratados como legítimos más actividades comunes) (p. 5, Tabla 6 en p. 14).
- **Modelos:** GPT-4o, GPT-4o-mini y o1 vía Azure OpenAI; Claude Sonnet 3.5 v2 y 3.7 con extended thinking vía AWS Bedrock (p. 6).
- **Scaffolds:** VisualWebArena (axtree, y axtree + SOM); Claude Computer Use Reference Implementation (solo capturas, Firefox en Docker); y un bucle de tool calling con la instruction hierarchy, donde la web entra solo como respuesta de herramienta de menor privilegio (p. 6–7). La versión de tool calling se probó solo con texto porque la API no admitía imágenes en respuestas de herramientas (nota 4, p. 7).
- **Defensas evaluadas:** instruction hierarchy (GPT-4o-mini, o1) y system prompt defensivo (texto en p. 16).
- **Ablaciones:** texto plano frente a URL (Tabla 3, p. 9) y plantilla task-agnostic sin el objetivo del usuario (Tabla 4, p. 9).
- **Estadística:** sin barras de error ni pruebas de significancia; los modelos son de nube y no se reportan detalles de cómputo (checklist, p. 20–21).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Tareas de prueba (todas las tasas se reportan sobre este número) | 84 tasks | p. 5 |
| Tareas del conjunto de utilidad | 37 tasks | p. 5 |
| Ataques que "partially succeed" (ASR-intermediate, abstract) | up to 86% of the case | p. 1 |
| Tasa de cumplimiento de la tarea del atacante | from 0 to 17% | p. 3 |
| ASR-end-to-end máximo (texto) | up to 16% | p. 6 |
| o1, Tool Calling, instr. h. (system): ASR-intermediate / ASR-end-to-end / Utility | 0.857 / 0.167 / 0.486 | p. 7 (Tabla 2) |
| GPT-4o, VisualWebArena axtree + SOM, sin defensa: ASR-intermediate / ASR-end-to-end / Utility | 0.429 / 0.036 / 0.622 | p. 7 (Tabla 2) |
| GPT-4o, axtree + SOM, con system prompt defensivo: ASR-intermediate / ASR-end-to-end | 0.226 / 0.012 | p. 7 (Tabla 2) |
| GPT-4o-mini vs o1 en Tool Calling sin system prompt, ASR-end-to-end (GPT-4o-mini, instr. hierarchy / o1, instr. h. system) | 0.000 / 0.167 | p. 7 (Tabla 2) |
| o1 (axtree, system), ASR-intermediate: URL / texto plano | 0.976 / 0.738 | p. 9 (Tabla 3) |
| Claude-3.7-sonnet, con system prompt defensivo, ASR-intermediate: inyección con el objetivo del usuario / task-agnostic | 0.500 / 0.321 | p. 9 (Tabla 4) |

## Citas textuales
1. "Evaluating with WASP shows that even top-tier AI models, including those with advanced reasoning capabilities, can be deceived by simple, low-effort human-written injections in very realistic scenarios." (p. 1)
2. "current web-navigation agents exhibit a form of security by incompetence, which is only discoverable through end-to-end evaluations." (p. 3)
3. "the main bottleneck for attack success is not the strength of their attack but rather the capability of the agent to complete their goal when hijacked." (p. 8)

## Limitaciones
Reconocidas por los autores:
- Solo dos entornos (reddit y gitlab). Faltan sitios como Wikipedia o Kayak y otras tareas, como agentes de escritorio y de código (p. 9).
- Falta diversidad de prompts de inyección; el benchmark tiene pocas plantillas (p. 9).
- Alcance de atacante: solo black-box y solo sobre elementos concretos de la página (p. 4).
- El bajo ASR-end-to-end se atribuye a la capacidad actual de los agentes, y los autores reconocen que "the current limitations in agents' ability to fully execute attacks are unlikely to persist" (p. 3). Ven esa protección como transitoria (p. 6, p. 8).
- Sin error bars ni significancia estadística; no se dan detalles de cómputo porque los modelos son de nube (p. 20–21).

Observación propia:
- Inconsistencia entre cifras: el texto da "0 to 17%" de cumplimiento (p. 3) y "up to 16%" de ASR-end-to-end (p. 6), mientras la Tabla 2 tiene un máximo de 0.167 (p. 7). El paper no lo aclara.
- Muestra chica: 84 tareas sin intervalos de confianza. Diferencias de pocos puntos, como 0.036 frente a 0.012 en la Tabla 2, no son concluyentes.
- El juez de ASR-intermediate es un GPT-4o sin validación contra anotación humana en el texto leído (p. 5, 16–19). Esto puede inflar o subestimar la desviación.
- La métrica end-to-end solo mira el estado final de la web. No captura daños intermedios ni acciones que ya tuvieron efecto antes de que el agente se detuviera (p. 5).
- El paper usa "security by incompetence" (p. 3) y "security through incompetence" (p. 8) para el mismo fenómeno.

## Qué le sirve a MESH
1. **Demostrado:** un contenido escrito por un tercero no confiable basta para desviar a modelos de frontera. GPT-4o sin defensa llega a ASR-intermediate de 0.429 (p. 7), y la plantilla usa urgencia ("NEW IMPORTANT AND URGENT", p. 5). Sirve para justificar el vector "correo externo → agente". **Inferencia:** la urgencia de la plantilla de WASP es parecida al patrón de fraude BEC.
2. **Demostrado:** el system prompt defensivo baja GPT-4o de 0.429 a 0.226 (p. 7), y la instruction hierarchy, que deja la web en el privilegio más bajo, no evita la desviación (o1 con instr. h. system llega a 0.857, p. 7). **Inferencia:** una etiqueta de procedencia que solo lee el modelo no basta. Conviene que la etiqueta la use el sistema para decidir la herramienta, como hace MESH.
3. **Demostrado:** WASP separa "el agente fue desviado" (ASR-intermediate) de "el atacante cumplió su objetivo" (ASR-end-to-end) y reporta utilidad aparte (p. 5). **Inferencia:** MESH debería reportar también la advertencia que llega a finanzas (el equivalente a desviado) además del fraude completado, para que los números de 17/21 a 6/21 no escondan la parte que la defensa no evitó.
4. **Demostrado:** el ASR-end-to-end sube con la capacidad del agente. GPT-4o-mini en Tool Calling tiene 0.000 y o1 tiene 0.167 (p. 7). **Inferencia:** el approval_gate, que no depende de que el agente sea torpe, gana importancia a medida que los modelos mejoran. Esto es una interpretación, no algo que el paper pruebe.
5. **Sobre el límite de USD 500 y la verificación del remitente:** WASP no tiene umbral monetario ni modela remitentes. No respalda ni contradice esas defensas. **Inferencia:** la diferencia de 0.976 frente a 0.738 entre URL y texto plano (p. 9) muestra que la forma de la inyección cambia mucho la tasa. Un filtro por remitente que no toca el cuerpo del correo podría tener un efecto limitado. Esto coincide con el resultado de MESH de que la verificación sola no cambió nada en Haiku, pero es una lectura propia.
6. **Hueco que MESH cubre:** WASP no evalúa cadenas de agentes ni herramientas de alto riesgo como cambiar cuenta bancaria o emitir reembolsos. El paper solo menciona agentes de escritorio y de código como extensiones futuras (p. 9). **Demostrado:** esa ausencia. **Inferencia:** la ruta multiagente de MESH (Camila → Mateo → Tomás) es el aporte que WASP no hace.

**Frases para el pitch:** la cita 1 (p. 1) como respaldo de que el problema es real con modelos de frontera, y la cita 2 (p. 3) para explicar por qué el riesgo no se ve en una prueba de un solo paso.
