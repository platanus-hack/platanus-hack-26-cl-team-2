# The Dual LLM pattern for building AI assistants that can resist prompt injection

- **Autores:** Simon Willison
- **Año / venue:** 2023 (25 de abril de 2023, con una actualización del 11 de abril de 2025), blog personal simonwillison.net
- **Enlace:** https://simonwillison.net/2023/Apr/25/dual-llm-pattern/
- **PDF local:** página web, sin PDF
- **Verificado:** WebFetch de la URL oficial: título, autor y fecha confirmados en la página. CaMeL (arXiv:2503.18813, sección 6.2.1) lo cita como "Willison (2023)". · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Willison propone separar el asistente en dos LLMs y un controlador que no es un modelo.
El LLM privilegiado solo recibe input confiable (el usuario) y puede usar herramientas: mandar correos, editar el calendario.
El LLM en cuarentena procesa todo contenido no confiable, no tiene herramientas y "puede volverse rebelde en cualquier momento".
El controlador es software normal. Ejecuta las acciones, guarda el contenido contaminado en variables (`$VAR1`, `$VAR2`) y solo sustituye el texto real al mostrarlo al usuario.
El LLM privilegiado "solo ve nombres de variables" y nunca el correo ni el resumen contaminado.
Hay una excepción: salidas verificables, como una etiqueta de un conjunto cerrado, pueden volver al LLM privilegiado.
Admite límites. La ingeniería social contra el usuario rompe el esquema, encadenar prompts puede propagar la inyección, y la solución es "bastante mala" en complejidad y UX.
Declara que no es 100% confiable.
En la actualización de 2025 reconoce que CaMeL señala una falla del patrón y propone un sistema más evolucionado.
No reporta números.

## Ataque o defensa que propone
Defensa arquitectónica: separar privilegio y contaminación. Quien ve datos no confiables no tiene herramientas, y quien tiene herramientas no ve datos no confiables. Un controlador determinista hace de frontera.

## Números que reporta
Ninguno: es un ensayo de diseño. Sin benchmarks ni ASR.

## Conexión con MESH
- **Es el antecedente directo de la pregunta de MESH.** En el Dual LLM, el agente con herramientas nunca toca contenido contaminado. En MESH, el agente de finanzas recibe mensajes de un colega que sí leyó el correo. El correo "entra" al contexto privilegiado de forma indirecta y lavada por un agente interno. Es la falla de "encadenamiento" que Willison advierte ("the boundary between the two LLMs must be guarded zealously").
- **El check `separation` de `risk-paths.ts`** ("El agente que lee el correo externo no puede pagar") es un Dual LLM parcial: separa a quien lee de quien paga, pero el canal `send_message` cruza la frontera sin control. MESH demuestra empíricamente la advertencia de Willison en multiagente.
- **Idea concreta (versión "variables").** El harness podría reemplazar, en los mensajes hacia agentes con finanzas, el contenido derivado del correo por una referencia opaca. Es la opción drástica y probablemente rompe la utilidad. Es más práctico el enfoque CaMeL/FIDES: dejar pasar el texto, pero marcar el contexto receptor como contaminado y que `sandbox.ts` deniegue las herramientas consecuentes.
- **Límite que aplica a MESH.** Willison asume que el input del usuario es confiable. En BEC, el "usuario" efectivo es el atacante (el correo es la tarea), y ninguna separación salva eso sin una política explícita sobre la acción.
