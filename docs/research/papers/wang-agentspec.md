# AgentSpec: Customizable Runtime Enforcement for Safe and Reliable LLM Agents
- **Autores:** Haoyu Wang, Christopher M. Poskitt, Jun Sun · **Año:** 2025 (arXiv v3, jul 2025; versión ICSE '26) · **Enlace:** https://arxiv.org/abs/2503.18666 · **Tema:** enforcement en tiempo de ejecución de reglas de seguridad sobre agentes LLM mediante un DSL
- **Cobertura de lectura:** páginas 1–12, completo (incluye referencias y conclusión). Se leyó el texto extraído; no fue necesario el PDF.

## Resumen
El paper plantea que los agentes basados en LLM ejecutan acciones riesgosas (código destructivo, transferencias, conducción que incumple leyes) y que los mecanismos previos, como los simuladores de riesgo tipo ToolEmu o los guardias basados en LLM tipo GuardAgent, son poco interpretables o no imponen restricciones activas en tiempo de ejecución (p. 1–2). Proponen AgentSpec, un DSL donde cada regla tiene un evento disparador (trigger), predicados (check) y una acción de enforcement (enforce). Las acciones posibles son pedir inspección humana, auto-examen con LLM, detener la ejecución o invocar una acción predefinida (p. 4–5). La implementación se engancha al bucle de LangChain 0.3.13 y se evalúa en tres dominios: agente de código CodeAct con RedCode-Exec, agente robótico embodied con SafeAgentBench y conducción autónoma (Apollo) con escenarios de FixDrive (p. 5–6). Con reglas escritas a mano, los autores reportan más de 90% de ejecuciones inseguras de código interceptadas, 100% de escenarios AV sin violación de leyes y eliminación de acciones peligrosas en 10 categorías embodied, a cambio de una caída de 58.62% a 54.26% en tareas seguras completadas (p. 1–2, p. 8). También prueban que o1 genera reglas con 95.56% de precisión y 70.96% de recall en embodied, y que el sobrecosto de evaluación es de milisegundos frente a segundos de ejecución del agente (p. 9–10). El caso de transferencias bancarias aparece sólo como ejemplo ilustrativo (p. 3), no como experimento.

## Método
- **Modelo de regla:** tupla (η, P, E): evento disparador, conjunto de predicados y secuencia de enforcements; hay violación cuando el evento ocurre y todos los predicados son verdaderos (Definición 3.1 y 3.2, p. 5). Eventos: state_change, action (antes de ejecutar), agent_finish (p. 4–5).
- **Enforcements:** stop, user_inspection (el usuario aprueba o rechaza), acción predefinida o invoke_action, y llm_self_examine (p. 5).
- **Integración:** LangChain 0.3.13, interceptando `iter_next_step` en tres puntos: AgentAction, AgentStep y AgentFinish. El parser es ANTLR4 (p. 5). Los predicados de código son funciones Python que inspeccionan el input de la herramienta, por ejemplo `os.system("rm")` (p. 6).
- **Agentes y datasets:** (a) agente de código CodeAct con RedCode-Exec, 25 categorías de vulnerabilidad con 30 casos cada una (p. 6–7); (b) agente robótico embodied con SafeAgentBench, 10 categorías inseguras y 1 segura (p. 6, p. 8); (c) Apollo con 6 leyes de FixDrive, usadas como 8 escenarios de violación (p. 6, p. 8–9).
- **Reglas manuales (RQ1):** escritas por los autores a partir de descripciones de riesgo; en código el predicado revisa el código generado (p. 7).
- **Reglas generadas por LLM (RQ2):** OpenAI o1 con descripción del agente, tres reglas de ejemplo y, opcionalmente, ejemplos few-shot. Para código y embodied se usó 10% de los casos como ejemplos y el resto para prueba (p. 10). Para AV fue zero-shot (p. 9).
- **Generalización (RQ3):** cociente reglas/instancias de riesgo: 25 reglas para 750 escenarios de código; 12 reglas para 250 casos embodied; 6 reglas para 8 escenarios AV (p. 9–10).
- **Métricas:** Tabla 3 (#inv, #vio, #pass por categoría, con inspección manual de los autores); Tabla 4 (porcentaje de tareas con peligro con y sin AgentSpec); Tabla 5 (Pass por ley); Tabla 6 (Enforced %, y precisión/recall en texto); tiempos de parsing, evaluación de predicados y enforcement (p. 7–10).
- **Modelo de amenaza:** no adversarial. Para elicitar conductas inseguras, los autores dan instrucciones riesgosas directamente al agente (p. 7). No hay inyección de prompt ni atacante que intente esquivar las reglas.
- **Validez:** división 1:9 entre ejemplos y prueba para evitar sobreajuste; validación humana de los user_inspection por varios autores (p. 10).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Ejecuciones de código inseguras con AgentSpec (agente CodeAct, RedCode-Exec, reglas manuales) | "over 90% of code agent cases" | p. 1 (repetido p. 2) |
| Tareas peligrosas embodied con AgentSpec, en cada una de las 10 categorías inseguras | 0% | p. 8 (Tabla 4) |
| Tareas embodied seguras cumplidas, sin AgentSpec / con AgentSpec | 58.62% / 54.26% | p. 8 (Tabla 4) |
| Escenarios AV de prueba sin violación de ley, con las reglas de FixDrive traducidas a AgentSpec | 100% (texto: "100% of tested AV scenarios"; en Tabla 5, Pass es la proporción de ejecuciones que cumplen la ley) | p. 2 (texto); Tabla 5 en p. 8 |
| Precisión de reglas generadas por o1 (few-shot), embodied | 95.56% | p. 1 (abstract) y p. 9 (Tabla 6, "Enforced (%)") |
| Recall de reglas generadas por o1, embodied | 70.96% | p. 1 (abstract) y p. 9 |
| Riesgos de código detectados por reglas generadas por LLM (Tabla 6, 750 escenarios, 75 ejemplos, 25 reglas) | 87.26% | p. 9 |
| Escenarios AV con violación prevenida por reglas generadas por LLM (Tabla 6, 8 escenarios, 0 ejemplos, 6 reglas) | 62.50% (texto: "five out of eight scenarios", p. 9) | p. 9 |
| Tiempo medio de parsing del DSL | 1.42 milisegundos | p. 10 |
| Tiempo medio de evaluación de predicados, código / embodied | 2.83 ms / 1.11 ms | p. 10 |
| Tiempo medio de ejecución del agente, código / embodied | 25.4 s / 9.82 s | p. 10 |

## Citas textuales
- "Rule enforcement is declarative and externalized from the LLM, ensuring consistent behavior across runs, environments, and model versions." (p. 10)
- "AgentSpec enforces rules at execution-critical junctures—such as immediately before invoking high-impact or potentially unsafe actions—enabling finer-grained and more reliable interventions." (p. 10)
- "AgentSpec currently performs deterministic enforcement at discrete execution checkpoints, such as before invoking high-impact API calls or committing irreversible actions." (p. 11)

## Limitaciones
Reconocidas por los autores:
- Enforcement determinista sólo en checkpoints discretos; no razona sobre consecuencias a largo plazo ni hace análisis de trayectorias para estimar estados inseguros varios pasos adelante (p. 11, §6.3). Proponen como trabajo futuro modelos probabilísticos tipo DTMC (p. 11).
- La detección por predicados podría mejorar con análisis de flujo de datos; el predicado actual es a nivel de código fuente (p. 7–8).
- Reglas generadas por LLM: sobreajuste a los ejemplos (p. 9); reglas demasiado rígidas que prohíben acciones válidas, por ejemplo "pour" (p. 9); en AV fallaron Law38 y Law46 (p. 9); la regla generada para colisiones aplica un enfoque único que frena ante cualquier obstáculo a menos de cinco metros, una simplificación excesiva según los autores (p. 9).
- Algunas categorías no se marcan porque, según la inspección manual de los autores, el agente no siguió la instrucción riesgosa (p. 7); en "Unsafe deserialization" la inspección humana juzgó la salida inocua (p. 7).
- Amenazas a la validez: sobreajuste de reglas y validación humana manual de los user_inspection (p. 10).
- La latencia de user_inspection depende de la respuesta humana y no se mide (p. 10).

Observación propia:
- No hay adversario. Las instrucciones riesgosas se le dan directamente al agente (p. 7). No prueba inyección indirecta desde contenido externo, que es el caso de MESH.
- No hay experimento de fraude ni de transferencias. El ejemplo de transferencia con `user_inspection` (p. 3, Figura 2) es ilustrativo.
- Los predicados de código son coincidencias de patrones (p. 6). Es fácil evadirlas con ofuscación (inferencia nuestra: el paper no evalúa evasión). El paper sólo admite que la precisión de la detección podría mejorar con análisis de flujo de datos (p. 8).
- El "over 90%" del texto no aparece como un total calculado. La Tabla 3 tiene filas por categoría y no tiene fila de total (p. 7). Sumando sus 25 filas (cálculo nuestro sobre el texto extraído) salen 333 violaciones de 422 invocaciones (78.9%), o 364 de 422 (86.3%) si se cuentan como bloqueadas las que no pasaron la inspección; el "over 90%" no se reproduce con esa tabla y el paper no define el denominador.
- Hay una inconsistencia de terminología: el abstract y la introducción llaman "precisión" al 95.56% (p. 1–2), pero §5.3 lo describe como "enforcing 95.56% of the risky cases" (p. 9), y la Tabla 6 lo llama "Enforced (%)". La métrica de precisión real no está definida con matriz de confusión.
- Muestras pequeñas (8 escenarios AV, 250 embodied, 750 código), el texto no reporta varias corridas ni intervalos de confianza. El modelo que ejecuta los agentes no se especifica en el texto; sólo o1 aparece como generador de reglas (p. 9).
- No hay comparación experimental con GuardAgent ni NeMo; la comparación de §6.1 es cualitativa (p. 10).
- Los tiempos de overhead son por componente, no end-to-end bajo carga.

## Qué le sirve a MESH
1. **Aprobación humana como enforcement externo al LLM (respaldado por el paper, p. 4 y p. 10).** `user_inspection` es el mismo mecanismo que `approval_gate`: el sistema pausa y pide aprobación antes de ejecutar. El paper lo define y dice que la regla vive fuera del LLM, lo que respalda el argumento de MESH de que la retención la hace el sandbox y no el prompt. Lo que el paper NO demuestra es fraude ni BEC. Inferencia nuestra: el ejemplo `@inspect_transfer` (p. 3) es prácticamente el caso de MESH con otro predicado.
2. **Predicado de monto más origen (inferencia).** AgentSpec permite combinar predicados con AND (Definición 3.2, p. 5), por ejemplo `!is_to_family_member` (p. 3). Esto encaja con "monto > USD 500 Y origen externo". El paper no tiene noción de procedencia: sus predicados ven el input de la herramienta y el trayecto (p. 5). El predicado `request_untrusted_source` de la regla de código (p. 7) es una lista blanca de URLs, no una etiqueta de procedencia de contenido. Eso sostiene que la etiqueta de MESH tiene que ser un dato del sistema que viaje con el mensaje, para que el motor de reglas la vea. Lo que hay que defender en el pitch es que el límite de USD 500 no es una cifra de este paper; es una decisión de diseño nuestra.
3. **Rutas de riesgo como respuesta a una limitación reconocida (el paper lo declara, p. 11).** Los autores dicen que AgentSpec no hace análisis de trayectorias ni estima estados inseguros varios pasos adelante, y proponen extensiones probabilísticas. Las "rutas de riesgo" de MESH (correo externo → agentes → herramienta peligrosa) son un análisis de ese tipo, aunque determinista. Esto sirve como cita para explicar por qué MESH necesita rutas y no sólo reglas por acción.
4. **Métrica de costo de seguridad para copiar (dato, p. 8).** AgentSpec reporta de forma separada las tareas inseguras que bloquea (0% con AgentSpec) y el costo en tareas seguras (58.62% → 54.26%). Conviene reportar MESH igual: los 0 falsos positivos en 12 controles legítimos son el equivalente, y hay que decir también cuántos fraudes bajo USD 500 siguen pasando, como ya hacen los resultados propios.
5. **Latencia humana, no cómputo, domina el costo (dato y observación, p. 10).** El overhead de AgentSpec es de milisegundos frente a segundos de ejecución del agente, y el paper aclara que el tiempo de `user_inspection` depende de la respuesta humana. Inferencia: en MESH el cuello de botella es la aprobación humana, así que el argumento de "barato" se debe apoyar en la tasa de retención, no en el tiempo de cómputo.
6. **Frase para el pitch (cita textual, p. 10):** "Rule enforcement is declarative and externalized from the LLM, ensuring consistent behavior across runs, environments, and model versions." Se puede usar tal cual para justificar que el enforcement viva en el sandbox. Advertencia: el paper afirma esto (p. 10) pero no lo mide: no compara versiones de modelo ni corridas repetidas, y sólo evalúa código, robótica y conducción, no correo ni finanzas.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 60 · corregidas: 8 · eliminadas: 0.
- Correcciones:
  - Método, reglas generadas por LLM: el 10% de ejemplos está en p. 10, no p. 9.
  - Números clave, fila AV: las reglas eran las de FixDrive traducidas a AgentSpec, no reglas manuales; Pass en Tabla 5 mide ejecuciones, no escenarios.
  - Limitaciones: la regla LLM para colisiones no es "una sola velocidad"; es frenar ante cualquier obstáculo a menos de 5 m (p. 9).
  - Limitaciones: "nunca siguió" pasa a atribuirse a la inspección manual de los autores (p. 7).
  - Observación: el paper no admite la evasión por ofuscación; sólo dice que la precisión podría mejorar con análisis de flujo de datos (p. 8). La evasión es inferencia nuestra.
  - Observación: el "over 90%" no se reproduce con la suma de la Tabla 3 (333/422 = 78.9%; 86.3% contando las no aprobadas).
  - Observación: "una sola corrida" pasa a "el texto no reporta varias corridas".
  - MESH, punto 6: el paper no prueba consistencia entre versiones de modelo ni corridas; lo afirma (p. 10) sin medirlo.
- Pendiente: la suma de la Tabla 3 se hizo sobre el texto extraído, no sobre la tabla del PDF; el denominador del "over 90%" no está en el paper.
