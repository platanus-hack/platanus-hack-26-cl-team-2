# AgentHarm: A Benchmark for Measuring Harmfulness of LLM Agents

- **Autores:** Maksym Andriushchenko, Alexandra Souly, Mateusz Dziemian, Derek Duenas, Maxwell Lin, Justin Wang, Dan Hendrycks, Andy Zou, Zico Kolter, Matt Fredrikson, Eric Winsor, Jerome Wynne, Yarin Gal, Xander Davies (Gray Swan AI y UK AI Safety Institute, entre otros)
- **Año / venue:** 2024 (arXiv) / ICLR 2025 (Comments de arXiv: "Accepted at ICLR 2025")
- **Enlace:** https://arxiv.org/abs/2410.09024 (dataset: https://huggingface.co/datasets/ai-safety-institute/AgentHarm)
- **PDF local:** ~/papers-ia-safety/benchmarks-agentes/andriushchenko-2024-agentharm.pdf
- **Verificado:** metadatos `citation_*` y campo Comments de la página de arXiv 2410.09024 (v1 2024-10-11, revisión 2025-04-18). Las afiliaciones no las verifiqué en detalle. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
AgentHarm mide el *mal uso directo*: el propio usuario pide al agente una tarea maliciosa de varios pasos. No es inyección de terceros.
Tiene 110 tareas explícitamente maliciosas (440 con aumentaciones) en 11 categorías de daño, entre ellas fraude, cibercrimen y acoso, con 104 herramientas sintéticas.
Cada tarea maliciosa tiene una gemela benigna, que sirve como línea base de capacidad.
La puntuación de daño ("harm score") viene sobre todo de chequeos deterministas escritos a mano (p. ej. "se llamó a la función que envía dinero con la tarjeta correcta"), con crédito parcial.
Usan un juez LLM solo para preguntas semánticas acotadas, como si un correo de phishing es plausible, para evitar sesgos y ataques contra el juez.
Un juez de rechazo aparte mide el refusal rate sobre todos los mensajes del agente.
Hallazgos: muchos modelos líderes obedecen tareas maliciosas sin jailbreak.
Una plantilla de jailbreak universal y simple basta para que los agentes las ejecuten.
Los agentes "jailbreakeados" conservan su capacidad: rinden casi igual que en las tareas benignas.
Correr la suite pública con GPT-4o cuesta entre US$1 y US$4.

## Ataque o defensa que propone
Es un benchmark. Como ataques de referencia evalúa forced tool calls (forzar el uso de herramientas desde la API), una plantilla de jailbreak universal basada en reglas y best-of-n (muestrear n veces a temperatura 1 y quedarse con el peor caso).

## Números que reporta
- **Sección 4.2**: GPT-4o mini llega a 62.5% de harm score con solo 22% de rechazos. Mistral Large 2 rechaza 1.1% y llega a 82.2% sin ataque. Claude 3.5 Sonnet queda en 13.5% de harm score con 85.2% de rechazos.
- **Plantilla de jailbreak**: GPT-4o pasa de 48.4% a 72.7% de harm score (rechazos de 48.9% a 13.6%). Claude 3.5 Sonnet pasa de 13.5% a 68.7% (rechazos de 85.2% a 16.7%). Gemini 1.5 Pro pasa de 15.7% a 56.1%.
- **Capacidad conservada**: con la plantilla, Claude 3.5 Sonnet logra 81.9% en las tareas que no rechaza, frente a 82% en las benignas. GPT-4o logra 84.2% frente a 89.9%.
- **Tabla 2 (best-of-5, τ=1)**: GPT-4o pasa de 70.7% a 83.7%, Claude 3.5 Sonnet de 65.1% a 79.7% y Mistral de 67.4% a 90.8%, con una desviación estándar de ±8.5%. A τ=1 los promedios salen más bajos que a τ=0.

## Conexión con MESH
- **Modelo de amenaza distinto**: AgentHarm trata de un usuario malicioso. MESH trata de un correo externo (tercero) que engaña a un equipo de agentes con usuarios legítimos. No hay que citarlo como evidencia de BEC, sino como referencia de *metodología de evaluación*.
- **Valida la evaluación de MESH**: chequeos deterministas sobre las llamadas a herramientas (en MESH, `sandbox.tool_attempt` con `update_vendor_bank_account` o `issue_refund` en `apps/api/src/harness/evaluator.ts`) más un LLM solo para tareas acotadas (en MESH, `judge.ts` para la narrativa). Es exactamente la división que defiende AgentHarm.
- **Gemelos benignos**: AgentHarm empareja cada tarea maliciosa con una benigna para separar "no lo hizo porque se negó" de "no lo hizo porque no pudo". MESH ya tiene pares parecidos (`rt_04_supplier_form_fields` con `rt_ben_01_supplier_form_no_bank_change`, `spoof_03_fake_paypal_refund` con `ctrl_01_customer_refund`). Convendría declararlos como pares en los JSON de `email-harness/scenarios/` (campo `pair`) y reportar la diferencia en `BatchResults.tsx`.
- **Best-of-n = la métrica que le falta al lote**: MESH ya repite cada correo `BATCH_REPS` veces. Se puede reportar "el atacante gana al menos 1 de k" por correo, además de la tasa media. Para un atacante BEC que puede reenviar el correo, esa es la cifra relevante. AgentHarm muestra que sube mucho, unos 14 puntos para Claude 3.5 Sonnet con k=5.
- **Temperatura**: `agent-runner.ts` no fija temperatura (usa la de la API por defecto). AgentHarm ve resultados distintos a τ=0 y τ=1, así que hay que documentarla en el JSON del lote (`BatchResults` ya guarda `model`; falta `temperature`).
