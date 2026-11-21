# Prompt Infection: LLM-to-LLM Prompt Injection within Multi-Agent Systems
- **Autores:** Donghyun Lee (University College London), Mo Tiwari (Stanford University) · **Año:** 2024 (arXiv:2410.07283v1, 9 oct 2024) · **Enlace:** https://arxiv.org/abs/2410.07283 · **Tema:** inyección de prompts de LLM a LLM (autorreplicante) en sistemas multiagente, y defensa "LLM Tagging"
- **Cobertura de lectura:** páginas 1–14, completo (texto extraído del PDF, incluidas tablas 1 y 2, el apéndice A y las referencias). Las figuras 4–7 se leyeron por sus leyendas y por el texto que las describe; no se inspeccionaron las barras ni los gráficos, porque sus valores no aparecen en el texto. No se abrió el PDF para ninguna página.

## Resumen
El paper plantea que la inyección indirecta de prompts, bien estudiada en agentes individuales, es más peligrosa en sistemas multiagente porque un agente infectado puede contagiar a otros que nunca leyeron contenido externo. Proponen "Prompt Infection", un ataque autorreplicante: el prompt malicioso viaja dentro del contenido (PDF, correo, web), se copia en cada agente y ejecuta un payload por rol, como extraer datos y enviarlos por POST (robo de datos), enviar scams, difundir malware o manipular la memoria de agentes sociales. Los experimentos simulan aplicaciones multiagente con GPT-4o y GPT-3.5 Turbo, con 360 pares de instrucción y ataque, y una sociedad de 10 a 50 agentes. Encuentran que la autorreplicación supera a la inyección no replicante en la mayoría de los escenarios, y que el modelo más fuerte (GPT-4o) resiste mejor el primer contacto pero hace más daño una vez comprometido. Contra defensas basadas en prompt, ninguna sola basta: LLM Tagging (prefijar el nombre del agente de origen) baja la tasa de éxito solo 5%, y combinado con Marking o Instruction Defense la reduce a 0% o 3%. Los autores concluyen que una arquitectura distribuida no es más segura por sí misma.

## Método
- **Modelos:** GPT-4o y GPT-3.5 Turbo (OpenAI), en modo caja negra. Los autores solo probaron la familia GPT; Claude tuvo pruebas preliminares sin resultados completos (p. 10).
- **Aplicación multiagente (sección 5.1):** un agente de lectura (PDF/email/web), un agente de CSV y un agente programador, más strategist, summarizer, editor y writer. Dos modos de mensajería: global (historial completo) y local (solo historial del predecesor) (p. 5).
- **Datos:** 120 instrucciones de usuario en tres tipos de herramienta (email, PDF, web), con PDFs y correos sintéticos con prompts maliciosos. Eso da 360 pares de instrucción y ataque para scams, manipulación de contenido y malware. Para robo de datos, datos sintéticos en CSV (p. 5). Las páginas web no se modificaron: la inyección se hizo en el contenido recuperado dentro de la simulación.
- **Criterio de éxito:** robo de datos exige al menos tres agentes comprometidos (lector, CSV y programador) y un POST con los datos. Los demás ataques exigen que el último agente produzca salida maliciosa y oculte el prompt (p. 5).
- **Línea base:** infección no replicante, donde el prompt solo ordena "say 'perform A'" (p. 5).
- **Sociedad de agentes (sección 5.2):** pueblo de 10, 20, 30, 40 y 50 agentes con diálogos por parejas, GPT-4o y memoria tipo Park et al. (top K = 3). Inyección directa sobreescribiendo el system prompt, con un único agente infectado al inicio (p. 5).
- **Métricas:** tasa de éxito del ataque por tipo de amenaza y número de agentes; categorías de fallo ("Attack Ignored", "Mixed Action", "Deformed Infection", "No Action", "Agent Error") (pp. 6–7); turno de infección total y porcentaje de agentes infectados (p. 7); puntuación de importancia asignada por el modelo, promedio de 100 ejecuciones (p. 8).
- **Defensas (sección 6):** seis estrategias de prompt de Table 2 (delimitación de datos, Random Sequence Enclosure, Sandwich, Instruction Defense, Marking y LLM Tagging), con y sin LLM Tagging (pp. 8–9). Solo se usan técnicas que no requieren acceso a parámetros del modelo (p. 9).
- **Modelo de amenaza:** el atacante no tiene acceso al modelo ni al sistema. Inyecta un prompt en contenido externo que procesa un agente (PDF, email, web). Un agente sin exposición externa puede quedar infectado por mensajes de otros agentes (pp. 3–4).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| GPT-4o, global messaging, scam/malware/manipulación de contenido: autorreplicante vs no replicante | "Self-Replicating infection achieves a 13.92% higher success rate" | 6 |
| GPT-3.5, mismo escenario: autorreplicante vs no replicante | "for GPT-3.5, it is 209% more effective" | 6 |
| Robo de datos, global messaging: no replicante vs autorreplicante, al aumentar agentes | "Non-Replicating infection surpasses Self-Replicating infection by an average of 8.48%" | 6 |
| Autorreplicante: local vs global messaging | "about 20% lower in local messaging compared to global messaging" | 6 |
| Ataques ignorados por el modelo, autorreplicantes: GPT-4o / GPT-3.5 | "ignoring 66% of self-replicating attacks" / "GPT-3.5 only ignores 9%" | 7 |
| Puntuación de importancia del infection prompt, GPT-4o, sin manipulación → con manipulación | "1.94" → "10.00" | 8 |
| Puntuación de importancia del infection prompt, GPT-3.5, sin manipulación → con manipulación | "1.00" → "9.84" | 8 |
| Marking + LLM Tagging | "successfully prevents all attacks" | 9 |
| Instruction Defense + LLM Tagging | "reduces the attack success rate to just 3%" | 9 |
| Sandwich + LLM Tagging | "lowers the attack success rate to 16%" | 9 |
| LLM Tagging solo | "reduces the attack success rate by only 5%" | 9 |
| Marking solo | "still permits 76% of attacks" | 9 |

## Citas textuales
- "we reveal a more dangerous vector: LLM-to-LLM prompt injection within multi-agent systems." (p. 1)
- "However, GPT-4o’s higher precision makes it more dangerous once compromised." (p. 7)
- "However, none of the tested defense strategies, including LLM Tagging, prove particularly effective when used in isolation." (p. 9)

## Limitaciones
Reconocidas por los autores:
- Solo se probó la familia GPT. Claude mostró vulnerabilidades similares en pruebas preliminares, pero "full results were unavailable due to computational costs" (p. 10).
- Se examinaron arquitecturas multiagente básicas. Los autores creen que el ataque aplica a sistemas más complejos, pero no lo probaron (p. 10).
- Las defensas se evaluaron con ataques escritos a mano. Trabajos citados muestran que prompts generados algorítmicamente pueden evadir esas defensas (p. 10).
- En sistemas multiagente los prompts de ataque quedan expuestos, lo que permite detectarlos, pero los autores reconocen que hacen falta métodos más sigilosos para evadir la revisión manual (p. 10).
- Ética: no inyectaron prompts en sistemas públicos accesibles (p. 10).

Observación propia:
- Los resultados son de un solo arXiv v1 (octubre 2024), sin revisión por pares en la versión leída.
- Las tasas de éxito son proporciones sobre el conjunto sintético de pruebas (360 pares, más el lote de robo de datos). El texto no reporta intervalos de confianza ni desviaciones, y el número de repeticiones por celda no está claro salvo en Table 1 (100 ejecuciones).
- La cifra de 76% de Marking es lectura mía: el texto dice que la tasa inicial era 0% y que luego se añadió un contraataque (intercalar guiones bajos en el prompt), así que el 76% parece medirse después de ese contraataque. El paper no lo dice de forma explícita.
- El contraste "GPT-3.5 resiste más" se basa en categorías de fallo y en porcentajes de figura; los números de las figuras 4 a 6 no están en el texto y no los verifiqué visualmente.
- La sociedad de agentes usa inyección directa (sobreescritura del system prompt), no indirecta, por lo que no representa el vector de correo o documento (p. 5).
- El paper no prueba ninguna defensa a nivel de herramienta, sandbox, permisos ni aprobación humana; todas las defensas evaluadas son de prompt (p. 9).

## Qué le sirve a MESH
1. **Respalda la premisa "cada componente pasa su revisión, pero la ruta falla".** En el montaje de robo de datos, el agente DB Manager y el programador quedan infectados solo por mensajes recibidos de otros agentes, sin tocar contenido externo (demostrado, p. 4). Eso respalda que el riesgo está en la ruta y no en un agente aislado. Es una lectura mía que esto es exactamente lo que MESH llama "ruta de riesgo", pero el paper sí muestra el mecanismo de propagación.
2. **Etiqueta de procedencia (LLM Tagging).** El paper propone prefijar "[AGENT NAME]:" a las respuestas de agentes (p. 8), casi el mismo mecanismo que la etiqueta de MESH. Pero el paper demuestra que solo baja la tasa de éxito 5% (p. 9). Esto es un argumento a favor de que la etiqueta no sea suficiente sola. Que MESH pase de 4/12 a 12/12 de advertencias entregadas a finanzas (dato propio) muestra un efecto de visibilidad, no de bloqueo; el paper no mide eso. Inferencia mía: la etiqueta informa a finanzas, pero no detiene la acción, así que la aprobación en el sandbox sigue haciendo falta.
3. **Aprobación por procedencia.** El paper demuestra que las defensas de prompt son insuficientes cuando se usan solas (p. 9: "none of the tested defense strategies... prove particularly effective when used in isolation"). Eso apoya que la barrera esté fuera del modelo, como en approval_gate. El paper no evalúa ninguna compuerta a nivel de herramienta, así que este apoyo es indirecto. Inferencia mía.
4. **Métrica de ruta y criterio de éxito.** El criterio del paper para robo de datos exige tres agentes comprometidos con roles distintos (p. 5), y el ataque que llega al programador y luego a una herramienta de ejecución es una ruta de tres o más saltos (pp. 4–5). Conviene copiar esa forma de medir: contar cuántos saltos debe atravesar la infección antes de llegar a la herramienta peligrosa, y reportar el éxito por longitud de ruta. Esto es una propuesta de métrica, no un resultado del paper.
5. **Verificación del remitente y límite de USD 500.** El paper no evalúa ni verificación de remitente ni umbrales monetarios. Lo que sí muestra es que el vector entra por el contenido de un PDF, correo o web (p. 3), y que el ataque puede esconderse en el último eslabón omitiendo la replicación (p. 4). Inferencia mía: que el remitente esté verificado no impide que el contenido del mensaje lleve la carga, y que un fraude por debajo del umbral sigue siendo una ruta válida. Eso encaja con el hallazgo propio de MESH de que la verificación del remitente sola no cambió los resultados (8/12 con y sin ella en Haiku).
6. **Frases para el pitch (cita textual del paper):**
   - "These findings challenge the assumption that MAS are inherently safer due to their distributed architecture." (p. 2)
   - "stronger models are not inherently safer, as their enhanced capabilities may amplify the damage they can cause when breached." (p. 7)
   - Y la cita de la sección de limitaciones sobre la defensa combinada, usada solo si se quiere un argumento a favor de la estrategia en capas: "pairing LLM Tagging with other defense techniques, such as marking or instruction defense, is crucial for mitigating prompt infections." (p. 9)
