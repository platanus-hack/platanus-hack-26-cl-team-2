# IsolateGPT: An Execution Isolation Architecture for LLM-Based Agentic Systems

- **Autores:** Yuhao Wu, Franziska Roesner, Tadayoshi Kohno, Ning Zhang, Umar Iqbal (Washington University in St. Louis, University of Washington)
- **Año / venue:** NDSS Symposium 2025 (arXiv:2403.04960, primera versión de marzo de 2024). DOI 10.14722/ndss.2025.241131.
- **Enlace:** https://arxiv.org/abs/2403.04960 (código: https://github.com/llm-platform-security/SecGPT)
- **PDF local:** ~/papers-ia-safety/procedencia-ifc/wu-2025-isolategpt.pdf
- **Verificado:** página arxiv.org/abs/2403.04960 (título, autores, comentario "Accepted by the Network and Distributed System Security (NDSS) Symposium 2025"), más la cabecera del PDF con el DOI de NDSS y las afiliaciones (WUSTL y UW). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
IsolateGPT (antes SecGPT) aplica aislamiento de ejecución a ecosistemas LLM con apps de terceros, como los plugins de ChatGPT.
Su arquitectura es "hub-and-spoke". Un hub confiable recibe la consulta del usuario y la enruta. Cada app corre en su propio spoke, con su propia instancia de LLM y memoria aislada.
Las apps no se hablan directamente. Se comunican por un protocolo inter-spoke a través del hub, con mensajes bien definidos y permiso del usuario.
El hub gestiona permisos y registra las interacciones. Las apps no ven datos de otras apps salvo que el usuario lo autorice.
Analiza casos de estudio: robo de datos entre apps (correo y adjuntos), una app que altera el comportamiento de otra (reservar un viaje), y una app que altera el sistema.
Usa ataques de un benchmark de prompt injection y casos de imprecisión del lenguaje natural.
Lo compara con un sistema no aislado (VanillaGPT) construido con LangChain.
La funcionalidad es la misma que la del baseline en todos los benchmarks de LangChain probados.
El overhead es menor al 30% en el 75,73% de las consultas.
No reporta ASR agregado. La evidencia de seguridad es cualitativa y se basa en casos de estudio.

## Ataque o defensa que propone
Defensa arquitectónica de aislamiento:
- compartimentar cada app/agente con su propio LLM y memoria;
- poner un mediador confiable (el hub) para toda comunicación entre compartimentos;
- pedir permisos explícitos del usuario para flujos entre apps.

No es IFC con etiquetas: es separación de privilegios y mediación de canales.

## Números que reporta
- Funcionalidad: igual a VanillaGPT en los benchmarks de LangChain (sin app, una app, varias apps, colaboración entre apps).
- Rendimiento: **overhead < 30% en el 75,73% de las consultas** (sección de introducción y abstract).
- Seguridad: casos de estudio sin una tasa agregada. No reporta ASR numérico comparable.

## Conexión con MESH
- **MESH ya hace parte de esto.**
  - `message-bus.ts` es el canal mediado: solo entrega entre agentes de la corrida, que es el check `peer_channel` en `risk-paths.ts`.
  - El reparto de `financeTools` es la compartimentación (checks `least_privilege` y `separation`).
- **Matiz para la tesis.** IsolateGPT muestra que el aislamiento por sí solo no basta cuando el canal mediado transporta la instrucción maliciosa. Ese es exactamente el hallazgo de MESH: los checks `peer_channel`, `separation` y `least_privilege` pasan, y la ruta falla igual. El hub de IsolateGPT pide permiso al usuario en flujos entre apps. En MESH, el equivalente sería que `message-bus.ts` exija aprobación (o bloquee) cuando un mensaje con etiqueta externa va hacia un agente con herramientas financieras.
- **Idea concreta.** Agregar un check de componente `mediated_flow` en `componentChecks()` de `risk-paths.ts`: "los mensajes con origen externo hacia agentes con finanzas pasan por aprobación". Hoy fallaría. Con la política `taint → policy` pasaría y cerraría la ruta.
- **Valor de pitch.** Sirve para decir "el aislamiento clásico (NDSS 2025) es necesario pero no suficiente, y MESH lo demuestra en multiagente".
