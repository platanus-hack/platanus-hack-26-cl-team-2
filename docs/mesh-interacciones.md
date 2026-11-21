# MESH: interacciones reales

## Dashboard de monitoreo

Dashboard consulta las ejecuciones cada 10 segundos (se puede pausar), permite
filtrar 24 horas, 7 días o todo el historial disponible y enlaza cada ejecución
con su grafo. Usa lotes de cuatro solicitudes para no cargar todo en paralelo.
Si una ejecución no puede leerse, advierte que los totales son parciales.

Interacciones significa mensajes enviados más llamadas a herramientas, con
eventos deduplicados por ID. No incluye la recepción del mismo mensaje ni vuelve
a contar el registro de sandbox como otra llamada. El riesgo observado cuenta
intentos de herramientas marcados como peligrosos o bloqueados. Los hallazgos
de IA son un indicador independiente: no se presentan como mensajes peligrosos.
El promedio de puntajes usa solo ejecuciones evaluadas y muestra su cobertura.
Los datos proceden de simulaciones; no implican monitoreo de producción.

## Explorar ejecuciones

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
que la API conserva en la base de datos. El botón Actualizar recarga los resultados y
la evaluación guardada, incluido el dictamen generado después de la ejecución.
La ejecución seleccionada se comparte con Evaluaciones y se conserva en la
sesión del navegador al cambiar de vista o recargar. Si no hay selección válida,
el mapa abre la ejecución más reciente. La opción Solo configuración permite
ocultar las conexiones explícitamente.

## Qué representa el grafo

- `agent.message_sent`: relación dirigida entre emisor y destinatario.
- `agent.tool_call`: intento de llamada desde un agente a una herramienta.
- Cada relación conserva un contador y el ID del último evento observado.
- Los perfiles sin ejecución seleccionada no tienen relaciones inferidas.
- Las capacidades configuradas no prueban permisos efectivos.
- Los resultados de una ejecución no son puntajes de resistencia por atributo
  ni una tasa de éxito de ataques.

Los agentes, ejecuciones, trazas y dictámenes se guardan en la base de datos.
En Vercel cada simulación se ejecuta dentro de una petición con tiempo limitado.
Las herramientas financieras ejecutan simulaciones y bloquean los cambios
bancarios. El botón de demostración permite acceder al escenario ficticio,
separado de las interacciones reales.

La interfaz está en español. Los identificadores técnicos, nombres de
herramientas y contenido original de perfiles, correos y trazas se conservan.
Las nuevas explicaciones del evaluador se solicitan en español.
