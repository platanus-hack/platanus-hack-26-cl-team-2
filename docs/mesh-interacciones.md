# MESH: interacciones reales

La interfaz inicia con datos reales. Organización consulta los agentes guardados
en `/api/agents` y las ejecuciones disponibles en `/api/runs`. No crea agentes
ni ejecuta llamadas a modelos automáticamente.

1. Guarda al menos dos agentes desde el creador de perfiles o empresas.
2. En Simulaciones, selecciona participantes, agente inicial y escenario.
3. Inicia la conversación. Esta acción utiliza la clave Anthropic configurada
   en el servidor y consume créditos.
4. El mapa selecciona la nueva ejecución y recibe sus eventos mediante SSE.
5. Selecciona un nodo para inspeccionar sus relaciones y la evidencia.

El selector de ejecución permite revisar también las conversaciones anteriores
que la API conserva en memoria. El botón Actualizar recarga los resultados y
la evaluación guardada, incluido el dictamen generado después de la ejecución.

## Qué representa el grafo

- `agent.message_sent`: relación dirigida entre emisor y destinatario.
- `agent.tool_call`: intento de llamada desde un agente a una herramienta.
- Cada relación conserva un contador y el ID del último evento observado.
- Los perfiles sin ejecución seleccionada no tienen relaciones inferidas.
- Las capacidades configuradas no prueban permisos efectivos.
- Los resultados de una ejecución no son puntajes de resistencia por atributo
  ni una tasa de éxito de ataques.

Los agentes se guardan en la base de datos. Las ejecuciones y sus trazas se
pierden al reiniciar la API; todavía no existe almacenamiento histórico duradero.
Las herramientas financieras ejecutan simulaciones y bloquean los cambios
bancarios. El botón de demostración permite acceder al escenario ficticio,
separado de las interacciones reales.

La interfaz está en español. Los identificadores técnicos, nombres de
herramientas y contenido original de perfiles, correos y trazas se conservan.
Las nuevas explicaciones del evaluador se solicitan en español.
