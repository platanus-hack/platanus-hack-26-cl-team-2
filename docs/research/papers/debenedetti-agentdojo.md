# AgentDojo: A Dynamic Environment to Evaluate Prompt Injection Attacks and Defenses for LLM Agents
- **Autores:** Edoardo Debenedetti, Jie Zhang, Mislav Balunović, Luca Beurer-Kellner, Marc Fischer, Florian Tramèr · **Año:** 2024 (arXiv:2406.13352v3, NeurIPS 2024, Datasets and Benchmarks) · **Enlace:** https://arxiv.org/abs/2406.13352 · **Tema:** Benchmark de inyección indirecta de prompts y de defensas en agentes con herramientas
- **Cobertura de lectura:** páginas 1–26, completo (texto extraído del PDF, incluidos apéndices, tablas 1 a 5 y data card). No se revisaron visualmente las figuras (6–9, 20, 21): solo su texto extraído y sus pies. Las tablas salieron legibles en el texto, así que no hizo falta el PDF original.

## Resumen
Los agentes de IA con herramientas pueden ser secuestrados por datos que devuelven esas herramientas (correos, páginas web, resultados de búsqueda) para ejecutar acciones maliciosas en nombre del usuario. Para medirlo, los autores presentan AgentDojo, un entorno dinámico y extensible (no una suite fija) con 4 entornos (Workspace, Slack, Travel, Banking), 97 tareas de usuario, 27 tareas de inyección y 629 casos de seguridad, obtenidos cruzando tareas de usuario y de inyección. Cada tarea tiene una función determinística de utilidad y de seguridad que mira el estado del entorno, en lugar de un LLM que juzgue, porque un LLM juez también podría ser engañado por la inyección. Encuentran que los LLM resuelven menos de 66% de las tareas sin ataque, y que el ataque "Important message" ejecuta la acción maliciosa en 57.7% de los casos con GPT-4o (Tabla 4). Ninguna de las defensas evaluadas basta por sí sola (inferencia de esta nota; el paper dice que las técnicas actuales no son a prueba de fallos, p. 3): el detector de inyecciones baja mucho la ASR pero reduce la utilidad benigna, y el filtro de herramientas funciona bien salvo cuando la lista de herramientas no se puede planear de antemano o cuando las herramientas de la tarea bastan para el ataque. Los autores sugieren que pueden hacer falta mecanismos de aislamiento más elaborados y que el benchmark debe seguir evolucionando con ataques adaptativos.

## Método
- **Modelos:** Gemini 1.5 Flash y Pro, Claude 3 Sonnet y Opus, Claude 3.5 Sonnet, GPT-3.5 Turbo, GPT-4 Turbo, GPT-4o, Command R+ y Llama 3 70B (p. 6). Los análisis de ataques y defensas usan GPT-4o. El paper da dos razones en la misma página: que tiene la mayor utilidad benigna de la suite, y que Claude 3.5 Sonnet, aunque es el más capaz en benigno (78.22% en Tabla 3), se dejó fuera de los análisis porque salió después de la primera versión (p. 7).
- **Dataset:** 4 entornos con estado mutable (correo, calendario, nube, Slack, web, reservas, banca). Datos ficticios, generados a mano o con GPT-4o y Claude 3 Opus, revisados manualmente (pp. 4, 25). 97 tareas de usuario, 27 objetivos de inyección y 629 casos de seguridad (cruce de tareas de usuario con inyección del mismo entorno) (pp. 5–6). El texto dice 74 herramientas (p. 4); el pie de la Tabla 1 dice 70 (p. 6).
- **Métricas:** utilidad benigna (sin ataque); utilidad bajo ataque; targeted ASR (la acción maliciosa se ejecuta en el estado); y una ASR "adaptativa" que cuenta como éxito si cualquiera de un conjunto de ataques funciona por caso (p. 6). Intervalos de confianza del 95% (checklist, p. 15; tablas 3 a 5, p. 20).
- **Modelo de amenaza:** el atacante no controla el sistema ni el prompt del sistema; controla el contenido de placeholders en las salidas de herramientas que el agente va a leer. Puede tener conocimiento parcial del usuario y del modelo (p. 5, p. 8, Tabla 2).
- **Ataques:** "Important message" (Figura 19a, p. 19): mensaje que dice venir del usuario y ordena ejecutar la tarea maliciosa antes de la original. Comparados con "Ignore previous instructions", InjecAgent, "TODO" y un ataque adaptativo "Max" que elige el mejor por caso (pp. 8, 19; Tabla 4, p. 20).
- **Defensas:** delimitadores de datos (Hines et al.), detector de inyecciones (clasificador de ProtectAI, que el texto llama "BERT"), sandwiching o repetición del prompt tras cada llamada, y filtro de herramientas (el LLM elige, antes de leer datos no confiables, solo las herramientas necesarias) (pp. 8–9; Tabla 5, p. 20).
- **Agentes:** pipelines modulares con función de consulta; el prompt de sistema base (Figura 14) se usa con todos los modelos; Claude 3 y 3.5 Sonnet reciben además la Figura 15 y Llama 3 70B la Figura 16 (Figuras 11–16, pp. 16–18).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Tareas de usuario en AgentDojo | 97 | 1 |
| Casos de prueba de seguridad (pares tarea de usuario e inyección) | 629 | 1 |
| Tareas resueltas por LLM actuales sin ataque | less than 66% | 2 |
| GPT-4o, targeted ASR con "Important message" (Tabla 4; en Tabla 5, sin defensa: 57.69%) | 57.7%(±2.0) | 20 |
| GPT-4o, utilidad benigna sin ataque (Tabla 3) | 69.00(±3.61) | 20 |
| GPT-4o, targeted ASR con el ataque genérico (Tabla 3) | 47.69(±3.90) | 20 |
| GPT-4o con detector de inyecciones, targeted ASR (Tabla 5) | 7.95%(±2.1) | 20 |
| GPT-4o con detector de inyecciones, utilidad benigna (Tabla 5) | 41.49%(±3.9) | 20 |
| GPT-4o con filtro de herramientas, targeted ASR (Tabla 5) | 6.84%(±2.0) | 20 |
| GPT-4o con filtro de herramientas, ASR (texto; no coincide con la Tabla 5) | 7.5% | 9 |
| Casos en que las herramientas necesarias bastan para el ataque (filtro de herramientas no aplica) | 17% | 9 |
| Éxito del ataque cuando la inyección está al final del resultado de la herramienta (GPT-4o) | up to 70% | 8 |

## Citas textuales
- "Current LLMs solve less than 66% of AgentDojo tasks in the absence of any attack." (p. 2)
- "This defense fails, however, when the list of tools to use cannot be planned in advance" (p. 9)
- "succeed rarely when the attacker’s goal is abnormally security-sensitive (e.g., emailing an authentication code)." (p. 2)

## Limitaciones
Reconocidas por los autores:
- El filtro de herramientas falla cuando la lista de herramientas no se puede planear de antemano, cuando una llamada informa qué tarea sigue, o cuando las herramientas de la tarea ya bastan para el ataque (17% de los casos) (p. 9).
- No cubre contextos con varias tareas del usuario sin reiniciar el agente; una inyección podría pedirle al agente "esperar" a una herramienta útil para el ataque (p. 9).
- Las defensas de repetición del prompt probablemente no resisten ataques adaptativos (p. 9).
- Usan ataques y defensas "relativamente simples"; los autores creen que hará falta automatizar la especificación manual de tareas y criterios de utilidad para escalar sin perder fiabilidad (p. 9).
- Solo texto; no evalúan agentes multimodales (p. 10). No modelan restricciones de longitud o formato de la inyección (p. 10).
- Para Llama 3 70B usan un prompt distinto (p. 3, nota 2). Claude Opus tuvo acceso muy limitado y no se analizó en profundidad (p. 7).
- Los datos son ficticios; no hay datos reales ni PII (p. 15).
- Recomiendan no usar el benchmark solo con los ataques por defecto, sin un ataque adaptativo (p. 25).

Observación propia:
- Inconsistencias internas: 70 herramientas en el pie de la Tabla 1 y en p. 24, frente a 74 en p. 4 (la suma de la Tabla 1 da 74). El ASR del filtro de herramientas es 7.5% en p. 9 y 6.84% en la Tabla 5 (p. 20). El GPT-4o con "Important message" aparece como 47.69% en la Tabla 3 y como 57.7% en la Tabla 4 y 57.69% en la Tabla 5; la Tabla 3 no se explica.
- No hay análisis de sensibilidad a semillas ni a la variación entre ejecuciones; los intervalos son binomiales y asumen independencia entre casos.
- Los modelos son de 2024 (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5). No son comparables directamente con Haiku 4.5 ni Sonnet 4.6 de MESH.
- La inyección se coloca en la salida de una herramienta, no en el cuerpo de un correo que el agente recibe como mensaje. El "Important message" dice venir del propio usuario, no de un proveedor o de un ejecutivo como en un fraude BEC. La transferencia a BEC es parcial.
- La ASR mide si la acción se ejecutó en el estado. No mide si el humano responsable recibió alguna advertencia, que es la métrica de MESH en el lote multiagente.

## Qué le sirve a MESH
1. **Respalda la premisa, para un solo agente (demostrado).** Con GPT-4o, la inyección vía salida de herramienta logra la acción maliciosa en 47.69% de los casos (Tabla 3) y 57.7% con "Important message" (Tabla 4). Sirve para citar que el texto de datos externos dispara acciones de herramienta. No demuestra cadenas multiagente ni fraude BEC; eso sigue siendo aporte de MESH (inferencia).
2. **Una defensa dentro del prompt no basta (demostrado).** Los delimitadores de datos bajan la targeted ASR de 57.69% a 41.65% (Tabla 5, p. 20). El detector de inyecciones la baja a 7.95% pero reduce la utilidad benigna de 69.0% a 41.49% (Tabla 5, p. 20). Inferencia para MESH: la etiqueta de procedencia debe ser puesta por el sistema y aplicada por el sandbox, no pedida al modelo en el prompt. El paper no prueba etiquetas de sistema, así que esto es argumento, no resultado.
3. **El filtro de herramientas es el análogo más cercano a "rutas de riesgo", y su límite justifica approval_gate (demostrado + inferencia).** Baja la ASR a 6.84% (Tabla 5, p. 20; 7.5% en texto, p. 9), pero falla en 17% de casos cuando las herramientas de la tarea bastan para el ataque (p. 9). En MESH, reembolsar y cambiar la cuenta de un proveedor son herramientas de escritura que la tarea de finanzas necesita, así que el filtro no sirve. Lo que sí sirve es decidir por origen y monto, que es lo que hace approval_gate. Esta conclusión es mía.
4. **Métrica para copiar.** AgentDojo reporta tres cifras separadas: utilidad benigna, utilidad bajo ataque y targeted ASR (p. 6), con función de utilidad determinística y no LLM juez (p. 4). MESH reporta reembolsos fraudulentos (17/21 a 6/21 en Haiku, 8/21 a 3/21 en Sonnet) y 0 falsos positivos en 12 controles. Falta la utilidad bajo ataque: si el reembolso legítimo se sigue ejecutando con el correo fraudulento presente. Recomiendo añadirla (propuesta mía; el paper la define).
5. **Ataque y posición para copiar (demostrado).** El mensaje "Important message" (Figura 19a, p. 19) y la posición de la inyección al final del resultado de la herramienta (hasta 70%, p. 8) son dos factores que el paper reporta como los más eficaces de los que prueba (pp. 8, 19). Inferencia: en el correo de MESH, la instrucción de fraude debe ir al final del cuerpo, y conviene variar esa posición como parámetro del experimento.
6. **Límite de USD 500 y verificación del remitente: el paper no los evalúa.** No respalda ni contradice ninguno. Sí dice que los ataques "succeed rarely when the attacker’s goal is abnormally security-sensitive" (p. 2). Inferencia: un cambio de cuenta bancaria o un reembolso de poco monto no es un objetivo "anormalmente sensible", así que el paper no explica el fraude bajo USD 500 que MESH observa. Esto es un hueco para discutir en el pitch, no una prueba.

Frase para el pitch, con cita (p. 2): "Current LLMs solve less than 66% of AgentDojo tasks in the absence of any attack." Úsala con el dato de Tabla 4 (57.7%) para mostrar que el riesgo es real y medible.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 56 · corregidas: 8 · eliminadas: 0.
- Correcciones:
  - Resumen: la defensa "ninguna suficiente" es inferencia de la nota; el filtro de herramientas omitía el caso de planificación imposible (p. 9); "los autores concluyen que se requieren" pasa a "sugieren que pueden hacer falta" (p. 9).
  - Método, modelos: la razón para usar GPT-4o se atribuía solo a "mayor utilidad benigna"; el paper (p. 7) también dice que Claude 3.5 Sonnet es el más capaz en benigno (78.22%, Tabla 3) y que se dejó fuera por fecha de publicación.
  - Método, agentes: el prompt de sistema base es común (Figura 14); Figura 15 y 16 son adicionales para Claude y Llama (pp. 17-18).
  - Método, intervalos de confianza: la cita "pp. 6" no tiene respaldo; los CI están en el checklist (p. 15) y en las tablas 3 a 5 (p. 20).
  - Limitaciones: "no escala sin perder fiabilidad" es más fuerte que el paper, que dice que puede ser necesario automatizar (p. 9).
  - Qué le sirve a MESH, punto 5: el paper no dice que la posición y el ataque sean "los dos factores de mayor efecto"; reporta que son los más eficaces de los probados (pp. 8, 19).
- Pendiente: Nada. Las cifras se leyeron de las tablas 1 a 5 en el texto extraído, que salieron legibles; las figuras no se revisaron como imagen.
