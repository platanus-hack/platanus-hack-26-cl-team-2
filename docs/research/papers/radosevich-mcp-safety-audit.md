# MCP Safety Audit: LLMs with the Model Context Protocol Allow Major Security Exploits
- **Autores:** Brandon Radosevich, John T. Halloran (Leidos) · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2504.03767 · **Tema:** seguridad del Model Context Protocol (MCP); ataques a agentes con herramientas; auditoría de servidores MCP
- **Cobertura de lectura:** páginas 1–27, completo (cuerpo, referencias, apéndices A–E). Las figuras 1–21 se leyeron por su pie de figura en el texto extraído; no se revisaron visualmente las capturas, salvo la p. 9 del PDF, que se miró para confirmar las cadenas de versión.

## Resumen
El Model Context Protocol (MCP) estandariza cómo un LLM se conecta con servidores de herramientas, recursos y prompts, y se adoptó rápido, con poca revisión de seguridad. Los autores muestran que Claude 3.7 (vía Claude Desktop) y Llama-3.3-70B-Instruct pueden ser inducidos a usar herramientas de servidores MCP por defecto (filesystem, Slack, everything, Chroma) para ejecución de código malicioso, acceso remoto y robo de credenciales. Introducen RADE (Retrieval-Agent DEception), en el que el atacante corrompe datos públicos que el usuario indexa en una base vectorial, y un ataque que combina varios servidores MCP. Encuentran que la negativa de los modelos varía según el modelo y la redacción; Llama-3.3-70B-Instruct sólo rechazó cuando aparecían palabras explícitas como "hack", "steal", "backdoor" o "break into". Proponen McpSafetyScanner, un sistema multiagente que lee la configuración de servidores MCP, busca vulnerabilidades en la web, arXiv y Hacker News, y produce un reporte con remediaciones. La evaluación del escáner es cualitativa: dicen que detecta los exploits usados en sus ataques, en menos de un minuto por reporte, pero no reportan precisión ni recall.

## Método
- **Modelos y clientes:** Claude Desktop "Claude for Mac v0.8.1" sobre macOS Sequoia v15.3.2; Llama-3.3-70B-Instruct vía la inference API de HuggingFace (p. 9). Claude 3.7 aparece como modelo evaluado en p. 2.
- **Servidores MCP:** Filesystem, Slack, Everything y Chroma, todos del repositorio oficial de MCP (Tabla 2, p. 9; herramientas en Tabla 3, p. 11).
- **Ataques:** MCE (ejecución de código malicioso), RAC (acceso remoto) y CT (robo de credenciales), todos por instrucción directa (DPA, p. 3); RADE, con un archivo corrupto indexado en Chroma y recuperado después (p. 5–6, Figura 3 p. 6). Los dos RADE exitosos son de CT y RAC (p. 6–7; Figuras 4, 10–14).
- **Muestra:** ejemplos cualitativos de un intento por caso; no hay tasa de éxito, número de repeticiones ni varianza en el texto.
- **Escáner McpSafetyScanner:** escrito en Agno v1.2.6 con agentes basados en gpt-4o-2024-08-0 (p. 9). Tres etapas: un agente hacker sondea las herramientas, recursos y prompts del servidor; un agente auditor busca vulnerabilidades relacionadas en la web, arXiv y Hacker News y propone remediaciones; un supervisor consolida el reporte (p. 6–7, Figura 5 p. 7).
- **Métricas:** ninguna métrica cuantitativa. Se muestran dos reportes del escáner sobre los cuatro servidores (Figuras 20–21, p. 26–27).
- **Modelo de amenaza:** (a) atacante con acceso a la conversación o al sistema del usuario (DPA, p. 3); (b) atacante que sólo puede publicar datos que el usuario luego indexa (RADE, p. 5).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Estrellas del repositorio oficial de MCP | "over 27k stars" (a los cuatro meses de la publicación del protocolo) | 1 |
| Forks del repositorio oficial de MCP | "forked over 2.8k times" | 1 |
| Modelos LLM evaluados con servidores MCP | "Claude 3.7 and Llama-3.3-70B" | 2 |
| Tiempo de escaneo y generación de reporte de McpSafetyScanner | "less than one minute" (en M2 Max MacBook Pro) | 8 |
| Versión de Claude Desktop | "Claude for Mac v0.8.1" | 9 |
| Versión de macOS usada | "macOS Sequoia v15.3.2" | 9 |
| Modelo de los agentes del escáner | "gpt-4o-2024-08-0" (así aparece en el PDF) | 9 |
| Framework de agentes del escáner | "Agno (v1.2.6)" | 9 |

## Citas textuales
- "we show that industry-leading LLMs may be coerced to use MCP tools and compromise an AI developer’s system through a wide range of attacks, e.g., malicious code execution, remote access control, and credential theft." (p. 1)
- "Directly testing the ability of an LLM’s guardrails to prevent these attacks can thus produce false positives which, in turn, may provide a false sense of security against such attacks." (p. 2)
- "if an MCP-enabled application was solely using Llama-3.3-70B-Instruct and was equipped with the MCP filesystem server, the system might allow MCE, RAC, and CT attacks so long as a bad actor does not use harmful or unsafe language." (p. 5)

## Limitaciones
Reconocidas por los autores:
- Los agentes son estocásticos y el resultado del escáner cambia entre corridas: "Due to the stochasticity of the agents involved, more scans may catch more vulnerabilities (and remediations)." (p. 27, pie de Figura 21)
- El ataque directo (DPA) tiene, según ellos, "a low threat level in a general setting", porque el atacante necesita acceso directo al sistema del usuario (p. 3).
- Los guardrails de Llama-3.3-70B-Instruct requieren "re-evaluation" para MCP, porque las pruebas de seguridad previas no cubrían este escenario (p. 5).
- La herramienta aún no está liberada: "We are actively working to release this tool" (p. 9). Trabajo futuro: auditar servidores existentes y automatizar el escaneo con la comunidad MCP (p. 9).

Observación propia:
- Muestra mínima: un caso por ataque y modelo, más dos RADE. Sin tasas de éxito ni repeticiones, no se puede estimar la frecuencia real.
- El escáner se describe como "accurate" (p. 8) sin ninguna métrica de precisión o recall; sólo hay dos reportes (p. 26–27) y no se evalúan falsos positivos.
- Las remediaciones de la Tabla 1 (p. 8) no se probaron contra los ataques. El paper sólo muestra que el escáner las propone.
- Inconsistencia de disponibilidad: el resumen (p. 1) dice que la herramienta está "freely available", pero la p. 9 dice que siguen trabajando para liberarla. Verificar antes de citar el repositorio.
- Reproducibilidad: no hay identificador exacto del modelo Claude usado para los ataques, sólo la versión del cliente (v0.8.1). La cadena "gpt-4o-2024-08-0" aparece así en el PDF (p. 9); parece una versión incompleta.
- No hay línea base con defensas activas (filtro de salida, aprobación humana, control de permisos). Las conclusiones sobre guardrails se basan en prompts escritos por los autores.

## Qué le sirve a MESH
1. **Respalda la premisa de que el modelo no puede ser la única barrera (demostrado).** El paper dice que la fiabilidad de los guardrails "varies drastically based on the model as well as the prompt used to deliver the attack" (p. 9), y que "remediation should occur through the LLM (via its guardrails) as well as proactively through the design of the MCP server" (p. 2). *Inferencia:* approval_gate, donde el sandbox retiene el reembolso y no el prompt, es el tipo de control de diseño que piden los autores.
2. **Rutas de riesgo: RADE y el ataque multi-servidor son el mismo patrón que buscamos (demostrado + inferencia).** El paper muestra un dato externo que llega al agente por un canal de recuperación y termina en una herramienta con privilegios (p. 5–6), y un ataque que combina varios servidores MCP (p. 2). *Inferencia:* la ruta correo externo → Camila → Mateo → Tomás → herramienta de pago es estructuralmente igual. El paper analiza un solo agente y servidores por separado, por lo que no respalda una métrica de ruta completa; MESH sí la mide.
3. **Procedencia: el paper no evalúa la contramedida, pero documenta el riesgo.** En RADE, el agente ejecuta comandos que vienen del contenido recuperado sin distinguir su origen (p. 5–6). *Inferencia:* la etiqueta de procedencia que pone el sistema y no el modelo es la contramedida que el paper no prueba; MESH puede usar un caso tipo RADE para medirla.
4. **Ataques y métricas que conviene copiar.** La taxonomía MCE/RAC/CT (p. 3) sirve como etiquetas de impacto en el mapa de ataques. Del hallazgo de palabras clave (p. 5, 24–25) se deduce un diseño de pruebas: variar la redacción de los casos de fraude BEC, con y sin palabras como "fraude", para medir si el modelo rechaza. *Inferencia* a partir de la figura de palabras clave, no un resultado cuantitativo del paper.
5. **Lo que el paper no respalda.** El umbral de USD 500 y la verificación del remitente no aparecen ni se evalúan. No usar este paper para justificar esos dos puntos.
6. **Frase para el pitch (verbatim, p. 5):** "the system might allow MCE, RAC, and CT attacks so long as a bad actor does not use harmful or unsafe language." Sirve para decir que un modelo que hoy rechaza puede dejar pasar el mismo ataque con otra redacción, por lo que la defensa debe estar fuera del modelo.
