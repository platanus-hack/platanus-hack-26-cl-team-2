# Not what you've signed up for: Compromising Real-World LLM-Integrated Applications with Indirect Prompt Injection

- **Autores:** Kai Greshake, Sahar Abdelnabi, Shailesh Mishra, Christoph Endres, Thorsten Holz, Mario Fritz
- **Año / venue:** 2023. Preprint arXiv:2302.12173 (v1 23-feb-2023, v2 5-may-2023); publicado en AISec '23 (16th ACM Workshop on Artificial Intelligence and Security, junto a CCS '23), pp. 79–90, DOI 10.1145/3605764.3623985
- **Enlace:** https://arxiv.org/abs/2302.12173
- **PDF local:** ~/papers-ia-safety/inyeccion-indirecta/greshake-2023-indirect-prompt-injection.pdf
- **Verificado:** título y 6 autores en la página arxiv.org/abs/2302.12173 y en la cabecera del PDF (v2). El venue AISec '23 y el DOI se confirmaron por búsqueda web que devuelve la ficha de ACM DL (dl.acm.org/doi/10.1145/3605764.3623985); la página de arXiv no indica venue. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Es el paper que define la inyección de prompts *indirecta*: el atacante no le habla al modelo, sino que planta instrucciones en datos que la aplicación va a recuperar (webs, correos, documentos, código).
Su tesis central: las aplicaciones integradas con LLM borran la frontera entre datos e instrucciones, y procesar un prompt recuperado equivale a "ejecución arbitraria de código".
Proponen una taxonomía de amenazas desde la seguridad informática: robo de datos, fraude/phishing, malware, intrusión, contaminación de información y disponibilidad.
Distinguen métodos de inyección pasivos (contenido que se recupera al buscar) y activos (p. ej. enviar correos con prompts).
Demuestran los ataques contra sistemas reales (Bing Chat con GPT-4, motores de autocompletado de código) y contra apps sintéticas con GPT-4 y LangChain/ReAct.
Las apps sintéticas tienen herramientas: buscar, ver URL, leer/enviar correo, libreta de contactos, memoria.
Muestran que el ataque solo necesita describir el objetivo; el modelo decide solo cómo cumplirlo.
Introducen los "prompts como gusanos": un asistente de correo envenenado reenvía la inyección a otros asistentes que leen esos correos.
Como trabajo futuro señalan explícitamente los sistemas multiagente: propagación lateral de inyecciones entre agentes y engaño a un agente supervisor.
Concluyen que no hay mitigaciones efectivas y que el enfoque de parches (RLHF contra jailbreaks) es tipo "whack-a-mole".

## Ataque o defensa que propone
Ataque. Formaliza la inyección indirecta y su taxonomía, y la demuestra en ataques concretos: recolección de información por canales laterales, fraude/phishing a través del asistente, "spreading injections" (gusano por correo, Sección 4.2.3, Prompt 7 / Output 1), control remoto, persistencia en memoria, desinformación y DoS. No propone una defensa; la sección 5.6 (Mitigaciones) dice que los filtros y el RLHF no bastan.

## Números que reporta
No reporta tasas de éxito agregadas: es un estudio cualitativo de demostraciones (proof-of-concept) con capturas de prompts y salidas. Las cifras que aparecen son de configuración (p. ej. GPT-4 / text-davinci-003 en las apps sintéticas), no métricas de ataque. Para un pitch, sirve como origen del concepto, no por sus números.

## Conexión con MESH
- **Valida la premisa:** el escenario BEC de MESH es su "método activo de inyección" (un correo que llega a un agente con herramientas). Los escenarios `email-harness/scenarios/redteam_injection.json` (p. ej. `rt_01_injection_in_attachment_text`, comentario HTML "para el asistente de IA") y `ticket_injection.json` (`atk_02_ignore_prev`) son instancias directas de su taxonomía.
- **MESH responde a su trabajo futuro:** la Sección 5.3 ("Other Attack Directions") propone estudiar "lateral spreading of injections across agents" y "deceiving an LLM controller/supervisor agent". Eso es exactamente lo que modelan `apps/api/src/harness/risk-paths.ts` (rutas correo→agentes→herramienta) y `observeRiskPaths()` (rutas que realmente tomó la corrida). Es una cita natural para el pitch: "en 2023 lo dejaron como trabajo futuro; MESH lo mide".
- **Matiz que aporta:** en el gusano de Greshake el texto malicioso viaja *literal*. En MESH, el agente seed suele *parafrasear* el pedido ("el proveedor pide actualizar su IBAN"), así que el peligro es el lavado de origen, no la copia del texto. Por eso un detector de patrones de inyección en `send_message` no bastaría, y por eso `provenance_tag` (en `apps/api/src/harness/provenance.ts`) etiqueta el origen y no el contenido.
- **Idea concreta:** añadir una métrica de "propagación": cuántos saltos recorre el pedido externo antes de llegar a finanzas y si el texto llega literal o parafraseado (comparar n-gramas del correo con cada `agent.message_sent` en el trace que usa `observeRiskPaths`). Así se separan "gusano" y "lavado".
