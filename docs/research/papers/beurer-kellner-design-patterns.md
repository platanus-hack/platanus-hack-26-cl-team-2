# Design Patterns for Securing LLM Agents against Prompt Injections
- **Autores:** Luca Beurer-Kellner, Beat Buesser, Ana-Maria Creţu, Edoardo Debenedetti, Daniel Dobos, Daniel Fabian, Marc Fischer, David Froelicher, Kathrin Grosse, Daniel Naeff, Ezinwanne Ozoani, Andrew Paverd, Florian Tramèr, Václav Volhejn · **Año:** 2025 (arXiv:2506.08837v3, 27 jun 2025) · **Enlace:** https://arxiv.org/abs/2506.08837 · **Tema:** prompt injection; patrones de diseño a nivel de sistema para agentes LLM con herramientas
- **Cobertura de lectura:** páginas 1–32, completo (cuerpo, Tabla 1, referencias y Apéndice A, leídos en el .txt de las 1584 líneas). No fue necesario abrir el PDF; la Tabla 1 se leyó en texto y es legible.

## Resumen
El paper parte de que los agentes LLM con acceso a herramientas y a datos de terceros son vulnerables a prompt injection, y que las defensas heurísticas (filtros, detectores, entrenamiento adversarial) no ofrecen garantías (p. 2–3). Proponen seis patrones de diseño que separan el flujo de control del procesamiento de datos no confiables: action-selector, plan-then-execute, LLM map-reduce, dual LLM, code-then-execute y context-minimization (p. 4–9). El principio común es que, una vez que el agente ingiere input no confiable, ese input no debe poder disparar acciones con efectos secundarios (p. 4). Aplican los patrones a diez casos de estudio, desde un asistente de sistema operativo hasta un agente de programación, comparando un diseño ingenuo contra uno endurecido (p. 9–27). Su conclusión es que los patrones muestran un trade-off entre utilidad y seguridad, que no hay un patrón único suficiente y que conviene combinarlos y definir fronteras de confianza explícitas (trade-off: p. 2; recomendaciones: p. 28). El paper no tiene experimentos: la seguridad se argumenta por diseño y las utilidades y riesgos se califican de forma cualitativa.

## Método
- **Tipo de trabajo:** propuesta conceptual y análisis de diseño. No hay implementación evaluada ni medición de tasas de ataque.
- **Patrones (sección 3.1, p. 4–9):** seis patrones que aíslan el control del flujo de datos no confiables. Además, el Apéndice A (p. 31–32) lista buenas prácticas generales: sandboxing de acciones, formato estricto de datos, permisos del usuario, confirmación del usuario y atribución de datos y acciones.
- **Casos de estudio (sección 4, p. 9–27):** diez aplicaciones (OS assistant, SQL agent, asistente de correo y calendario, chatbot de atención al cliente, asistente de reservas, recomendador de productos, screening de currículums, chatbot de prospectos de medicamentos, diagnóstico médico con intermediario LLM y agente de ingeniería de software). Cada uno tiene threat model, diseños posibles y una evaluación cualitativa de "Utility" y "Security" (p. 10 para la tabla resumen).
- **Modelos, datasets, tamaño de muestra y métricas:** no se mencionan ni se usan. Las evaluaciones son argumentativas.
- **Modelo de amenaza:** el atacante controla contenido de terceros (archivos y nombres de archivo, correos e invitaciones de calendario, reseñas, currículums, contenido de proveedores) o el propio prompt del usuario (p. 2; archivos, p. 10; correos y calendario, p. 15; proveedores, p. 19; reseñas, p. 21; currículums, p. 22; prompt del usuario, p. 9, 17 y 18). El paper no distingue entre inyección directa e indirecta (nota 1, p. 2). Los objetivos incluyen ejecución de herramientas, exfiltración de datos, manipulación de la respuesta y denegación de servicio (p. 2).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Patrones de diseño propuestos | "six LLM agent design patterns" | 4 |
| Casos de estudio | "ten case studies of LLM agent applications" | 2 |
| Restricción de formato de salida (ejemplo de Dual LLM en ingeniería de software) | "method names limited to 30 characters" | 27 |
| Recomendación 1 | "Prioritize the development of application-specific agents that adhere to secure design patterns and clearly define trust boundaries." | 28 |
| Recomendación 2 | "Use a combination of design patterns to achieve robust security; no single pattern is likely to suffice across all threat models or use cases." | 28 |

Nota: el paper no reporta resultados experimentales (ninguna tasa de éxito de ataques ni de utilidad), así que la tabla tiene solo los datos numéricos que aparecen en el texto.

## Citas textuales
- "once an LLM agent has ingested untrusted input, it must be constrained so that it is impossible for that input to trigger any consequential actions" (p. 4)
- "While these heuristic approaches provide some protection, they do not provide guarantees." (p. 3)
- "Recommendation 1: Prioritize the development of application-specific agents that adhere to secure design patterns and clearly define trust boundaries." (p. 28)

## Limitaciones
Reconocidas por los autores:
- Los patrones son restrictivos por diseño: "these design patterns constrain the actions of agents to explicitly prevent them from solving arbitrary tasks" (p. 2, sección 1).
- Confirmación del usuario: "pose a safety risk themselves with tired or overloaded human verifiers approving unsafe actions" (p. 3). También citan fatiga mental y que los usuarios ignoran información (p. 32).
- Plan-then-execute no cubre el prompt del usuario: "this pattern does not prevent prompt injections contained in the user prompt" (p. 5). Tampoco impide que los parámetros de las acciones sean manipulados (p. 16).
- Map-reduce: "A malicious file is now restricted to tricking the 'map' LLM into marking the file as an invoice" (p. 7). Hay tareas en las que la descomposición estricta es imposible (p. 12).
- Dual LLM: "the quarantined LLM is still susceptible to prompt injection" (p. 17). En la síntesis de currículums, los resultados del LLM no privilegiado pueden ser manipulados (p. 24).
- Guardrails basados en ML "are susceptible to adversarial examples" (p. 14). Los detectores siguen siendo "fundamentally heuristic and cannot guarantee prevention of all attacks" (p. 3).
- Sandbox: no evita la fuga de información de la base de datos a través del análisis y las visualizaciones (p. 14).
- Atribución de datos: no valida por qué otros productos fueron descartados (p. 21) y es "difficult to make such an attribution robust in itself" (p. 32).
- Límite de alcance: "securing general-purpose agents remains out of reach with current capabilities" (p. 27).

Observación propia:
- El abstract habla de "provable resistance" (p. 1), pero el texto no contiene pruebas formales. Los argumentos son de diseño y de threat model.
- Ninguno de los casos está medido: no hay tasas de ataque ni de utilidad, ni modelos concretos evaluados. La comparación "ingenuo vs. endurecido" es cualitativa.
- El paper no trata la verificación del remitente ni la procedencia como etiqueta del sistema. Su atribución de datos es la más cercana, pero se refiere a explicar salidas al usuario, no a bloquear acciones.
- La confirmación humana se discute sobre todo en términos de usabilidad y fatiga (p. 3, 14, 27, 32); no propone umbrales ni criterios para decidir cuándo pedir aprobación.

## Qué le sirve a MESH
1. **Respaldo conceptual de la arquitectura por capas (argumento del paper, sin evaluación).** El paper sostiene que la defensa de sistema es "one of the most promising paths toward robust safety guarantees" (p. 3). Sirve para explicar que la retención de la herramienta de reembolso por parte del sandbox, y no por el prompt, es el tipo de control que la literatura considera robusto (inferencia mía: el paper no menciona el caso de MESH). El paper no evalúa ningún sistema.
2. **Control de flujo y approval_gate (inferencia mía).** El patrón plan-then-execute (p. 5) describe "control flow integrity": el contenido externo no puede cambiar qué acción se ejecuta. El approval_gate de MESH hace algo parecido al nivel de la herramienta. La diferencia es que MESH decide por umbral de monto (USD 500), mientras que el paper no fija umbrales sino restricciones sobre la acción.
3. **Límite de USD 500 (inferencia mía; el paper no fija montos).** Los resultados propios muestran fraudes que siguen pasando por debajo del límite. El paper no habla de montos: su criterio es que el input no confiable no pueda disparar acciones consecuentes (p. 4). Por eso, es inferencia mía que la protección deba depender de la acción y no de un monto (por ejemplo, que cambiar la cuenta bancaria de un proveedor siempre requiera aprobación; ejemplo mío, no del paper). Recomiendo rediseñar la condición del gate por tipo de acción y procedencia, no solo por monto.
4. **Etiqueta de procedencia y atribución (advertencia del paper; la conclusión es inferencia mía).** El paper advierte que la atribución es difícil de volver robusta y que los usuarios ignoran información adicional (p. 32). Es inferencia mía que eso refuerza que la etiqueta debe ponerla el sistema, como en MESH, y que no debe depender de que finanzas la lea. La cifra de MESH (12/12 con etiqueta frente a 4/12 sin defensa) muestra que la etiqueta llega a la persona; el paper no cuantifica esto.
5. **Aprobación humana y fatiga (advertencia del paper; la aplicación es inferencia mía).** "tired or overloaded human verifiers" (p. 3) es un argumento para no depender solo de aprobaciones frecuentes. Frase útil para el pitch, citable: "they do not provide guarantees" (p. 3), aplicada a los detectores. Para la verificación del remitente, es inferencia mía que esto sugiere una capa heurística que no sustituye al control de la acción.
6. **Qué copiar (recomendación del paper; la aplicación a MESH es inferencia mía).** El paper recomienda formato estricto de salida (p. 32) y da el ejemplo de nombres de método de hasta 30 caracteres (p. 27). Para MESH, los argumentos de la herramienta de reembolso (cuenta, monto, motivo) podrían validarse con un esquema fijo antes de llegar al sandbox. Esto es una sugerencia mía basada en el paper, no una prueba.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 50 · corregidas: 12 · eliminadas: 0.
- Correcciones:
  - Resumen: el trade-off se atribuía solo a p. 28; el trade-off está en p. 2 y las recomendaciones en p. 28.
  - Método: páginas de los modelos de amenaza mal citadas (archivos p. 10, reseñas p. 21, currículums p. 22, proveedores p. 19, prompt del usuario p. 9, 17–18); "denegación de servicio" solo aparece en p. 2, no en p. 15.
  - Limitaciones: la cita "these design patterns constrain…" es de p. 2 (no p. 2 a 4); la cita de map-reduce está en p. 7 (no 6 a 7); "securing general-purpose agents…" está en p. 27 (no 27–28).
  - Limitaciones: la confirmación humana se discute también en p. 3, 14, 27 y 32, no solo en términos de fatiga; se precisa.
  - "Qué le sirve a MESH": el principio de limitar acciones, no montos, es inferencia mía; el paper no menciona montos ni cuentas bancarias. Se marcaron como inferencia la aplicación a la herramienta de reembolso, la etiqueta de procedencia y la verificación del remitente. Las etiquetas "demostrado" se cambiaron por "argumento/advertencia/recomendación del paper".
- Pendiente: Nada en lo atribuido al paper. Las cifras propias de MESH (17/21, 6/21, 8/21, 3/21, 12/12, 4/12, 7/12, 8/12, USD 500) no se verificaron, por instrucción.
