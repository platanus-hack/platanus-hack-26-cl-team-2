# Securing AI Agents with Information-Flow Control

- **Autores:** Manuel Costa, Boris Köpf, Aashish Kolluri et al. (Microsoft) · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2505.23643 · **Tema:** control de flujo de información (IFC) para agentes de IA; defensa determinista contra inyección indirecta de prompts (PIA) con etiquetas de integridad y confidencialidad
- **Cobertura de lectura:** páginas 1–40, completo (las 2262 líneas del texto extraído, incluidos apéndices A–E, tablas 1–8 y referencias). No se abrió el PDF original porque ninguna tabla salió ilegible.

## Resumen

El paper estudia cómo el control de flujo de información puede dar garantías formales a agentes de IA frente a inyección indirecta de prompts, que hoy se mitiga sobre todo con defensas probabilísticas. Formaliza un modelo de bucle de agente y de planificador, y define dos políticas: las herramientas consecuentes solo se ejecutan si la decisión proviene de contexto confiable (P-T), y las herramientas que envían datos solo lo hacen si todos los destinatarios pueden leerlos (P-F). Sobre esa base presentan FIDES, un planificador que etiqueta datos con integridad y confidencialidad, oculta en variables los resultados de baja integridad y consulta un LLM aislado con salida tipada para extraer información sin exponer al planificador. Evalúan en AgentDojo (949 ataques con la estrategia Tool Knowledge) y encuentran que, con las políticas activas, FIDES no deja pasar ataques que violen P, mientras que Basic con política deja 9 (0) y FIDES 1 (0) con gpt-4o. Sin política, FIDES reduce las inyecciones exitosas de 163 (156) a 24 (23) con gpt-4o, pero la completación de tareas cae con la política, hasta 40 % para Basic. Los autores reconocen que los ataques de texto a texto no se bloquean porque las políticas solo actúan sobre llamadas a herramientas.

## Método

- **Modelo de amenaza (p. 3–4):** la configuración del agente (system message, descripciones de herramientas, LLMs) es confiable y el adversario la conoce; el adversario puede manipular los datos que devuelven las herramientas (reseñas, correos, páginas) y observar efectos de llamadas a herramientas (por ejemplo, una URL enviada a un servidor del atacante).
- **Garantías formales (p. 9–10):** non-interference para integridad (las llamadas consecuentes no dependen de datos no confiables) y explicit secrecy para confidencialidad (solo se previenen flujos explícitos, no los implícitos por orden de llamadas). Proposición 1 en p. 10.
- **Etiquetas (p. 6–7):** producto del retículo de integridad {T, U} y de un retículo de lectores para confidencialidad. Las herramientas etiquetan su salida; las etiquetas se propagan por unión (join) a lo largo de la conversación.
- **Benchmark (p. 13–14):** AgentDojo, con 97 tareas de usuario y 35 tareas de inyección en cuatro entornos (workspace, travel, banking, Slack). Ataque Tool Knowledge (el más efectivo contra GPT-4o según el leaderboard del propio AgentDojo). Cada tarea de usuario se cruza con todas las de inyección de su entorno: 949 ataques en total. Promedio de 5 ejecuciones por tarea.
- **Modelos (p. 15):** gpt-4o (2024-08-01), o1 (2024-12-17), o3 y o4-mini (2024-12-01), grok-3 (2024-10-12). Temperatura 0, top p 1. Razonamiento alto en los modelos de razonamiento.
- **Baselines (p. 15):** Basic (planificador con taint-tracking), Tool Filter (filtrado probabilístico de herramientas, la mejor defensa probabilística reportada en AgentDojo) y Variable Passing (sin inspección de variables).
- **Políticas (p. 8, 24–25):** P-T para herramientas consecuentes (por ejemplo send money, schedule transaction, update password); P-F o P-T para herramientas de envío (send email, send direct message). Etiquetado de integridad por regla: se marca como U todo campo que algún ataque de AgentDojo usa como vehículo.
- **Métricas (p. 14):** Attack Success Rate (ASR) y Task Completion Rate (TCR).
- **Taxonomía (p. 11–13):** tareas independientes de datos (DI), independientes de datos con LLM cuarentenado (DIQ) y dependientes de datos (DD). La clasificación de AgentDojo se hizo a mano con un oráculo humano (p. 17).

## Números clave

| Dato | Valor | Página |
|---|---|---|
| Ataques ejecutados en AgentDojo con Tool Knowledge (todos los planificadores y modelos) | 949 | 15 |
| Inyecciones exitosas, gpt-4o, Basic, sin política (Tabla 1; entre paréntesis sin 2 tareas de inyección) | 163 (156) | 15 |
| Inyecciones exitosas, gpt-4o, FIDES, sin política | 24 (23) | 15 |
| Inyecciones exitosas, gpt-4o, Basic★ (con política) | 9 (0) | 15 |
| Inyecciones exitosas, gpt-4o, FIDES★ (con política) | 1 (0) | 15 |
| Task Completion Rate, gpt-4o, Basic, sin política de chequeo, columna Overall (Tabla 6) | 83.30±1.84 | 37 |
| Task Completion Rate, gpt-4o, FIDES, sin política de chequeo, columna Overall (Tabla 6) | 59.79±3.18 | 37 |
| Caída de la utilidad con políticas, gpt-4o, Basic | hasta 40 % | 16 |
| Ventaja de FIDES con política frente a Basic con política | hasta 16.7 % usando o1 | 16 |
| Mejora de FIDES por ajuste de prompt (utilidad absoluta) | 8.2 % | 18 |
| Aumento de uso de tokens de FIDES frente a Basic | 2-3× en promedio | 39 |

## Citas textuales

- "We identify and define two fundamental security policies that ensure that (i) PIAs cannot trigger any consequential actions, and that (ii) the agent does not create illicit information flows." (p. 2)
- "For the binary integrity lattice, non-interference prevents untrusted data U from flowing into trusted sinks, which includes consequential control flow decisions and is sufficient to prevent PIAs." (p. 9)
- "Since we only enforce policies upon tool calls, our planners do not stop these text-to-text attacks." (p. 16)

## Limitaciones

Reconocidas por los autores:

- **Solo AgentDojo.** Descartaron InjecAgent (orientado a un turno) y ASB (no etiqueta valores de retorno) (p. 14).
- **Un solo ataque.** Evalúan únicamente Tool Knowledge, la variante más potente de Important Instructions (p. 14).
- **Etiquetas de integridad por regla, usando el propio benchmark.** Se marca como U todo campo que algún ataque de AgentDojo usa como vehículo, lo que es una línea base clara pero no un etiquetado real (p. 14, y p. 25).
- **Los ataques de texto a texto no se bloquean.** Las políticas solo actúan sobre llamadas a herramientas (p. 15–16).
- **Una inyección que solo crea un evento sin participantes pasa la política de confidencialidad** (Injection Task 2 en travel) (p. 16).
- **Costo de utilidad.** Con política, Basic pierde hasta 40 % en gpt-4o; FIDES★ sigue lejos de la utilidad ideal por fallos de planificación y por "compensatory leakage", cuando el modelo, tras fallar con query llm, expande variables y viola la política (p. 16–18).
- **Clasificación de tareas con oráculo humano** y no con un LLM (p. 17).
- **Los valores de Variable Passing distintos de cero en DIQ y DD se atribuyen a adivinanza** y a tareas mal evaluadas en AgentDojo (p. 35, y p. 40 sobre criterios de éxito).
- **Algunas políticas no revisan argumentos.** Las políticas P no verifican argumentos de herramientas (p. 18).
- **Solo garantizan explicit secrecy**: los flujos implícitos por orden o presencia de llamadas no se previenen (p. 9–10).
- **Salidas tipadas de query llm.** Un booleano puede llevar un ataque de un bit; el paper lo llama "unlikely", y advierte que endosar valores no confiables con políticas más permisivas se debe usar con cuidado (p. 13).
- **Prompt de sistema ajustado con tareas de workspace** para GPT-4o y reutilizado en el resto (p. 25).
- **Eficiencia no optimizada:** 2–3× más tokens (p. 39). La propagación de etiquetas a través del LLM es conservadora (p. 39).

Observación propia:

- Los ceros con política (9 (0), 1 (0)) dependen de excluir 2 tareas de inyección que los autores no consideran ataques (p. 15). Conviene citar siempre los dos números juntos.
- El texto de la p. 16 dice que Basic supera a FIDES "por 23.6 %" con gpt-4o, pero la Tabla 6 da 83.30 y 59.79, cuya diferencia es 23.51. No logro conciliar la cifra con la tabla; puede ser otra métrica o un error de redacción. No la usaría en el pitch sin revisar.
- Los resultados de seguridad cubren un solo tipo de ataque (Tool Knowledge). No hay un ataque adaptativo que intente sortear las políticas P-T o P-F.
- AgentDojo no contiene fraude por correo ni suplantación de un remitente confiable. Un atacante que se haga pasar por un proveedor de confianza recibiría, según el esquema del paper, etiqueta T si la fuente se marca como confiable. El paper no evalúa ese caso.

## Qué le sirve a MESH

1. **Respalda la etiqueta de procedencia (demostrado en el paper).** El paper hace lo que MESH llama etiqueta de procedencia: los datos de una fuente externa se marcan como U al leerse, la etiqueta la pone el wrapper de la herramienta y no el modelo, y viaja con cada mensaje por unión (p. 6–7, Algoritmo 6). Esto apoya el argumento de que la etiqueta debe venir del sistema. Inferencia propia: el paper aplica el mismo principio a los resultados de herramientas, no a mensajes entre agentes; la extensión a mensajes entre Camila, Mateo y Tomás es nuestra.

2. **La aprobación por procedencia es una versión humana de P-T (demostrado para P-T, inferencia para la comparación).** P-T bloquea una llamada consecuente si el contexto contiene datos U (p. 8). Con gpt-4o, Basic★ deja 9 (0) y FIDES★ 1 (0), frente a 163 (156) sin política (p. 15). La diferencia clave con MESH: el paper no tiene umbral de monto. Inferencia propia: con P-T sin umbral, los reembolsos fraudulentos por debajo de USD 500 también se bloquearían. Eso explica por qué en nuestros experimentos siguen pasando (6/21 con Haiku, 3/21 con Sonnet). Conviene probar P-T sin umbral y medir la utilidad, como hace el paper.

3. **Las rutas de riesgo tienen base formal.** La etiqueta de la conversación es la unión de las etiquetas de todos los mensajes, y la política se evalúa sobre la acción actual (p. 7, Algoritmo 6). El paper dice además que la política se puede extender a predicados sobre la traza completa (p. 9). Eso respalda calcular "camino de correo externo, agentes, herramienta peligrosa" como una propiedad de la traza, no como un chequeo local de cada agente. Esa es la idea central de MESH ("cada componente pasa su revisión, pero la ruta falla").

4. **La verificación del remitente sola no basta (inferencia).** El paper no evalúa verificación del remitente. Sus etiquetas se asignan a la fuente y se propagan, y la protección viene de la política sobre la herramienta. Nuestro resultado (la verificación sola no cambió 8/12 en Haiku) encaja con eso: la etiqueta sin una política sobre la herramienta consecuente no cambia el resultado. Esto refuerza que la defensa está en el sandbox y no en el modelo.

5. **Métricas para copiar.** Reportar ASR y TCR lado a lado, con y sin política (Tablas 1, 6 y 7). Nuestros 0 falsos positivos en 12 controles legítimos corresponden a un TCR de control; conviene añadir la tasa de completación en los controles con y sin defensa. El paper muestra que el costo de la defensa en utilidad es real (hasta 40 % para Basic), y decirlo en el pitch da credibilidad.

6. **Frases para el pitch.** Las dos citas de arriba sirven: la de la p. 9 ("non-interference prevents untrusted data U from flowing into trusted sinks ... is sufficient to prevent PIAs") respalda que la defensa debe actuar sobre el destino consecuente, y la de la p. 16 ("our planners do not stop these text-to-text attacks") justifica por qué MESH se centra en la herramienta de alto riesgo y no en la salida de texto. Ambas son afirmaciones de los autores; la conexión con fraude BEC es nuestra.
