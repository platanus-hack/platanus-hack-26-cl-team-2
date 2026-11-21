# Levels of Autonomy for AI Agents

- **Autores:** K. J. Kevin Feng, David W. McDonald, Amy X. Zhang · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2506.12469 · **Tema:** marco conceptual de niveles de autonomía de agentes de IA según el rol del usuario, y propuesta de certificados de autonomía y evaluación asistida
- **Cobertura de lectura:** páginas 1–16, completo (texto extraído de 829 líneas; la tabla de la p. 16 salió legible en el texto, no hizo falta el PDF). Incluye referencias (pp. 13–15), leídas pero no verificadas una por una.

## Resumen

El paper parte de que la autonomía es a la vez una oportunidad y un riesgo para los agentes de IA, y sostiene que el nivel de autonomía debería ser una decisión de diseño, separada de la capacidad del modelo y del entorno (p. 1). Propone cinco niveles, de L1 (Operator) a L5 (Observer), definidos por el rol que el usuario, humano o agente, cumple frente al agente (p. 1, p. 4). Ilustra cada nivel con un mismo agente de uso de computadora hipotético y una misma solicitud de investigación (p. 4–8). Como aplicación de gobierno, propone certificados de autonomía emitidos por un tercero, que fijan el nivel máximo de autonomía de un agente según sus especificaciones y su entorno (p. 9–10). Para evaluar la autonomía, propone evaluaciones asistidas: se empieza sin usuario y se sube la intervención (L4, luego L3) hasta que el agente cruza un umbral de éxito T, y entonces se asigna el nivel (p. 11–12). No hay experimentos: los propios autores llaman a las evaluaciones "early ideas" y "a sketch" (p. 1, p. 11). En seguridad el aporte es indirecto: mencionan que más autonomía amplía las superficies de ataque y que la aprobación humana puede degradarse por desatención (p. 7–8), pero no tratan inyección de prompt ni flujo de información.

## Método

Ensayo conceptual, no empírico. No hay modelos evaluados, datasets propios, tamaño de muestra ni métricas de resultado. Su montaje tiene tres partes:

- **Marco de cinco niveles** (Tabla 1, p. 16), con un agente ejemplo: modelo "on par with OpenAI's CUA", herramientas de navegación de UI, navegación web, ejecución de código y escritura de documentos, en una computadora compartida con el usuario, y la solicitud "Help me understand the economic impact of generative AI in the United States since the release of ChatGPT in 2022." (p. 4).
- **Certificado de autonomía**: un organismo tercero recibe un agente desplegado en pruebas y un "autonomy case" con evidencia de comportamiento, corre evaluaciones privadas y emite el certificado si se cumplen los objetivos (p. 9–10).
- **Evaluación asistida**: se corre el benchmark sin usuario (nivel L5 si se alcanza el umbral T en todas las tareas principales); si no, se agrega intervención de tipo L4 (aprobaciones y rechazos) y después de tipo L3, y se clasifica el nivel a partir de los registros de intervención (p. 11–12).

Modelo de amenaza: no se define. La autonomía se trata como variable de diseño y gobierno, no como vector de ataque. Benchmarks citados como referencia de capacidad: OSWorld, TheAgentCompany y DiscoveryWorld (p. 11).

## Números clave

| Dato | Valor | Página |
|---|---|---|
| Niveles de autonomía propuestos | five levels of escalating agent autonomy | 1 |
| Versión del documento en arXiv | arXiv:2506.12469v2 [cs.HC] 28 Jul 2025 | 1 |
| Tamaño de OSWorld (benchmark citado) | 369 real-world computer tasks | 11 |
| Tamaño de TheAgentCompany (benchmark citado) | a set of 175 tasks | 11 |
| Tamaño de DiscoveryWorld (benchmark citado) | a set of 120 tasks | 11 |
| Rondas mínimas para designar un agente como L1 (evaluación asistida que empieza sin usuario) | five rounds of task completion is needed to designate an agent as L1 | 11 |
| Fecha de corte de los sistemas de la Tabla 1 | as of June 2025 | 16 |

## Citas textuales

1. "We argue that an agent’s level of autonomy can be treated as a deliberate design decision, separate from its capability and operational environment." (p. 1)
2. "Autonomy is a double-edged sword for AI agents, simultaneously unlocking transformative possibilities and serious risks." (p. 1)
3. "Simple errors can compound over multiple steps without user intervention, leading to final outputs that may be far from optimal despite the agent consuming significant resources." (p. 8)

## Limitaciones

Reconocidas por los autores:

- Son descriptivos, no prescriptivos: "we aim to be descriptive rather than prescriptive" y los escenarios por nivel no son la mejor implementación (p. 4).
- Proponen las evaluaciones como "early ideas" para medir autonomía (p. 1) y el procedimiento de evaluación es "a sketch" (p. 11).
- Reconocen que determinar qué acciones son consecuentes "may be challenging" (p. 8), es decir, la pregunta que decide cuándo pedir aprobación queda abierta.
- Advierten que la desatención del usuario puede volver la aprobación "meaningless rubber stamping" y producir "unintended approvals"; un agente desalineado podría aprovecharla para ganar autonomía (p. 8).
- Señalan que empezar la evaluación sin usuario y subir la intervención "may be quite costly" (p. 11).
- Los certificados son una propuesta: el organismo emisor "would be issued" y no hay implementación con datos (p. 10).
- Los sistemas de la Tabla 1 se basan en lanzamientos y demos públicos "as of June 2025" (p. 16).

Observación propia:

- No hay ningún dato empírico de seguridad. Los números del paper son tamaños de benchmarks citados de otros trabajos (p. 11), no resultados del paper. No sirve como evidencia cuantitativa para MESH.
- El riesgo se trata a nivel de agente completo, no de acción individual. Los niveles dicen cuánto interviene el usuario en el agente en general; MESH aplica el control por acción y por origen (reembolso mayor a USD 500 con origen en correo externo). Son granularidades distintas.
- No aparecen inyección de prompt, flujo de información, procedencia ni datos que viajan entre agentes. La única mención de seguridad es una frase sobre superficies de ataque y credenciales (p. 7).
- Las referencias a sistemas (Devin, Operator, Manus, etc.) son de junio de 2025; el paper no tiene un análisis de riesgo por sistema.

## Qué le sirve a MESH

1. **Respaldo conceptual para la aprobación como decisión de diseño.** El paper afirma que el nivel de autonomía es una decisión independiente de la capacidad (p. 1, p. 3). Demuestra solo el argumento; no hay evidencia. Inferencia mía: sirve para decir en el pitch que el umbral de aprobación de MESH es una decisión de gobierno y no una propiedad del modelo.
2. **Pregunta abierta que MESH responde con una regla concreta.** El paper pregunta "How can the agent reliably know when to seek approval?" y reconoce que determinar qué acciones son consecuentes es difícil (p. 8). MESH fija la regla en el sandbox: reembolso mayor a USD 500 con origen externo. Esto es una respuesta concreta a una pregunta que el paper deja abierta; el paper no propone ninguna regla así. El límite de USD 500 en sí no aparece en el paper.
3. **Riesgo que MESH no mide.** El paper advierte que aprobaciones desatendidas producen aprobaciones no intencionales (p. 8). Nuestros resultados cuentan fraudes que pasan, pero no miden si el aprobador revisa de verdad. Hay que reconocerlo como limitación antes de que alguien lo pregunte.
4. **Métrica a copiar: intervención humana mínima.** La evaluación asistida mide el mínimo de intervención necesario para cruzar un umbral T de éxito y asigna el nivel con base en esa intervención (p. 11). Inferencia mía: MESH podría reportar, además de fraudes que pasan, cuántas aprobaciones humanas requirió cada configuración. Esto no está en el paper como métrica de seguridad.
5. **Argumento para la etiqueta de procedencia y las rutas de riesgo.** El paper dice que un sistema con muchos agentes L5 "may have very sparse communication between agents, which may make the system difficult to steer, debug, and audit" (p. 9). Inferencia mía: la ruta entre agentes es el punto difícil de auditar, y por eso la procedencia tiene que viajar con el mensaje y no quedar en el log de cada agente. El paper no habla de procedencia ni de rutas de riesgo.
6. **Frase para el pitch.** "Autonomy is a double-edged sword for AI agents, simultaneously unlocking transformative possibilities and serious risks." (p. 1). Sirve de apertura. Para el argumento de MESH hay que citar también que la autonomía es una decisión de diseño (p. 1), no un atributo fijo del modelo.

Lo que el paper no respalda: la verificación del remitente, la etiqueta de procedencia como mecanismo, el umbral de USD 500 y los números de MESH. Todo eso es nuestro, y el paper no lo cita ni lo contradice.
