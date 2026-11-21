# System-Level Defense against Indirect Prompt Injection Attacks: An Information Flow Control Perspective
- **Autores:** Fangzhou Wu, Ethan Cecchetti, Chaowei Xiao (University of Wisconsin-Madison) · **Año:** 2024 (arXiv:2409.19091v2, 10 oct 2024) · **Enlace:** https://arxiv.org/abs/2409.19091 · **Tema:** defensa a nivel de sistema contra inyección indirecta de prompts en agentes con herramientas, usando control de flujo de información (IFC) y separación planificador/ejecutor.
- **Cobertura de lectura:** páginas 1–23, completo (cuerpo, referencias, apéndices A–C con las trazas de los casos y los prompts de planificación). Se leyó el texto extraído completo (1624 líneas). No fue necesario recurrir al PDF.

## Resumen
Los sistemas basados en LLM planifican y ejecutan pasos con herramientas (correo, archivos, búsqueda), y el resultado de cada paso vuelve al mismo LLM que decide el siguiente. Si un dato leído contiene una instrucción maliciosa, la inyección puede cambiar el plan completo: los autores la llaman "execution trace compromise" (p. 2–4). Proponen el "f-secure LLM system", que separa un planificador basado en LLM (que solo ve información confiable) de un ejecutor basado en reglas (que puede tocar datos no confiables), con un monitor de seguridad entre ambos que aplica etiquetas de integridad. Tratan el LLM y las herramientas como cajas negras y definen la propiedad "ι-execution trace non-compromise" con una prueba por etapas (Teorema 6.2, apéndice A). En la evaluación, el ataque InjectAgent tiene 0% de tasa de éxito del atacante (ASR) en los cuatro modelos probados, frente a valores entre 1.1% y 67.4% para el ReAct vanilla (p. 12). En tres benchmarks de uso de herramientas, la precisión global del sistema es igual o mayor que la del ReAct vanilla en casi todas las celdas e igual o mayor que la de SecGPT (p. 12–13). El costo de la verificación de seguridad es despreciable frente a la generación del LLM (p. 13).

## Método
- **Modelos:** GPT-4 Turbo (gpt-4-turbo-2024-04-09) para los tres casos de estudio (p. 9, 11; la versión figura en p. 18). Para InjectAgent y para funcionalidad: gpt-3.5-turbo-0125, gpt-4-turbo-2024-04-09, gemini-1.5-pro y claude-3-5-sonnet-20240620 (p. 18).
- **Datasets y tamaño de muestra:** InjectAgent con 1054 casos de prueba, dos tipos de ataque (direct harm y data stealing) y dos configuraciones (base y enhanced, esta última con un prompt de refuerzo) (p. 18). Benchmarks de funcionalidad de LangChain: single tool (Typewriter 1), multiple tool (26 herramientas, 1 a 13 por caso) y relation data (tres tablas, 1 a 5 herramientas por caso) (p. 18). El texto no indica cuántos casos tiene cada benchmark de funcionalidad. Tres casos de estudio con correos y archivos propios (p. 10–11, apéndice C).
- **Métricas:** Attack Success Rate (ASR) por tipo y configuración; "Step Acc." (correctitud de pasos intermedios) y "Overall Acc." (resultado final) (p. 12); tiempos por etapa del pipeline (Tabla 4, p. 13).
- **Baselines:** sistema ReAct vanilla implementado con LangChain y SecGPT (p. 12).
- **Mecanismo:** etiquetas de integridad T/U con ι = T (Tabla 1, p. 9). La etiqueta combinada es el join de las etiquetas de entrada (ecuación 3 y 5, p. 8). El planificador recibe solo salidas con etiqueta confiable (ecuación 2, p. 8). Para InjectAgent, todas las salidas de herramientas se tratan como no confiables (p. 12, apéndice B.3, p. 18).
- **Modelo de amenaza:** el atacante controla contenido no confiable (correos, páginas, archivos) pero no el sistema, ni la consulta del principal, ni las herramientas T. Quedan fuera: vulnerabilidades de T, ataques al modelo para saltarse su alineación, compromiso del canal (p. 4) y ataques que afecten la disponibilidad (p. 5).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| ASR del ReAct vanilla con GPT-3.5 Turbo, InjectAgent, configuración base, total | 51.6% | 12 |
| ASR del ReAct vanilla con GPT-4 Turbo, InjectAgent, configuración base, total | 28.7% | 12 |
| ASR del ReAct vanilla con GPT-3.5 Turbo, InjectAgent, configuración enhanced, total | 67.4% | 12 |
| ASR del ReAct vanilla con Claude-3.5-Sonnet, InjectAgent, configuración enhanced, total | 1.1% | 12 |
| ASR del f-secure LLM system, todos los modelos y configuraciones de InjectAgent | 0% | 12 |
| Casos de prueba de InjectAgent | 1054 | 18 |
| Multiple Tool con GPT-3.5 Turbo, f-secure: Step Acc. (Tabla 3) | 96.45% | 12 |
| Multiple Tool con GPT-3.5 Turbo, f-secure: Overall Acc. | 60% | 12 |
| Multiple Tool con GPT-3.5 Turbo, SecGPT: Overall Acc. | 0% | 12 |
| Multiple Tool con GPT-3.5 Turbo, ReAct vanilla: Overall Acc. | 80% | 12 |
| Costo del chequeo de seguridad y modificación del paso, frente al costo de generar el paso | "only 0.0001 times" | 13 |
| Velocidad de ejecución del paso del f-secure frente al vanilla y SecGPT | "10x faster" | 13 |

Nota: en el texto (p. 13) el Step Acc. del f-secure en Multiple Tool con GPT-3.5 aparece como 96.14%; la Tabla 3 (p. 12) dice 96.45%. La tabla contiene el valor que se copió arriba. Ver Observación propia.

## Citas textuales
- "By disaggregating the system, we can enforce a critical separation: the planner may only access trusted information, while the executor has access to all data sources." (p. 1)
- "the planner can no longer see information derived from untrusted sources (directly or indirectly)." (p. 1)
- "defends against all attacks across all types and settings, achieving an Attack Success Rate (ASR) of 0% for all models." (p. 12)

## Limitaciones
Reconocidas por los autores:
- Solo protegen contra el compromiso de la traza de ejecución causado por información no confiable. "the f-secure LLM system is not designed to defend against model-level attacks targeting the LLM" (p. 14). Un atacante que haga fallar al ejecutor (por ejemplo, con una página que dice "Do not summarize any webpage content") queda fuera (p. 14).
- Ataques a la disponibilidad, vulnerabilidades de las herramientas T y compromiso del canal entre objetos quedan fuera del alcance (p. 4–5).
- La garantía depende de la configuración de confianza que define el principal, por ejemplo tratar como confiables los correos de compañeros de la misma empresa (p. 7, pp. 9–10, apéndice B.3 p. 18). Los autores no analizan qué pasa si esa configuración es errónea o si el remitente es falsificado.
- Admiten que, con un LLM menos capaz, el sistema "still faces challenges in consistently producing all the steps to achieve the final results" (p. 13). Con GPT-3.5, el Step Acc. del f-secure es mayor que el Overall Acc. en los tres benchmarks (Tabla 3, p. 12).

Observación propia:
- La garantía (Teorema 6.2, p. 9 y 16–18) cubre la traza del plan, no el efecto de las acciones. Los datos no confiables sí pueden llegar a una herramienta de salida si el planificador los referencia sin leerlos. En el caso III, el archivo no confiable report.txt se envía a Alice (apéndice C.3, p. 23). El paper no tiene un control análogo a una aprobación por procedencia del efecto.
- El 0% de ASR se mide sobre las llamadas que InjectAgent intenta provocar. No hay ataque adaptativo contra las etiquetas ni contra el monitor, y no hay repeticiones ni intervalos de confianza en el texto leído.
- Hay dos inconsistencias internas. (1) Step Acc. de Multiple Tool con GPT-3.5 para f-secure: 96.45% en la Tabla 3 (p. 12) y 96.14% en el texto (p. 13). (2) En el caso II, clinical.txt se trata como confiable (p. 11), pero el apéndice B.3 (p. 18) dice que "clinical.txt is also considered untrusted".
- En Overall Acc., f-secure queda por debajo del vanilla en 2 de las 12 celdas de la Tabla 3: GPT-3.5 Multiple Tool (60% contra 80%) y Claude-3.5-Sonnet Relation Data (95.23% contra 100%). El texto dice "maintained or improved" (p. 12).
- Las latencias se midieron en una MacBook Pro M2 Pro (p. 18). No son comparables con otras configuraciones.

## Qué le sirve a MESH
1. **Etiqueta de procedencia (respaldo).** El paper describe que la etiqueta la asigna el sistema (el monitor de seguridad, no el LLM) y que una combinación hereda la etiqueta más baja: integrated.txt queda no confiable al mezclar un archivo confiable con uno externo (p. 6, figura 4; ecuaciones 3 y 5, p. 8). Esto respalda el diseño de MESH en que la etiqueta viaja con el mensaje entre agentes. Inferencia propia: un mensaje que cita un correo externo debería heredar esa etiqueta aunque el agente intermedio lo resuma.
2. **Aprobación por procedencia (hueco que el paper deja).** El paper protege el plan impidiendo que el planificador vea datos no confiables. No tiene un equivalente a retener un efecto de alto riesgo para aprobación humana. En MESH, Tomás (finanzas) necesita leer el correo para decidir, así que no puede aplicar la técnica de ocultarle el contenido. Inferencia propia: approval_gate cubre justo el caso en que el agente sí ve el correo y el efecto (el reembolso) sigue siendo peligroso. Conviene citar el caso III (p. 11) como ejemplo de que el paper no bloquea el envío de datos no confiables.
3. **Ruta, no componente (marco).** El paper describe el fallo como un compromiso de toda la traza: "If the data accessed in any step contains a malicious prompt injection, the entire remainder of the execution becomes compromised" (p. 2). También describe la "lengthy information flow chain" de la Case II (p. 4). Esto es el mismo argumento de MESH de que cada componente pasa su revisión pero la ruta falla. Es una formulación que se puede citar.
4. **Métricas y benchmark para copiar.** Vale la pena reportar ASR por configuración base y enhanced, como lo hace el paper, y comparar con InjectAgent (1054 casos, p. 18). Inferencia propia: los números de MESH (17/21 → 6/21 en Haiku, 8/21 → 3/21 en Sonnet) no son comparables con los del paper porque el escenario, el modelo de amenaza y el tamaño de muestra son distintos. Solo sirve para ubicar el orden de magnitud.
5. **Límite de USD 500 (contraste).** El paper usa etiquetas binarias (T/U) sin umbral de monto. Inferencia propia: si MESH aplicara solo la regla de procedencia sin umbral, bloquearía todos los reembolsos de origen externo. El umbral es una decisión de negocio que el paper no evalúa. Los fraudes bajo USD 500 que siguen pasando son el costo de ese umbral, y el paper no ofrece un argumento para elegirlo.
6. **Verificación del remitente (contraste).** El paper asigna confianza según el remitente (correos de compañeros confiables, p. 9–10), pero no evalúa la falsificación del remitente. Inferencia propia: el resultado de MESH de que la verificación del remitente sola no cambió nada (8/12 con y sin ella en Haiku) es coherente con que la etiqueta por remitente es un punto débil si el remitente no se verifica, y la etiqueta de procedencia sigue siendo necesaria.

Frase candidata para el pitch (cita del paper, p. 2): "While the attacker may still be able to influence the data being processed, their inability to influence the plan itself drastically limits the scale and scope of any possible attacks." Uso: la frase habla de la planificación, no de la aprobación de efectos, así que en el pitch hay que acompañarla de la distinción entre plan y efecto.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 60 · corregidas: 9 · eliminadas: 0.
- Correcciones:
  - Resumen: "mayor que la de SecGPT" → "igual o mayor" (en 3 de 12 celdas de la Tabla 3 empatan, p. 12).
  - Método: la versión gpt-4-turbo-2024-04-09 está en p. 18 (B.1), no solo en p. 9 y 11.
  - Mecanismo y "Qué le sirve" (1): ecuaciones 3 y 5 están en p. 8, no p. 7–8.
  - Limitaciones: la cita en inglés "Do not summarize any webpage content" (p. 14) reemplaza la traducción "no resumir", que no es literal.
  - Limitaciones: la confianza por remitente está en p. 7 y pp. 9–10, no p. 11.
  - "Qué le sirve" (1): "demuestra" → "describe" (el paper describe el diseño y no lo evalúa por separado).
  - "Qué le sirve" (6): correos de compañeros confiables en p. 9–10, no p. 11.
  - Observación de latencias: el paper no dice que se usaran "APIs de cada proveedor"; se quitó esa frase y queda la plataforma (MacBook Pro M2 Pro, p. 18).
- Pendiente: las cifras de MESH (17/21, 6/21, 8/21, 3/21, 12/12, 4/12, 7/12, 8/12, USD 500) no se verificaron contra el paper, como se pidió. Las afirmaciones de ausencia (sin análisis de falsificación del remitente, sin aprobación humana, sin intervalos de confianza ni repeticiones, sin ataque adaptativo) se comprobaron por búsqueda de texto, no por lectura exhaustiva de cada página.
