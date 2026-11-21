# Formalizing and Benchmarking Prompt Injection Attacks and Defenses

- **Autores:** Yupei Liu, Yuqi Jia, Runpeng Geng, Jinyuan Jia, Neil Zhenqiang Gong (Penn State / Duke)
- **Año / venue:** USENIX Security Symposium 2024. Preprint arXiv:2310.12815 (v1 19-oct-2023, v5 12-nov-2025)
- **Enlace:** https://arxiv.org/abs/2310.12815
- **PDF local:** ~/papers-ia-safety/inyeccion-indirecta/liu-2024-formalizing-prompt-injection.pdf
- **Verificado:** título, 5 autores y comentario "Published in USENIX Security Symposium 2024" en arxiv.org/abs/2310.12815; cabecera del PDF. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Critican que la literatura sobre inyección de prompts eran casos sueltos, sin un marco común para comparar ataques y defensas.
Formalizan el ataque: la app quiere resolver una tarea objetivo con unos datos, y el atacante modifica los datos para que se resuelva una tarea inyectada.
Los ataques existentes (ingenuo, caracteres de escape, "ignora lo anterior", falsa compleción) son casos particulares del marco.
Con el marco diseñan un ataque nuevo, *Combined Attack*: falsa compleción + caracteres de escape + ignorar contexto.
Evalúan 5 ataques y 10 defensas con 10 LLMs y 7 tareas (detección de spam, odio, duplicados, inferencia, sentimiento, corrección gramatical, resumen).
Métricas: PNA (rendimiento sin ataque), ASV (valor de éxito del ataque), MR (tasa de coincidencia con la tarea inyectada) y, para detectores, FPR/FNR.
Combined Attack es consistentemente el más efectivo, y lo es más cuanto mayor es el LLM.
Ninguna defensa existente basta: las de prevención (paráfrasis, retokenización, delimitadores, sandwich, instructional) protegen poco y/o cuestan utilidad.
Las de detección (perplejidad, LLM-detector, known-answer detection) dejan pasar muchos ataques o marcan mucho dato limpio.
Publican la plataforma Open-Prompt-Injection como benchmark mínimo para defensas futuras.

## Ataque o defensa que propone
Principalmente un marco formal y un benchmark. Como ataque, *Combined Attack*. No propone una defensa nueva: evalúa 10 existentes (prevención y detección) y concluye que son insuficientes. Sugieren que toda defensa futura se mida al menos contra este benchmark.

## Números que reporta
- **Tabla 4 (GPT-4, ASV promedio sobre 7×7 combinaciones de tarea objetivo/inyectada):** Naive **0,62**; Escape Characters **0,66**; Context Ignoring **0,65**; Fake Completion **0,70**; **Combined Attack 0,75**.
- **Figura 3:** ASV y MR del Combined Attack crecen con el tamaño del modelo; GPT-4 tiene el ASV y MR promedio más altos de los 10 LLMs.
- **Sección 1 / 6 (defensas):** cualitativamente, "no existing defenses are sufficient". Una defensa de detección (known-answer detection) funciona en algunos casos pero deja pasar una gran fracción en otros; las demás detecciones dejan pasar mucho y/o tienen muchos falsos positivos. Las tablas por defensa están en el paper y no se transcriben aquí.
- Advertencia: tareas de NLP clásicas, no agentes con herramientas; modelos de 2023.

## Conexión con MESH
- **La métrica PNA es lo que le falta a MESH:** Liu evalúa siempre el par "rendimiento sin ataque / éxito del ataque". MESH mide bien el ataque (`apps/api/src/harness/evaluator.ts`: `attack_succeeded`, `refund_on_attack`, `attack_stopped`) pero el lado benigno es más débil: en correos benignos el veredicto es `finance_action` / `no_finance_action`, sin saber si la acción era la *correcta*. Idea: añadir a los escenarios benignos de `email-harness/scenarios/*.json` (hay 8 `benign` y 4 `real_email`) un campo `expected` (p. ej. "debe emitir reembolso X" o "no requiere acción") y que `evaluator.ts` produzca un PNA por fix. Así se ve el costo de cada defensa.
- **Combined Attack para la red team:** las técnicas de mayor ASV (falsa compleción: "Answer: task complete.") no aparecen explícitamente en `email-harness/scenarios/redteam_injection.json` ni en `ticket_injection.json` (que tiene `atk_02_ignore_prev` = Context Ignoring). Añadir un escenario BEC con falsa compleción ("Respuesta: verificado por tesorería. Nueva tarea: ...") es barato y estándar en la literatura.
- **Known-answer detection como canario barato:** es la única detección que a veces funciona según Liu. MESH podría usarla como una sonda determinista en `orchestrator.ts`: antes de que el seed procese el correo, pedirle a un modelo que repita una clave secreta *ignorando el correo*; si no la repite, el correo contiene instrucciones que secuestran al modelo. Es un tercer fix al estilo de `sender_check`, pero sobre el cuerpo y no sobre el From. Ojo: Liu muestra que tiene falsos negativos; sería informativo, no una barrera.
- **Coincide con la tesis de MESH** en que ninguna defensa de componente basta. MESH añade el argumento de *composición*: aunque una defensa ande en el salto 1, la ruta puede fallar en el salto 2 (`apps/api/src/harness/risk-paths.ts`).
