# Prompt Flow Integrity to Prevent Privilege Escalation in LLM Agents
- **Autores:** Juhee Kim, Woohyuk Choi, Byoungyoung Lee (Seoul National University) · **Año:** 2025 (arXiv:2503.15547v2, 21 abr 2025) · **Enlace:** https://arxiv.org/abs/2503.15547 · **Tema:** defensa arquitectónica contra inyección de prompts e inyección de datos (escalada de privilegios) en agentes LLM con herramientas
- **Cobertura de lectura:** páginas 1–21, completo (cuerpo, referencias, apéndices A, B y C). Se leyó el texto extraído del PDF; no se abrió el PDF. Las figuras 2, 3, 4, 6, 7, 8, 9 y 10 se leen solo por su texto extraído (layout mezclado), así que los datos del paper se toman del cuerpo y de las Tablas 1, 2, 3, 5, 6. En la Tabla 3 la unidad del gasto es ilegible en el texto; no se usa ese dato.

## Resumen
El paper parte de que un agente LLM decide su siguiente acción con todo el contexto, incluidos datos de terceros que pueden venir envenenados desde una herramienta (web, correo, archivos). Eso permite dos ataques: inyección de prompts (el dato trae instrucciones) e inyección de datos (el dato influye en argumentos de herramientas o en la respuesta final sin dar órdenes explícitas). Los autores proponen PFI (Prompt Flow Integrity), que aplica principios clásicos de seguridad de sistemas: separa un agente confiable AT (token privilegiado, solo datos confiables) de un agente no confiable AU (token restringido; su contexto tiene datos no confiables y solo el mínimo de datos confiables necesario), reemplaza los datos no confiables por identificadores (data IDs) que AT puede referenciar sin leerlos, y agrega guardrails deterministas (DataGuard para flujos de datos y CtrlGuard para flujos de control) que piden aprobación al usuario. Evalúan con GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet y Gemini 1.5 Pro sobre AgentDojo y AgentBench OS extendidos por ellos. Reportan ATR de 0.00% (ningún ataque exitoso) con PFI en todos los modelos y benchmarks, y SUR de 61.86% (AgentDojo) y 68.42% (AgentBench OS) para GPT-4o, frente a 12.37% y 0% del ReAct baseline. PFI también genera menos alertas que alertar en cada llamada (1.49 frente a 4.11 por tarea en AgentDojo), pero con más latencia y tokens, y con pérdida de utilidad cuando el LLM usa mal los IDs.

## Método
- **Modelos:** GPT-4o (2024-11-20), GPT-4o-mini (2024-07-18), Claude 3.5 Sonnet (2024-10-22), Gemini 1.5 Pro 002 (2024-09-24) (p. 10).
- **Líneas base:** ReAct (Baseline, agente preconstruido de LangGraph), e IsolateGPT y f-secure LLM, que los autores implementaron en su entorno (p. 10).
- **Benchmarks:** AgentDojo: 97 tareas de utilidad (10 modificadas para usar fuentes no confiables), 609 tareas de seguridad existentes más 97 tareas nuevas de inyección de datos creadas por los autores (p. 19). AgentBench OS: 19 tareas de utilidad (5 originales y 14 creadas), 7 ataques de inyección de prompt y 19 de inyección de datos (p. 19). Escenario hipotético de agente móvil con directorio compartido y privado, con atacante en una app sin privilegios (p. 11).
- **Métricas:** SUR (tarea útil completada y ataque fallido), ATR (porcentaje de tareas atacadas, tenga o no éxito la tarea), ASR, número de alertas por tarea, latencia, tokens y costo (pp. 11–13).
- **Modelo de amenaza:** el atacante es externo y envenena datos que entran por herramientas. El usuario es la víctima y no es experto en seguridad (p. 3). Supuestos: las herramientas están bien implementadas; quedan fuera la fuga del modelo, las alucinaciones, la denegación de servicio y la cadena de suministro (p. 3).
- **Política:** los autores definen a mano la confianza de los datos y los privilegios de los tokens para las 75 herramientas (pp. 11, 17). Las herramientas de correo se clasifican por remitente, con listas de remitentes de confianza configuradas (p. 19).
- **Entorno:** Intel Core i7-8700K, 64 GB RAM, Ubuntu 22.04, Python 3.12.4 (p. 10). Shell sandbox con nsjail (p. 11).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| SUR de PFI en AgentDojo (GPT-4o, comparación entre agentes) | 61.86% | 12 |
| SUR de Baseline en AgentDojo (GPT-4o) | 12.37% | 12 |
| SUR de PFI en AgentBench OS (GPT-4o, comparación entre agentes) | 68.42% | 12 |
| ATR-Any de PFI (todos los modelos y benchmarks) | 0.00% | 12 |
| ATR-Any de Baseline en AgentDojo (GPT-4o) | 81.44% | 12 |
| ATR-Prompt de Baseline (todos los modelos y benchmarks) | 12.37-78.95% | 12 |
| Fallos de utilidad de PFI por uso indebido de DU en AT (108 tareas analizadas por modelo) | 75.93% | 12 |
| Alertas por tarea, Full-Alert en AgentDojo | 4.11 | 13 |
| Alertas por tarea, PFI en AgentDojo | 1.49 | 13 |
| Reducción de alertas de PFI frente a Full-Alert en AgentDojo | 63.91% | 13 |
| Aumento de latencia de PFI frente a Baseline en AgentBench OS | 214.60% | 13 |
| Aumento de tokens de PFI frente a Baseline en AgentDojo | 90.56% | 13 |

## Citas textuales
- "Unlike traditional software, LLM agent’s behavior is determined at runtime by natural language prompts from either user or tool’s data." (p. 1)
- "The root cause of prompt injection attack is the lack of separation between prompt and data in LLM agents." (p. 4)
- "In contrast, PFI completely prevented both prompt injection attacks and data injection attacks (0.00%), demonstrating a strong security guarantee against the attacks." (p. 12)

## Limitaciones
Reconocidas por los autores:
- Quedan fuera de alcance la fuga del modelo, las alucinaciones, la denegación de servicio y los ataques a la cadena de suministro, y se asume que las herramientas están bien implementadas (p. 3).
- La detección de flujos peligrosos depende de la aprobación manual del usuario, que puede aprobar sin revisar "for convenience" (p. 14).
- La utilidad cae: 75.93% de los fallos vienen de un uso indebido de los datos no confiables en AT, sobre todo IDs inválidos (54.63%) (p. 12). Los autores plantean fine-tuning como vía de mejora (p. 13).
- Costos: +63.49% de latencia y +90.56% de tokens en AgentDojo; +214.60% y +253.90% en AgentBench OS (p. 13). Los autores los justifican por la seguridad que ofrecen (p. 14).
- Hay una fuga menor: AT puede filtrar datos confiables a AU a través de las claves del formato de respuesta (p. 8).
- Los benchmarks los extienden los autores, y AgentBench OS no traía evaluación de seguridad; el escenario de ataque es hipotético (p. 11).
- Las tareas adicionales de AgentBench OS y los datos de prueba se generaron con ChatGPT (GPT-4o) y revisión manual (pp. 11, 19); las 97 tareas de inyección de datos de AgentDojo se crearon a mano (p. 19).
- Las políticas de confianza y privilegios se definen a mano (p. 11), y la confianza por usuario (Trust Once, Trust Always, Trust Never) queda en manos del usuario (p. 10).

Observación propia:
- El paper no mide el porcentaje de tareas atacadas en condiciones reales. Todo el ATR = 0% sale de sus benchmarks y de sus políticas.
- Inferencia de un hueco: DataGuard detecta IDs de datos no confiables en argumentos de herramientas, no texto copiado en claro. Si el LLM de AT reescribe contenido de DU sin el ID, el paper no describe la detección. Su afirmación de "no false negatives" se apoya en revisar logs buscando DU crudo en ctxAT sin aprobación (p. 13), no en un mecanismo formal.
- Inconsistencia en los números: la introducción dice que el SUR del ReAct sube de 27.84% a 55.67% en AgentDojo y de 2.63% a 67.79% en AgentBench OS (p. 2). Los promedios de cuatro modelos de la Tabla 6 (p. 20) dan 27.84 y 55.67 para AgentDojo, pero para PFI en AgentBench OS dan 65.79 (cálculo mío: 68.42, 57.89, 68.42, 68.42), no 67.79. Además, la conclusión habla de una mejora de "28-63%p" (p. 14), y las diferencias por modelo de la Tabla 6 van de 15.46 a 49.49 en AgentDojo y de 57.89 a 68.42 en AgentBench OS. Inferencia propia: el rango parece ser el promedio de los cuatro modelos de la Tabla 6, no el rango por modelo (AgentDojo: 55.67 − 27.84 = 27.8 pp; AgentBench OS: 65.79 − 2.63 = 63.2 pp). El paper no lo explica.
- Detalle menor: 144 alertas entre 97 tareas dan 1.48, no el 1.49 de la Tabla 2 (p. 13). Puede ser redondeo o un denominador distinto.
- Los modelos son de 2024. Los resultados no dicen nada de modelos más recientes como los que usa MESH.

## Qué le sirve a MESH
1. **Etiqueta de procedencia (respaldo parcial).** Demuestra: PFI asocia a cada dato no confiable un conjunto de atributos (Attr: origen, dueño, tipo) al entrar al contexto, los conserva en una tabla de IDs, y el aviso al usuario muestra fuente, sumidero y tipo de flujo (p. 9). Además, la respuesta de AU hereda el Attr agregado de todo lo que AU vio (p. 9). Inferencia: la etiqueta de MESH que el sistema pone y que viaja entre agentes es el equivalente de Attr. Este paper no mide si el aviso mejora la decisión humana, así que el efecto de 4/12 a 12/12 en MESH no tiene respaldo aquí.
2. **Aprobación por procedencia, pero sin umbral.** Demuestra: DataGuard alerta cuando un dato no confiable entra a una herramienta privilegiada o a la respuesta final, y el paper no define ningún umbral de monto (pp. 8–9). Inferencia: el umbral de USD 500 de MESH es la diferencia más grande con PFI. Por la lógica de PFI, un fraude de USD 300 que llega por correo externo también debería pedir aprobación. Vale probar una variante sin umbral, o con umbral solo para pagos y cambios de cuenta, y medir cuántas alertas genera. El dato de PFI de 1.49 alertas por tarea frente a 4.11 de alertar todo sirve de referencia de fatiga.
3. **Rutas de riesgo (respaldo conceptual).** Demuestra: si se controla el flujo de datos no confiables hacia herramientas privilegiadas, el ATR baja a 0% en sus benchmarks (p. 12). Inferencia: es el mismo principio de "cada componente pasa, la ruta falla". PFI lo logra rediseñando el agente (dos agentes, dos tokens), mientras que MESH lo hace en el sandbox sin cambiar el agente. Esa distinción conviene decirla en el pitch.
4. **Verificación del remitente (matiz).** Demuestra: PFI clasifica el correo por la dirección del remitente, con una lista configurada de confianza, y todo lo demás es no confiable por defecto (pp. 10, 19). Inferencia: el paper no describe autenticación del remitente; solo usa la dirección como atributo. Inferencia: el resultado de MESH de 8/12 sin efecto de la verificación del remitente es coherente con que el remitente por sí solo no basta. Conviene presentar la verificación como atributo de procedencia, no como defensa suficiente.
5. **Métrica y ataque para copiar.** Conviene reportar algo parecido al SUR de PFI, que combina tarea útil completada y ataque fallido (p. 11). Para MESH sería: porcentaje de controles legítimos completados sin fraude. Como tipología, la inyección de datos (p. 5) describe bien un BEC: el atacante no da órdenes, sino que sus datos llegan a argumentos de pago. Inferencia: los fraudes de MESH que pasan el umbral son de este tipo.
6. **Frase para el pitch, con cuidado.** La cita de la p. 12 ("PFI completely prevented both prompt injection attacks and data injection attacks (0.00%)") solo vale para sus benchmarks y políticas hechas a mano. Para el pitch conviene: "Kim et al. (2025) muestran que separar agentes y marcar flujos de datos no confiables baja el ataque exitoso a 0% en sus benchmarks, con un costo de latencia y tokens." Así queda claro qué demuestra el paper y qué es inferencia de MESH.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 53 · corregidas: 7 · eliminadas: 0.
- Correcciones:
  - Líneas base: ReAct es un agente preconstruido (LangGraph, p. 10); solo IsolateGPT y f-secure los implementaron los autores.
  - Resumen: AU no tiene "sin datos confiables"; su contexto tiene datos no confiables más el mínimo de datos confiables necesario (p. 6).
  - Números clave: los 108 tareas analizadas son por modelo, no en total (p. 12).
  - Limitaciones: las 97 tareas de inyección de datos de AgentDojo se crearon a mano; ChatGPT generó tareas y datos de AgentBench OS (pp. 11, 19).
  - Observación propia: el rango "28-63%p" (p. 14) coincide con los promedios de la Tabla 6 (p. 20), no con el rango por modelo; se marca como inferencia.
  - Qué le sirve a MESH, 2: el paper no define umbrales de monto; se quitó "sin importar el monto".
  - Qué le sirve a MESH, 4: "PFI no verifica remitentes" pasa a inferencia.
- Pendiente: las figuras (2–10) se revisaron solo por texto extraído, sin renderizar páginas del PDF; las cifras de SUR y ATR se cruzaron con las Tablas 1 y 6, y la discrepancia 1.49 frente a 1.48 (Tabla 2) sigue siendo del paper.
