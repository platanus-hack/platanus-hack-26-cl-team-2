# Multi-Agent Systems Execute Arbitrary Malicious Code
- **Autores:** Harold Triedman, Rishi Jha, Vitaly Shmatikov (Cornell Tech) · **Año:** 2025 (COLM 2025; arXiv:2503.12188v2) · **Enlace:** https://arxiv.org/abs/2503.12188 · **Tema:** seguridad multiagente; secuestro del flujo de control (MAS hijacking) por contenido no confiable
- **Cobertura de lectura:** 1–33, completo (texto extraído, líneas 1–1927: cuerpo, discusión, referencias y apéndices A–M). El PDF original se consultó solo para la Tabla 5 (p. 8). Las Figuras 3 y 4 (p. 18) son imágenes sin texto extraíble y no se inspeccionaron visualmente.

## Resumen
Los sistemas multiagente (MAS) que procesan contenido externo, como páginas web, archivos o adjuntos de correo, pueden ser desviados por ese contenido en el flujo de control y en la comunicación entre agentes, no solo en la salida de un agente. Los autores llaman a este ataque "MAS hijacking": el atacante no habla con el orquestador, sino que deja en un archivo o página un mensaje de error falso y plausible; el agente de acceso a archivos lo reenvía como metadatos y el orquestador termina pidiendo al agente de código que lo ejecute. Probaron AutoGen (Magentic-One, Selector y Round-Robin) y MetaGPT con GPT-4o, GPT-4o-mini, Gemini 1.5 Pro y Gemini 1.5 Flash, y CrewAI solo con modelos OpenAI (p. 7, 20), usando como payload una reverse shell en Python. Con GPT-4o, el ataque web logró ejecución de código malicioso en 58–90% de los intentos según el orquestador, y en algunas combinaciones llegó a 100%. Las plantillas clásicas de inyección indirecta (IPI) casi no funcionaron contra estos sistemas (0–1% en la columna IPI de la Tabla 2). Los autores observan además que sub-agentes individuales a veces rechazan la acción y aun así el sistema completa el ataque, y concluyen que usar agentes basados en LLM con contenido no confiable y acciones externas es inseguro.

## Método
- **Modelo de amenaza:** el atacante no controla los agentes ni puede escribir directamente al MAS; controla contenido que el sistema lee (páginas web, archivos locales, imágenes, video). Se asume que los agentes son benignos (p. 4–5).
- **Sistemas y orquestadores:** AutoGen con Magentic-One (MO), Selector (Sel.) y Round-Robin (RR); CrewAI con su orquestador por defecto; MetaGPT con Data Interpreter (p. 6, 20). Configuraciones por defecto y llamadas por API (p. 20).
- **Modelos:** GPT-4o, GPT-4o-mini, Gemini 1.5 Pro y Gemini 1.5 Flash. CrewAI solo se probó con modelos OpenAI (p. 7, 20).
- **Variantes del ataque:** tipos de entrada (texto local, texto web, imagen web, video local); tres plantillas de error (Python falso, WordPress 403, "Access Denied"); dos formulaciones de la consulta del usuario. Cada combinación se repitió 10 veces (p. 6–7; Apéndices H–I, p. 23–24).
- **Payload:** reverse shell en Python no ofuscado; en CrewAI también un script de exfiltración de perfil de usuario (p. 6, 8).
- **Métrica:** tasa de éxito del ataque (ASR). El ejecutor se modificó para salir y escribir una cadena única al ejecutar el payload, con un servidor en la nube como respaldo. La clasificación combinó regex y revisión manual (p. 6, 21).
- **Baselines:** tareas benignas (Tabla 6, p. 19); pedido directo de reverse shell (Tabla 7, p. 20); tres plantillas IPI tomadas de AgentDojo (p. 6–7, 23–24).
- **Experimentos adicionales** (todos con Magentic-One y GPT-4o-mini, p. 6): contacto incidental (40 pruebas, con un archivo benigno y uno malicioso en el mismo directorio); paráfrasis de la consulta (10 paráfrasis, 20 pruebas cada una); pedido directo (40 pruebas).
- **Topologías** (Apéndice F, p. 21–22): round robin, orquestador central y orquestador central con task ledger.

## Números clave
| Dato | Valor | Página |
|---|---|---|
| ASR de ejecución de código malicioso, ataque web, GPT-4o, según orquestador (abstract) | 58-90% | 1 |
| MO con GPT-4o, archivo local malicioso, ejecución de código | 97% | 2 |
| MO con Gemini 1.5 Pro, página web maliciosa, ejecución de código | 88% | 2 |
| CrewAI con orquestador GPT-4o y subagentes GPT-4o-mini, archivo local, exfiltración de datos privados (Tabla 5; la intro, p. 2, dice solo "CrewAI, running on GPT-4o") | 65% | 8 |
| Plantillas IPI (Debenedetti et al.), orquestador MO, Tabla 2 | 0% | 7 |
| Ejecuciones de código tras pedido directo de reverse shell atribuidas a modelos Gemini | 61 de 67 (91%) | 7 |
| Contacto incidental (archivo malicioso en el mismo directorio), ASR | 87.5% (35 de 40 pruebas) | 8 |
| Hijack directo (consulta del usuario con metadatos maliciosos), ASR, 0% de rechazo | 80% (28 de 40 pruebas) | 8 |
| Promedio de ASR sobre las 200 pruebas de paráfrasis | 59.5% | 8 |
| Repeticiones por cada combinación framework-orquestador-modelo-entrada-error-consulta | 10 | 6 |
| Control benigno (leer archivo local, GPT-4o, promedio de orquestadores), tasa de éxito | 99% | 19 |
| Pedido directo de reverse shell, GPT-4o-mini (promedio de orquestadores), ASR | 6% | 20 |

## Citas textuales
- "We also demonstrate that these attacks succeed even if individual agents are not susceptible to direct or indirect prompt injection, and even if they refuse to perform harmful actions." (p. 1)
- "we empirically demonstrate that previously known indirect injection attacks have near-zero success rate in getting MAS to execute malicious code." (p. 2)
- "The LLMs used to instantiate individual agents are unable to distinguish benign from malicious inputs, nor data from metadata." (p. 10)

## Limitaciones
Reconocidas por los autores:
- **Alcance:** solo tres frameworks "drop-in"; se excluyeron frameworks de simulación, conversacionales y personalizables de negocio o desarrollo (p. 6; Apéndice E, p. 20).
- **Modelos:** CrewAI solo con modelos OpenAI por un bug conocido que afecta el uso de herramientas (p. 7, nota de la Tabla 2; p. 20).
- **Muestra:** 10 repeticiones por celda. Los experimentos pequeños usan un solo orquestador y modelo, Magentic-One con GPT-4o-mini (p. 6).
- **Clasificación:** un clasificador LLM (GPT-4o-mini) produjo demasiados falsos negativos, por eso se usaron regex y revisión manual (p. 21; Apéndice M, p. 30–33).
- **Modalidades:** los resultados con audio transcrito de video fueron inconsistentes (p. 9).
- **Defensas:** no evaluadas. Los autores dejan para trabajo futuro medir si las defensas IPI bloquean MAS hijacking y cuánto afectan la utilidad (p. 9, sección 7.2; p. 17, A.3).
- **Supuesto de amenaza:** agentes benignos y no controlados por el adversario (p. 4).
- **Conjeturas no probadas:** que la alineación de seguridad no cubre estas presentaciones del mensaje (p. 5 y p. 8); que el LLM no entiende el contexto completo del sistema (p. 10).

Observación propia:
- Los modelos son de 2024–2025 (GPT-4o, Gemini 1.5). Las cifras no se trasladan directamente a los modelos que usa MESH en noviembre de 2026.
- Con n=10 por celda y sin intervalos de confianza, diferencias de pocos puntos entre celdas pueden ser ruido.
- Ninguna prueba mide una defensa de sistema (aprobación humana, filtros de herramientas, etiquetas de procedencia). El paper no da evidencia de que esas medidas bloqueen el ataque.
- El payload es una reverse shell o, solo en CrewAI, exfiltración de un perfil de usuario (p. 8). MESH usa herramientas de negocio (reembolso, cambio de cuenta bancaria) sin ejecución de código. El mecanismo puede ser parecido, pero no está probado para ese caso.
- El contacto incidental (35 de 40) es el resultado más cercano a un correo: una consulta inocua hace que el sistema procese un archivo malicioso que ya estaba en el directorio. Aplicado a MESH, sugiere que un adjunto viejo en la bandeja puede activar la ruta aunque el correo nuevo pase la verificación del remitente. Es inferencia.

## Qué le sirve a MESH
1. **"Cada componente pasa su revisión, pero la ruta falla".** Demostrado: en CrewAI, el agente programador reconoció el código malicioso, lo advirtió, no lo transmitió al resto y señaló éxito; el orquestador ordenó ejecutarlo (p. 8). Los autores resumen que sub-agentes individuales rechazan la acción y el MAS completa el ataque igualmente (p. 10). Inferencia: esto respalda la premisa central de MESH con un caso real, no solo con un diseño.
2. **Etiqueta de procedencia.** Indicado, no demostrado (6.4, p. 8): el éxito parece depender de que los metadatos (errores, estados) viajen entre agentes sin distinguir su origen, y el mecanismo es conjetura del paper (p. 5, 8); los LLM "no distinguen datos de metadatos" y confían en los confused deputies (p. 4, 10). Inferencia: el paper dice que a los sistemas les falta un modelo de confianza y una semántica de entradas (p. 10); una etiqueta que pone el sistema, no el modelo, y que viaja con el mensaje, iría en esa dirección. El paper no prueba que una etiqueta lo evite.
3. **Aprobación por procedencia.** Demostrado: el paper no evalúa aprobación humana. Sí menciona como defensa a nivel de agente la validación de llamadas a herramientas, sin medirla (p. 9; A.3, p. 17). Inferencia: la retención en el sandbox, fuera del prompt, es el tipo de control que el paper sugiere y no prueba. El límite de USD 500 no tiene equivalente en el paper; el atacante del paper no necesita montos.
4. **Rutas de riesgo.** Demostrado: el paper modela el MAS como un grafo dirigido de agentes y define el ataque como un sufijo de la traza de acciones redirigido hacia acciones del atacante (Apéndice C, p. 19). Inferencia: "correo externo → agentes → herramienta peligrosa" es el mismo objeto (un camino en el grafo) con otra semántica. El paper no da un algoritmo para calcularlo.
5. **Verificación del remitente y entrada.** Demostrado: las plantillas IPI, que atacan el texto de entrada, casi no funcionan contra MAS (0–1% en la Tabla 2, p. 7), pero el secuestro por metadatos sí (p. 7). Inferencia: filtrar la instrucción en la entrada no basta si el mensaje puede pasar por un agente intermedio. El paper no mide verificación del remitente.
6. **Métrica para copiar.** Demostrado: el ASR se mide reemplazando el ejecutor peligroso por uno que escribe una cadena única y no ejecuta nada (p. 6, 21). Los autores también separan tasa de rechazo y ASR (Tabla 7, p. 20). Sirve para el red-team de MESH: instrumentar la herramienta para registrar la llamada y devolver un centinela, y reportar rechazo y ejecución por separado.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 50 · corregidas: 6 · eliminadas: 0.
- Correcciones:
  - Resumen: CrewAI no se probó con los cuatro modelos; solo con modelos OpenAI (p. 7, 20).
  - Números clave, 65%: la condición es orquestador GPT-4o con subagentes GPT-4o-mini (Tabla 5, p. 8), no "CrewAI con GPT-4o" en general.
  - Qué le sirve 2: "Demostrado" pasa a "indicado"; el paper presenta el mecanismo como conjetura (p. 5, 8).
  - Qué le sirve 2: el paper no dice que falte una etiqueta de procedencia; dice que faltan un modelo de confianza y semántica de entradas (p. 10).
  - Observación propia: el payload de exfiltración en CrewAI es un perfil de usuario, no archivos (p. 8).
  - Cobertura de lectura: la frase sobre el PDF original se actualizó porque se consultó la Tabla 5.
- Pendiente: Figuras 3 y 4 (p. 18) no se inspeccionaron visualmente; no afectan a ningún número de la nota.

