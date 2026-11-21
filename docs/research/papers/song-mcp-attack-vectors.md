# Beyond the Protocol: Unveiling Attack Vectors in the Model Context Protocol (MCP) Ecosystem
- **Autores:** Hao Song, Yiming Shen, Wenxuan Luo et al. · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2506.02040 · **Tema:** ataques desde servidores MCP maliciosos (envenenamiento de herramientas, puppet, rug pull, recursos externos maliciosos) y su efecto en agentes LLM
- **Cobertura de lectura:** páginas 1–25, completo (cuerpo, apéndices A–H y referencias), leído en tres tramos del texto extraído. Las figuras 7 y 9 tienen texto extraído ilegible: no tomé cifras de ellas, solo de las tablas 2 y 4 y del texto.

## Resumen
El paper estudia el riesgo de servidores MCP maliciosos a lo largo de todo su ciclo: subida a plataformas agregadoras, instalación por el usuario y ejecución de acciones dañinas en el equipo local. Define cuatro familias de ataque: Tool Poisoning, Puppet, Rug Pull y explotación de recursos externos maliciosos (p. 4–6). Un servidor malicioso subido a Smithery.ai, MCP.so y Glama fue aceptado en las tres plataformas sin advertencias (p. 7). En un estudio con 20 participantes, 75.0% seleccionó al menos un servidor malicioso y ninguno analizó correctamente los cuatro vectores (p. 8). En la evaluación con cinco LLM y cinco clientes MCP, el ASR promedio global es 53.11% y el RR promedio global 4.67% (p. 10), y los clientes casi no bloquean los ataques (p. 11). Los autores concluyen que todos los vectores son ejecutables y que ni los LLM ni los clientes los mitigan (p. 12). Proponen puertas de seguridad en las rutas ② y ④ del flujo MCP, pero no las evalúan (p. 13).

## Método
- **Modelo de amenaza (p. 4):** el adversario controla el servidor MCP malicioso y puede modificar sus descripciones de herramientas y los recursos externos que consulta. No controla el cliente MCP. Toda información que llega desde el servidor se trata como no confiable.
- **Vectores (p. 4–6; tabla 3, p. 18):** Tool Poisoning, Puppet, Rug Pull y Malicious External Resources. Rug Pull se evalúa solo en la subida (RQ1) y se excluye de RQ3 (p. 9).
- **RQ1 (p. 6–7):** subida de un servidor malicioso con apariencia de consulta de precio de ETH a Smithery.ai, MCP.so y Glama. Después se modificó el repositorio de un servidor ya aprobado (rug pull). Observación de siete días.
- **RQ2 (p. 7–8):** plataforma agregadora simulada y estudio con 20 participantes en tres tareas (selección a ciegas, identificación informada y análisis de vectores), más entrevistas semiestructuradas.
- **RQ3 (p. 9–12):** Benchmark 1 fija el cliente en Cline y varía cinco LLM (Claude 3.7 Sonnet, GPT-4o, DeepSeek-V3 0324, LLaMA3.1-70B, Gemini 2.5 Pro). Benchmark 2 fija el LLM en Claude 3.7 Sonnet y varía cinco clientes (Cherry Studio, Claude Desktop, Cline, Copilot-MCP, Cursor). Tres tareas: Privacy Steal (leer un archivo local con credenciales), Result Manipulation (cambiar "cloudy, 30 degrees" por "sunny, 35 degrees") y Cryptocurrency Theft (transferir 0.01 ETH). Son 45 combinaciones por benchmark con 20 pruebas cada una (p. 9).
- **Métricas (p. 9):** ASR, porcentaje de intentos en que el LLM ejecuta la tarea maliciosa, y RR, porcentaje de intentos en que el LLM se niega explícitamente.
- **Muestra:** 20 participantes en el estudio de usuarios (p. 8); 20 pruebas por combinación en RQ3 (p. 9). No se reportan intervalos de confianza ni pruebas estadísticas.

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Servidores MCP listados en Smithery.ai, MCP.so y Glama, a agosto 2025 | over 6,000, 16,000, and 8,000 MCP servers | 2 |
| Plataformas que aceptaron el servidor malicioso (Test 1) | all three platforms, "without warnings or rejections" | 7 |
| Participantes que seleccionaron al menos un servidor malicioso (Task 1) | 75.0% | 8 |
| Participantes que identificaron los cuatro servidores maliciosos | only one participant (P04) | 8 |
| ASR promedio, Tool Poisoning Attack (Result 1) | 59.33% | 10 |
| ASR promedio, Malicious External Resources (Result 1) | 93.33% | 10 |
| ASR promedio, Puppet Attack (Result 1) | 6.67% | 10 |
| ASR promedio global (tabla 2, fila Average) | 53.11% | 10 |
| RR promedio global (tabla 2, fila Average) | 4.67% | 10 |
| ASR de Gemini 2.5 Pro con Tool Poisoning Attack (tabla 2) | 98.33% | 10 |
| RR promedio de Cherry Studio (tabla 4) | 33.89% | 22 |
| Pruebas por combinación (RQ3) | 20 tests | 9 |

## Citas textuales
1. "the attacker can add any description (prompt) to an MCP tool" (p. 4)
2. "MCP aggregation platforms function as directory services that link to external GitHub repositories rather than hosting code directly." (p. 7)
3. "All defined attack vectors can be effectively executed in real-world scenarios." (p. 12)

## Limitaciones
Reconocidas por los autores:
- Validez interna (p. 13): la RQ3 fija Cline en el Benchmark 1. Los clientes pueden tener mitigaciones propias que el estudio no modela. Los autores argumentan que su RR bajo hace que esa discrepancia no sea significativa.
- Validez externa (p. 13): solo tres plataformas agregadoras y cinco clientes. Los participantes son mayormente desarrolladores o investigadores, no usuarios típicos.
- Por límite de páginas, solo se muestra en detalle Tool Poisoning con Result Manipulation (p. 9). El resto está en el repositorio.
- Rug Pull no se evalúa en RQ3 (p. 9).
- Los autores reconocen que los resultados con Puppet Attack "are not ideal" (p. 10).
- No proponen ni prueban una defensa concreta. Las mitigaciones (security gateway, firma de descripciones, escáner de recursos) son propuestas (p. 13).
- Ética (p. 14): el servidor se retiró de las plataformas tras el estudio.

Observación propia:
- Inconsistencia en el conteo de servidores: la p. 2 dice "four malicious MCP servers with eight benign ones" (12 servidores), mientras que las pp. 7–8 hablan de 13 servidores y "4 of 13".
- Inconsistencia texto/tabla: la p. 10 dice "around 53.00%" para el ASR promedio y la tabla 2 dice 53.11%. En la nota uso 53.11%.
- Con 20 pruebas por celda, los valores aparecen en pasos de 5% (por ejemplo, 5.00% equivale a 1 de 20). Son muestras chicas y sin intervalos.
- Los benchmarks varían un factor a la vez (cliente fijo o LLM fijo). No hay una matriz completa LLM × cliente, así que no se puede separar el efecto del modelo del efecto del cliente.
- El paper no evalúa ninguna defensa basada en aprobación humana, etiquetado de procedencia o control de flujo. Su única medida de defensa es el RR del modelo o del cliente.
- La tarea de robo de cripto es una transferencia de 0.01 ETH dentro de una consulta de clima, sin flujo multiagente. Se parece a MESH en la herramienta final de alto riesgo, pero no en la cadena de agentes.

## Qué le sirve a MESH
1. **Respaldo (demostrado en el paper):** el vector de recurso externo es el más efectivo (ASR 93.33%, p. 10) y los modelos casi no se niegan (RR promedio 4.67%, p. 10). Esto sostiene que el juicio del modelo no puede ser la barrera. **Inferencia nuestra:** la barrera tiene que estar fuera del modelo, en el sandbox, como en approval_gate.
2. **Etiqueta de procedencia:** la tabla 3 (p. 18) ubica el vector de recurso externo en las rutas ⑦, ⑧, ④ y ⑤. La instrucción llega al prompt por el resultado de una herramienta. El paper no prueba ninguna etiqueta de origen. **Inferencia nuestra:** una etiqueta que viaje con el mensaje sirve para que la capa de aprobación decida, no para que el modelo la interprete.
3. **Aprobación fuera del modelo:** el paper propone intercepción en las rutas ② y ④ (p. 13), lo que es conceptualmente cercano a nuestra aprobación por procedencia. Sin embargo, su propuesta actúa sobre prompts y no sobre montos o acciones de herramienta. **Inferencia nuestra:** nuestro gate es complementario, porque actúa sobre la acción y el origen, algo que el paper no mide.
4. **Límite de USD 500:** el paper usa 0.01 ETH como monto de robo (p. 9) y no evalúa umbrales. **Inferencia nuestra:** un monto pequeño basta para el ataque, lo que encaja con nuestro hallazgo de que el fraude bajo USD 500 sigue pasando.
5. **Verificación del remitente o del publicador:** las tres plataformas aceptaron el servidor malicioso, y Glama lo marcó como "safe to use" (p. 7). **Inferencia nuestra:** verificar al publicador no basta, lo que es consistente con que nuestra verificación del remitente no cambió resultados en Haiku. El paper no prueba verificación de remitente.
6. **Pitch y métricas:** la frase "All defined attack vectors can be effectively executed in real-world scenarios." (p. 12) se puede usar si decimos que fue en escenarios simulados. Conviene copiar las definiciones de ASR y RR (p. 9) para nuestras tablas.
