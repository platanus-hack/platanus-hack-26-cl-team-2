# Model Context Protocol (MCP): Landscape, Security Threats, and Future Research Directions
- **Autores:** Xinyi Hou, Yanjie Zhao, Shenao Wang, Haoyu Wang (Huazhong University of Science and Technology) · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2503.23278 · **Tema:** Arquitectura, ciclo de vida, ecosistema y taxonomía de amenazas del Model Context Protocol (MCP); paper de visión sin experimentos cuantitativos.
- **Cobertura de lectura:** páginas 1–37, completo (cuerpo, tablas, figuras, apéndice de referencias). Las tablas 1, 2 y 4 se leyeron del texto extraído; en la Tabla 4 la celda de `mcp-installer` sale corrupta ("NL1") y no la usé. No abrí el PDF.

## Resumen
MCP es un protocolo abierto (Anthropic, fines de 2024) que estandariza cómo un modelo descubre, describe e invoca herramientas y recursos externos, y su ecosistema creció rápido: el paper relevó 26 colecciones de servidores a septiembre de 2025. Los autores señalan que la seguridad de MCP casi no se ha estudiado en la academia. Su aporte es descriptivo y de taxonomía: definen el ciclo de vida de un servidor MCP en cuatro fases y 16 actividades, y construyen una taxonomía de 16 escenarios de amenaza según cuatro tipos de atacante (desarrollador malicioso, atacante externo, usuario malicioso y fallas de seguridad). Para cada riesgo montan un servidor de prueba de concepto (PoC) en un entorno aislado, pero declaran que no miden tasas de éxito de ataque. Entre los hallazgos, la muestra aleatoria de 300 servidores de MCP.so tuvo 30 entradas con "MCP" en el nombre que no se refieren al protocolo y 18 en desarrollo o no disponibles, lo que muestra que los directorios inflan sus cifras. Las recomendaciones son firma de manifiestos, verificación de procedencia, sandbox por servidor, supervisión humana de acciones sensibles y prohibir el encadenamiento implícito de herramientas sin aprobación explícita. Ninguna de estas defensas se evalúa.

## Método
- **Tipo de trabajo:** análisis cualitativo y paper de visión (así se declara en las palabras clave, p. 1). Combina documentación oficial del protocolo, análisis del ciclo de vida (pp. 7–9) y relevamiento manual del ecosistema (pp. 10–12).
- **Datos del ecosistema:** lista manual de adoptantes (Tabla 1, p. 10) y 26 colecciones de servidores (Tabla 2, p. 12), con cortes al 9/2025. Muestra aleatoria de 300 servidores de MCP.so para revisar calidad (p. 11). Cinco auto-instaladores en la Tabla 4 (p. 22), con estrellas de GitHub y cantidad de servidores.
- **Modelo de amenaza:** cuatro tipos de atacante, 16 escenarios, cada uno con su origen en una fase del ciclo de vida (creation, deployment, operation, maintenance) (Tabla 3, p. 15). Los autores prefieren ubicar el origen y no la fase donde se manifiesta, por ejemplo tool poisoning se introduce en la creación y se dispara en operación (p. 15).
- **Validación:** un PoC de servidor MCP por tipo de riesgo, en entorno aislado, con un host MCP propio construido sobre el SDK oficial (p. 15). Son demostraciones de viabilidad (Figuras 5–14), no mediciones. No se declaran modelos de lenguaje, datasets de evaluación, tamaño de muestra de ataques ni métricas de ataque.

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Fases del ciclo de vida de un servidor MCP | four phases (creation, deployment, operation, maintenance) | 1 |
| Actividades clave en que se descompone el ciclo de vida | 16 key activities | 1 |
| Escenarios de amenaza en la taxonomía | 16 distinct threat scenarios | 1 |
| Colecciones de servidores MCP consolidadas (Sept. 2025) | 26 major MCP collections | 11 |
| Servidores muestreados al azar en MCP.so | 300 | 11 |
| De los 300: con "MCP" en el título pero sin referirse al Model Context Protocol | 30 | 11 |
| De los 300: en desarrollo activo o no disponibles | 18 | 11 |
| Smithery CLI: estrellas en GitHub (Tabla 4, Sept. 2025) | 407 | 22 |
| Smithery CLI: servidores (Tabla 4, Sept. 2025) | 7,437 | 22 |
| mcp-get: estrellas / servidores (Tabla 4, Sept. 2025) | 483 / 59 | 22 |
| Citado de otros autores (Hasan et al.): servidores MCP de código abierto medidos | 1,899 open-source MCP servers | 33 |
| Citado de otros autores (MCPSecBench): tipos de ataque | seventeen attack types | 34 |

## Citas textuales
- "Security mechanisms that only focus on sanitizing user prompts are insufficient in the MCP ecosystem, as the actual threat emerges from data pulled in by trusted connectors." (p. 23)
- "Since the goal of this PoC is to demonstrate security risks and feasibility rather than to evaluate attack success rates or the behavioral differences among various base LLMs, we leave such comprehensive evaluations for future work." (p. 15)
- "MCP does not enforce strict namespace isolation or code provenance, so users and LLMs have difficulty distinguishing which server's implementation is being executed." (p. 21)

## Limitaciones
Reconocidas por los autores:
- Los PoC no miden tasas de éxito de ataque ni diferencias entre LLM base; lo dejan para trabajo futuro (p. 15).
- El relevamiento de adoptantes se compiló manualmente y "is not exhaustive" (p. 10).
- El paper se declara de visión (palabras clave, p. 1) y la foto del ecosistema tiene fecha de corte 9/2025 (pp. 10, 12).

Observación propia:
- No hay resultados cuantitativos de ataque: las Figuras 5–14 son código ilustrativo, y la Figura 7 indica que la exfiltración fue "simulada" (p. 18). No sirven como tasa de éxito.
- Los datos de estrellas y de servidores son de septiembre de 2025, más de un año antes de la fecha de hoy, así que están desactualizados.
- Las cifras de directorios no son verificables de forma independiente. El propio paper muestra que las listas inflan los números (p. 11).
- La indirect prompt injection tiene una sola sección breve (5.2.2, pp. 22–23) con mitigaciones genéricas y sin evaluación.
- No aparecen aprobación por procedencia, umbrales monetarios ni etiqueta de origen de un mensaje. El paper no aborda correo ni fraude BEC.

## Qué le sirve a MESH
1. **Etiqueta de procedencia (respaldo de diseño, no de eficacia):** el paper recomienda que las aplicaciones muestren "contextual provenance, such as the verified publisher or trust level, when automatically selecting tools, allowing human oversight when sensitive actions are requested" (p. 17). Esto lo demuestra solo como recomendación. Inferencia mía: MESH puede citarlo como consenso de diseño, pero sus números siguen siendo los suyos.
2. **Aprobación humana (el paper lo propone por tipo de cadena, no por origen):** pide "prohibiting implicit tool chaining without explicit user approval" y detección de cadenas como "local file access → external network transmission" (p. 25). La aprobación por origen externo y el umbral de USD 500 de MESH no aparecen en el paper. Inferencia mía: ese criterio es un hueco que MESH puede reclamar, y el paper no lo contradice.
3. **Rutas de riesgo (respaldo cualitativo):** en el encadenamiento implícito, "each step operates within the model's authorized permissions, these activities often evade traditional access control or policy enforcement mechanisms" (p. 25; ejemplo de la Figura 13). Es el mismo patrón de MESH, "cada componente pasa su revisión, pero la ruta falla", a nivel de herramientas. Inferencia mía: el paper no mide rutas; MESH sí, y eso es lo que debe mostrar.
4. **Verificación del remitente (analogía, no equivalencia):** el paper pide identidades de servidor verificables con manifiestos firmados y dice que la comprobación de nombres o la confirmación del usuario no bastan para el shadowing de herramientas (pp. 16–17). Esto es consistente con el resultado de MESH de que la verificación del remitente sola no cambió nada (8/12 con y sin ella en Haiku). Inferencia mía: es una analogía, porque el paper trata de servidores y herramientas y no de remitentes de correo.
5. **Límite de USD 500:** el paper no trae montos ni umbrales. No respalda ni contradice este número; no conviene citarlo para justificarlo.
6. **Ataques y métrica para copiar:** el caso de la Figura 11 (p. 23), inyección indirecta desde un issue público de GitHub que hace filtrar datos de un repositorio privado, y el shadowing de `send_email` de la Figura 9 (p. 20), que es el riesgo de correo de MESH. Métrica: el paper no tiene ninguna. Lo declara en p. 15, así que MESH puede presentar sus tasas (17/21 → 6/21 en Haiku 4.5; 8/21 → 3/21 en Sonnet 4.6) como el dato que falta en la literatura, con el caveat de n chico.
7. **Frase para el pitch (demostrada por el paper como argumento, no como medición):** "Security mechanisms that only focus on sanitizing user prompts are insufficient in the MCP ecosystem, as the actual threat emerges from data pulled in by trusted connectors." (p. 23). Sirve para decir que el riesgo entra por datos de conectores confiables, no solo por el prompt, que es el argumento del correo externo en MESH.
