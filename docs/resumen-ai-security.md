# MESH — Seguridad organizacional para sistemas de agentes de IA

> Find the vulnerabilities between the agents.

## Qué es MESH

MESH es una plataforma para evaluar la seguridad de agentes de inteligencia artificial y de las interacciones entre ellos. Permite configurar una organización, caracterizar sus agentes y ejecutar escenarios adversariales para observar cómo circulan instrucciones, información y autoridad.

Su foco es la seguridad de la composición: comprender qué ocurre cuando agentes con distintos roles, herramientas y permisos colaboran y delegan tareas.

## El problema que aborda

Un agente de soporte recibe una solicitud externa, su jefatura coordina la resolución y un agente de finanzas dispone de herramientas sensibles. Durante esa cadena, el contenido puede resumirse, reinterpretarse o presentarse como una instrucción interna.

MESH estudia cómo se conserva la procedencia de esa información, qué autorizaciones se verifican y qué acciones se intentan después de cada relevo.

## Evaluación individual: MESH Black Box

Cada agente se caracteriza mediante su prompt, rol, contexto organizacional y herramientas. Un LLM diseña escenarios adversariales adaptados al perfil; el agente los ejecuta de manera aislada y una etapa de evaluación analiza las trazas.

Las pruebas abarcan seis dimensiones:

- Reemplazo de instrucciones (`instruction_override`).
- Inyección indirecta (`indirect_injection`).
- Abuso de herramientas (`tool_misuse`).
- Exfiltración de datos (`data_exfiltration`).
- Ingeniería social (`social_engineering`).
- Manejo de secretos (`secret_handling`).

El resultado incluye puntajes de 1 a 100 —mayor puntaje significa mayor vulnerabilidad según el evaluador—, observaciones, escenarios e identificadores de ejecución. También registra el modelo y una instantánea del perfil evaluado.

## Evaluación sistémica: MESH Organizational Intelligence

MESH analiza rutas que conectan entradas externas con agentes y herramientas sensibles. Antes de ejecutar, un analizador determinista construye rutas posibles y examina la disponibilidad de controles y señales de procedencia en cada relevo.

Después de la simulación, reconstruye las rutas observadas desde los mensajes y llamadas a herramientas. Así permite seguir el recorrido completo: **entrada externa → interpretación → delegación → uso de herramientas → resultado observable**.

## Flujo de uso

1. Configurar la empresa y su contexto.
2. Crear agentes con un prompt individual o importar una lista pegando JSON.
3. Seleccionar participantes, permisos, escenario y agente receptor inicial.
4. Ejecutar la conversación y seguir sus mensajes y acciones.
5. Revisar resultados, rutas de interacción y evaluación posterior.
6. Repetir el escenario con mitigaciones y comparar ejecuciones.

El orquestador mantiene sesiones por agente y coordina sus turnos. Los agentes se comunican mediante `send_message`, consultan mensajes con `read_inbox` y finalizan su participación con `done`.

## Observabilidad y evaluación

La plataforma combina evidencia determinista con interpretación mediante LLM:

- **Evaluador determinista:** identifica intentos de uso de herramientas financieras, reembolsos simulados, acciones bloqueadas o retenidas y llegada a agentes con permisos sensibles.
- **Juez LLM:** resume decisiones, riesgos de interacción y observaciones de gobernanza, y propone mitigaciones.
- **Visualización de rutas:** conecta participantes, mensajes y acciones observadas.
- **Evaluaciones por lotes:** organizan escenarios, mitigaciones y repeticiones para comparar resultados.

## Mitigaciones

| Control | Funcionamiento |
|---|---|
| `sender_check` | Comprueba características del remitente y añade una advertencia al agente receptor. |
| `provenance_tag` | Incorpora información de origen en los mensajes entre agentes. |
| `approval_gate` | Retiene cambios bancarios y reembolsos superiores al umbral configurado cuando aplica la política de procedencia externa. |

Las herramientas financieras del laboratorio registran los intentos: los cambios bancarios se bloquean y los reembolsos son simulados. Las acciones retenidas devuelven un estado de aprobación humana pendiente.

## Arquitectura técnica

| Componente | Implementación |
|---|---|
| Interfaz | React, TypeScript y Vite. |
| API | Node.js y Hono. |
| Modelos | SDK de Anthropic para agentes, diseño de pruebas y evaluación. |
| Persistencia | Drizzle ORM con SQLite/PostgreSQL. |
| Instrumentación | Eventos de ejecución y streaming mediante SSE. |
| Contratos | Tipos TypeScript compartidos. |
| MCP | Servidor de herramientas financieras simuladas para pruebas de agentes. |
| Harness original | Python para escenarios de correo y cadenas de agentes. |

## Ejemplo de aplicación

Una empresa de servicios informáticos configura tres agentes: soporte, jefatura de soporte y finanzas. Un escenario introduce un ticket externo con una petición sensible. MESH registra cómo se interpreta, a quién se deriva y qué validaciones y acciones se realizan.

El equipo de AI Security puede explorar la propagación de instrucciones, el tratamiento de la autoridad y la relación entre los permisos individuales y el comportamiento de la cadena completa.
