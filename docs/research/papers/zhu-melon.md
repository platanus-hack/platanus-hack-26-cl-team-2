# MELON: Provable Defense Against Indirect Prompt Injection Attacks in AI Agents
- **Autores:** Kaijie Zhu, Xianjun Yang, Jindong Wang, Wenbo Guo, William Wang · **Año:** 2025 (ICML 2025, PMLR 267) · **Enlace:** https://arxiv.org/abs/2502.05174 · **Tema:** defensa contra inyección de prompt indirecta (IPI) en agentes con herramientas
- **Cobertura de lectura:** páginas 1–20, completo (cuerpo, Tablas 1–5, referencias y apéndices A–F). Se leyó el texto extraído del PDF; no fue necesario abrir el PDF, porque la Tabla 1 salió legible.

## Resumen
Los agentes LLM que usan herramientas pueden ser desviados por instrucciones maliciosas escondidas en datos que recuperan (sitios, correos, archivos), lo que se conoce como inyección de prompt indirecta (IPI). Los autores explican que las defensas existentes requieren entrenar modelos, usan detectores que sacrifican utilidad o tienen altos falsos negativos, o filtran herramientas hasta volver el agente inutilizable (p. 2). Proponen MELON, una defensa sin entrenamiento que parte de una observación: cuando un ataque tiene éxito, la siguiente acción del agente depende menos de la tarea del usuario y más de los datos recuperados (p. 3). MELON vuelve a ejecutar la trayectoria con el prompt del usuario reemplazado por una tarea neutral (resumir contenido y seguir instrucciones que aparezcan) y compara las llamadas a herramientas de ambas ejecuciones; si coinciden, marca un ataque (p. 4–5). En AgentDojo (629 casos de ataque), con GPT-4o, el ASR promedio baja de 16.06% a 0.24% (p. 7–8). El costo es menor utilidad (UA promedio de 58.78% frente a 69.08% sin defensa) y 9.28% de falsos positivos en GPT-4o, que los autores atribuyen en su mayoría a instrucciones que el usuario pidió seguir sin verificar (p. 8–9). La variante MELON-Aug, que suma el repeat prompt, llega a 68.72% de UA con 0.32% de ASR (p. 7).

## Método
- **Modelo de amenaza (p. 3):** el atacante sólo puede manipular la información externa que recupera el agente; no ve las entradas ni las salidas del LLM. El defensor tiene acceso completo al estado del agente, pero no entrena modelos ni accede a sus representaciones internas.
- **Benchmark (p. 6, 17):** AgentDojo, con cuatro tipos de agente (banking, slack, travel, workspace), 97 tareas de usuario y 629 casos de ataque. Cada caso combina una tarea de usuario con una tarea de ataque y un punto de inyección.
- **Ataques (p. 6):** Direct (prefijo "TODO"), Ignore Previous Instructions, System Message e Important Messages (este último reforzado con el nombre de usuario y la versión del LLM).
- **Modelos (p. 6):** GPT-4o, o3-mini y Llama-3.3-70B, con temperatura 0. Los autores no usaron Claude-3.5-Sonnet a gran escala por presupuesto.
- **Defensas comparadas (p. 6):** DeBERTa detector (ProtectAI), LLM detector (GPT-4o), delimiting, repeat prompt y tool filter. No incluyen known-answer detection, por actuar después de la ejecución.
- **Mecanismo de MELON (p. 4–6):** dos ejecuciones en paralelo, la original y la enmascarada, con el prompt del usuario reemplazado por una tarea neutral (Tf, Apéndice A.1) y las salidas de herramientas consolidadas. Hay un caché de llamadas de la ejecución enmascarada y la comparación se hace sólo sobre las llamadas a herramientas. Las llamadas se convierten a texto conservando sólo los argumentos de seguridad (en send_email, el destinatario; en send_money, destinatario y monto; Apéndice A.3). La similitud se calcula con embeddings de OpenAI (text-embedding-v3) y el umbral principal es θ = 0.8.
- **Métricas (p. 6):** BU (utilidad sin ataque), UA (tarea del usuario completada sin ejecutar el ataque) y ASR (fracción de ataques que cumplen su objetivo).
- **Ablación y sensibilidad (p. 7–8):** se quita cada diseño en GPT-4o con Important Messages; quitar cualquiera sube el ASR. Se varían la tarea neutral y θ entre 0.5 y 0.9.
- **Costo (p. 5):** la ejecución enmascarada duplica las llamadas al modelo, lo que significa aproximadamente 2× el costo de API frente al baseline.

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Casos de ataque en AgentDojo | 629 | 6 |
| GPT-4o sin defensa: UA promedio / ASR promedio | 69.08% / 16.06% | 8 |
| GPT-4o sin defensa: ASR con ataque Important Messages | 51.03% | 8 |
| GPT-4o con MELON: ASR promedio | 0.24% | 7 |
| GPT-4o con MELON: UA promedio | 58.78% | 8 |
| GPT-4o con MELON-Aug: UA promedio / ASR promedio | 68.72% / 0.32% | 7 |
| GPT-4o: BU sin defensa / BU con MELON | 80.41% / 68.04% | 8 |
| GPT-4o con MELON: tasa de falsos positivos (FPR) | 9.28% | 9 |
| GPT-4o con DeBERTa detector: FPR | 61.86% | 9 |
| Costo de API con MELON frente al baseline | ≈ 2× | 5 |
| Cota de error con n = 100 detectores (µB = 0.3, µV = 0.7, θ = 0.5) | approximately 1.8 × 10−4 | 6 |

## Citas textuales
- "We identify an attack if the actions generated in the original and masked executions are similar." (p. 1)
- "based on the key insight that the agent’s tool calls are less dependent on the user inputs when subjected to attacks." (p. 2)
- "We argue that these cases represent actual security risks rather than detection errors, as they allow unrestricted execution of unverified external instructions." (p. 9)

## Limitaciones
Reconocidas por los autores:
- Sólo cubre desviaciones de la tarea directa; extenderlo a objetivos de ataque más amplios queda como trabajo futuro (p. 9).
- Falsos negativos: 66 casos evadieron la detección. De ellos, 72.73% son ataques que cumplen su objetivo con texto de respuesta y no con llamadas a herramientas, lo que MELON no ve (p. 9). Otras causas: redundancia de llamadas (15.15%), alucinación de estado (6.06%) y alucinación de funciones (6.06%) (p. 9).
- Falsos positivos: 9.28% en GPT-4o. Los autores argumentan que los casos marcados son riesgos reales porque el usuario pidió ejecutar instrucciones externas sin verificar (p. 9).
- Utilidad: "moderate BU decreases in specific cases" (p. 7), y UA promedio baja de 69.08% a 58.78% con MELON (p. 8).
- Costo: 2× llamadas al modelo (p. 5). La eficiencia (KV cache, enmascarado selectivo de estado) es trabajo futuro (p. 9).
- Alcance: sólo AgentDojo; VWA-Adv fue descartado (p. 6, 17–18). Excluyen ataques white-box y las defensas que requieren intervención humana, por supuestos fuertes y falta de automatización (p. 3, p. 6).
- Reconocen que "no security measure is perfect" (p. 9).

Observación propia:
- Los 629 casos combinan 97 tareas de usuario con tareas de ataque, así que no son muestras independientes. El tamaño efectivo es menor que el número total.
- La Tabla 1 reporta medias sin intervalos ni varianza entre corridas. Con temperatura 0 no se mide la variabilidad de las ejecuciones.
- MELON defiende al agente, no al sistema: si el detector falla, la herramienta igual se ejecuta. No hay control de procedencia ni de aprobación; la defensa es una decisión del propio agente.
- Inferencia: si el usuario legítimo pide la misma acción que el atacante, la ejecución enmascarada puede producir la misma llamada y MELON no la distingue de un ataque. El paper sólo lo discute para instrucciones que el usuario pide seguir desde fuentes externas.
- Los números de este paper (AgentDojo, GPT-4o con ASR de 16.06% sin defensa) no son comparables con los de MESH (correo, tres agentes, herramienta de reembolso). Sirven como referencia de método, no como contraste de resultados.

## Qué le sirve a MESH
1. **Señal de dependencia como complemento a la procedencia.** El paper demuestra que, bajo ataque exitoso, la acción depende de los datos y no de la tarea del usuario (p. 3). Inferencia: MELON sería una señal adicional a la etiqueta de procedencia, pero requiere otra llamada al modelo (2×, p. 5) y no reemplaza al gate del sandbox. Podría usarse como tercera defensa a comparar con approval_gate.
2. **Copiar la métrica UA, no sólo ASR.** MELON reporta ASR y UA juntos (p. 6–8). Demostrado: baja el ASR a 0.24% pero también la utilidad de 69.08% a 58.78%. Inferencia: el pitch de MESH debe mostrar que los flujos legítimos siguen funcionando, no sólo que bajan los fraudes. Los 0 falsos positivos en 12 controles son una muestra pequeña y conviene decirlo.
3. **Umbral de USD 500.** Demostrado: el paper encuentra que umbrales más bajos aumentan los falsos positivos y que acciones parecidas, como send_money a un hacker y a un amigo, se confunden entre sí (p. 8). Inferencia: el límite de USD 500 tiene el mismo problema de frontera. Los fraudes bajo el límite que MESH reporta son el equivalente de los falsos negativos de MELON, y conviene mostrar cómo cambia el resultado según el monto.
4. **Comparar destino y monto, como MELON hace.** Demostrado: en send_money MELON compara destinatario y monto y omite el resto de los argumentos (Apéndice A.3, p. 14). Inferencia: MESH puede comparar la cuenta destino del reembolso o cambio de cuenta de proveedor contra la cuenta registrada, como señal independiente de la verificación del remitente. El paper no aborda el origen del correo ni la verificación del remitente, que queda fuera de su modelo de amenaza (p. 3).
5. **Justificación de la aprobación humana.** Demostrado: los autores excluyen de su comparación las defensas con intervención humana (p. 3). Inferencia: ésa es una brecha en la literatura de benchmarks de detección, y MESH puede presentar la aprobación por procedencia como una defensa distinta, no comparada hasta ahora.
6. **Frase para el pitch.** Cita del p. 9: "We argue that these cases represent actual security risks rather than detection errors, as they allow unrestricted execution of unverified external instructions." Sirve para sostener que ejecutar instrucciones externas sin verificar es un riesgo real, que es lo que MESH bloquea con el gate y la etiqueta de procedencia. Lo que el paper demuestra es el falso positivo en el benchmark; la conexión con correo de fraude BEC es inferencia nuestra.
