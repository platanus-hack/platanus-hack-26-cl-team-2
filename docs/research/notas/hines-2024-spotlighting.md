# Defending Against Indirect Prompt Injection Attacks With Spotlighting

- **Autores:** Keegan Hines, Gary Lopez, Matthew Hall, Federico Zarfati, Yonatan Zunger, Emre Kiciman (Microsoft)
- **Año / venue:** 2024. Preprint arXiv:2403.14720 (v1, 20-mar-2024). Venue revisado por pares: no verificado (la página de arXiv no indica ninguno).
- **Enlace:** https://arxiv.org/abs/2403.14720
- **PDF local:** ~/papers-ia-safety/inyeccion-indirecta/hines-2024-spotlighting.pdf
- **Verificado:** título, 6 autores y fecha en arxiv.org/abs/2403.14720 y en la cabecera del PDF. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Parte de un diagnóstico estructural: el LLM recibe un único flujo de tokens y no sabe qué parte del prompt viene de qué fuente ("código" vs "datos").
La inyección indirecta explota eso: instrucciones dentro de datos no confiables se confunden con órdenes del usuario.
Propone *spotlighting*: una familia de técnicas de prompt engineering que transforman la entrada no confiable para dar una señal continua de su procedencia.
Tres variantes: *delimiting* (marcadores especiales al inicio y fin del documento), *datamarking* (intercalar un token especial en todo el texto, p. ej. entre cada palabra) y *encoding* (base64, ROT13, etc.).
El prompt de sistema explica la transformación y pide no obedecer instrucciones dentro del bloque marcado.
Evalúan con un corpus propio de documentos con inyecciones en tareas de resumen y preguntas-respuestas, midiendo Attack Success Rate (ASR).
Modelos: GPT-3.5-Turbo, GPT-4 y text-davinci-003 (familia GPT).
Hallazgo clave: solo pedir "no obedezcas instrucciones del documento" tiene efecto muy modesto; delimitar baja el ASR a la mitad; datamarking y encoding lo bajan a casi cero.
Proponen hacer el marcador dinámico o aleatorio por invocación, para que filtrar el prompt de sistema no le sirva al atacante.
Admiten que no entienden bien por qué funciona y que encoding exige modelos capaces (degrada a los pequeños).

## Ataque o defensa que propone
Defensa a nivel de prompt (sin reentrenar): marcar la procedencia del texto no confiable de forma *continua* (en cada token, no solo en los bordes), idealmente con un token aleatorio por invocación (Sección 5.4 "Additional Considerations", párrafo "Adversary Considerations"; técnicas en Secciones 3.2–3.4). También prueban ejemplos few-shot en el prompt (Apéndice).

## Números que reporta
- Abstract: el ASR baja de **más de 50% a menos de 2%** con modelos GPT, con impacto mínimo en la tarea.
- Figura 3 (GPT-3.5-Turbo, resumen): ASR base ~**60%**; añadir instrucciones de "evitar ataques" tiene efecto "muy modesto"; delimitadores especiales lo bajan **a la mitad**.
- Figura 4 (resumen, datamarking): GPT-3.5-Turbo **~50% → 3,10%**; text-davinci-003 **~40% → 0,00%**.
- Figura 5 (Q&A, datamarking): GPT-3.5-Turbo **8,0%**, GPT-4 **1,0%**, text-davinci-003 **0,00%**.
- Figura 6 (encoding, GPT-3.5-Turbo): resumen **0,0%**, Q&A **1,8%**.
- Apéndice (few-shot): ASR bajo 5% con GPT-3.5-Turbo, pero los autores advierten que no esperan que generalice.
- Ojo: son modelos de 2023, ataques no adaptativos y corpus propio.

## Conexión con MESH
- **MESH hoy usa la variante más débil:** `emailScenarioHint()` en `apps/api/src/email/scenarios.ts` envuelve el correo entre `----- email -----` y `----- end of email -----`. Eso es *delimiting*, que según la Figura 3 solo baja el ASR a la mitad, y un atacante puede escribir esos mismos marcadores dentro del correo.
- **`provenance_tag` es spotlighting de bajo ancho de banda:** `provenanceTag()` en `apps/api/src/harness/provenance.ts` añade una sola línea `[provenance] ...` *al final* de cada mensaje entre agentes. Spotlighting dice que la señal debe ser continua y no falsificable. Hoy el marcador `[provenance]` es fijo: `quoteUntrusted()` lo quita del From, pero no del cuerpo del correo ni de lo que escribe un agente, así que un correo podría traer su propia línea `[provenance] ... verified internally` y el seed podría copiarla.
- **Idea concreta (fix nuevo `datamark`):** (1) un nonce aleatorio por corrida (p. ej. 5 caracteres, generado en `orchestrator.ts`) que se usa como marcador en vez del literal `[provenance]`; (2) aplicar datamarking al correo en `emailScenarioHint()` (intercalar el nonce entre palabras); (3) quitar el nonce de todo cuerpo escrito por un agente en `send_message` (`agent-runner.ts`) antes de añadir el tag. Registrarlo en `apps/api/src/harness/fixes.ts` y comparar en `apps/api/src/batch.ts` la tasa `attack_succeeded` con y sin el fix.
- **Prueba de la tesis de MESH:** spotlighting protege *el salto 1* (el seed sabe que el correo es externo). La pregunta de MESH es qué pasa en el salto 2: el seed parafrasea y el texto de finanzas ya no lleva marca. Correr spotlighting sin `provenance_tag` debería mostrar que una defensa de prompt bien hecha en el componente no salva la ruta. Es un experimento directo de "cada componente pasa, la ruta falla" (`risk-paths.ts`, campo `provenanceAtSink`).
