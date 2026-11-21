# Google's Approach for Secure AI Agents: An Introduction

- **Autores:** Santiago Díaz, Christoph Kern, Kara Olive (Google)
- **Año / venue:** 2025 (mayo), white paper de Google. Se le suele citar como "An Introduction to Google's Approach to AI Agent Security" (así lo titula Simon Willison), pero el título exacto en la portada del PDF oficial es el que encabeza esta nota.
- **Enlace:** https://research.google/pubs/an-introduction-to-googles-approach-for-secure-ai-agents/ (PDF: https://storage.googleapis.com/gweb-research2023-media/pubtools/1018686.pdf)
- **PDF local:** ~/papers-ia-safety/bec-y-patrones/google-2025-ai-agent-security.pdf (18 pp.)
- **Verificado:** página de Google Research, más título, autores y fecha leídos en la portada del PDF descargado desde storage.googleapis.com. Los principios están en la p. 12 y las capas de defensa en las pp. 14-15. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
El white paper describe el marco "aspiracional" de Google para agentes de IA seguros.
Identifica dos riesgos principales: las acciones no deseadas ("rogue actions") y la divulgación de datos sensibles.
Plantea tres principios: los agentes deben tener controladores humanos bien definidos, poderes limitados y acciones y planificación observables.
El principio 1 exige distinguir de forma confiable las instrucciones del usuario de cualquier otro input, especialmente los datos no confiables.
Además pide confirmación humana explícita para acciones críticas o irreversibles, como "autorizar transacciones financieras significativas".
El principio 2 extiende el mínimo privilegio: los permisos se ajustan dinámicamente al propósito y a la intención actual, no solo se minimizan de forma estática.
El principio 3 pide registrar entradas, herramientas, parámetros y salidas, y caracterizar cada acción (solo lectura frente a cambio de estado).
La estrategia es un "hybrid defense-in-depth" con dos capas: motores de políticas deterministas fuera del modelo y defensas basadas en razonamiento (clasificadores, entrenamiento adversarial).
Reconoce que ni las reglas puras ni el juicio del modelo bastan por separado.
Se alinea con el Secure AI Framework (SAIF) de Google.

## Ataque o defensa que propone
- **Capa 1, "runtime policy enforcement"** (p. 15): un motor de políticas intercepta cada acción antes de ejecutarla y la evalúa según el riesgo inherente (¿es irreversible? ¿involucra dinero?), el contexto y **"potentially the chain of previous actions (Did the agent recently process untrusted data?)"**. El resultado puede ser permitir, bloquear o pedir confirmación.
- **Ejemplos del paper:** bloquear compras de más de US$500, pedir confirmación entre US$100 y US$500, e impedir correos externos si el agente acaba de procesar datos de una fuente sospechosa.
- **Capa 2:** entrenamiento adversarial, guard models (clasificadores) y modelos que predicen el riesgo de un plan.
- **Multi-agente** (p. 12): los escenarios con varios usuarios o agentes "requieren consideración cuidadosa", con identidades distintas y modelos de autorización claros.

## Números que reporta
No reporta resultados empíricos. Las cifras son de ejemplos de política: un umbral de **US$500** para bloquear y una franja de **US$100-500** para pedir confirmación (p. 15). Estructura: **2 riesgos, 3 principios, 2 capas**.

## Conexión con MESH
- **El "policy engine" con historial de taint es un fix directo para MESH:** hoy `execSandboxed()` en `apps/api/src/harness/sandbox.ts` decide solo por el nombre de la herramienta (`DEFAULT_ALLOWED`). La pregunta de Google, "¿procesó datos no confiables recientemente?", se traduce en pasar a `execSandboxed` un `taint` de sesión: verdadero si el agente leyó el correo o recibió un mensaje con `PROVENANCE_MARK` (`apps/api/src/harness/provenance.ts`). Con taint, `issue_refund` pasaría a "requiere confirmación" (vía `escalate_to_human` en `apps/api/src/mcp/server.ts`). Además se puede agregar un umbral de monto copiando el ejemplo de US$100/500 de Google.
- **Diferencia clave que MESH puede mostrar:** `provenance_tag` es una defensa de capa 2 (informa al modelo, de forma probabilística). Un `taint_gate` sería de capa 1 (determinista). La comparación antes/después con `evaluateRun()` (`apps/api/src/harness/evaluator.ts`) mostraría la diferencia entre "avisar" y "hacer cumplir".
- **Principio 3 (observable):** MESH ya lo cumple con la traza (`sandbox.tool_attempt` se registra antes de decidir) y con `observeRiskPaths()` en `apps/api/src/harness/risk-paths.ts`. Es un buen argumento para el jurado.
- **Principio 2 (poderes limitados y dinámicos):** el check `least_privilege` de `componentChecks()` es estático ("finanzas solo en los agentes elegidos"). La versión de Google sería dinámica: desactivar `update_vendor_bank_account` en una sesión iniciada por un correo externo.
- **Multi-agente:** Google lo menciona pero no lo desarrolla. MESH ocupa justo ese espacio.
