# Securing AI Agents with Information-Flow Control

- **Autores:** Manuel Costa, Boris Köpf, Aashish Kolluri, Andrew Paverd, Mark Russinovich, Ahmed Salem, Shruti Tople, Lukas Wutschitz, Santiago Zanella-Béguelin (Microsoft)
- **Año / venue:** 2025, preprint arXiv (cs.CR), arXiv:2505.23643. Venue de conferencia: no verificado.
- **Enlace:** https://arxiv.org/abs/2505.23643 (tutorial: https://github.com/microsoft/fides)
- **PDF local:** ~/papers-ia-safety/procedencia-ifc/costa-2025-fides.pdf
- **Verificado:** metadatos de arxiv.org/abs/2505.23643 (título, 9 autores, fecha 2025/05/29); las cifras salen del PDF (sección 8, Tabla 1). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
El paper estudia qué garantías puede dar el control de flujo de información (IFC) en agentes LLM.
Propone un modelo formal de "planners" (el bucle que orquesta LLM y herramientas) y caracteriza qué propiedades puede imponer el taint tracking dinámico.
Cada mensaje, acción y resultado de herramienta lleva una etiqueta de confidencialidad y otra de integridad. La etiqueta del contexto es la unión de todo lo que el planner ha visto.
Un motor de políticas determinista revisa cada acción consecuente antes de ejecutarla.
Hay dos políticas base. P-T (acción confiable) impide que una inyección dispare acciones consecuentes. P-F impide flujos de datos ilícitos.
El ejemplo motivador es casi MESH: un correo malicioso se marca de baja integridad por venir de un remitente no confiable, y en cualquier contexto que lo contenga se prohíben las acciones consecuentes.
Para no perder utilidad, FIDES oculta selectivamente en variables solo los datos que bajarían la etiqueta del contexto, y los inspecciona con un LLM en cuarentena con salida tipada (decodificación restringida).
Las salidas de baja capacidad, como un booleano, pueden fluir hacia acciones consecuentes porque la inyección solo influye 1 bit.
Propone además una taxonomía de tareas para medir qué se puede hacer de forma segura con cada diseño de planner.
En AgentDojo, con políticas activas, bloquea todos los ataques que violan P.

## Ataque o defensa que propone
Defensa: IFC dinámico en el planner. Tiene cuatro piezas:
- **Etiquetas en un retículo.** Confidencialidad × integridad, aumentadas con tipo.
- **Propagación por unión (join).** La etiqueta del contexto sube con cada dato no confiable.
- **Políticas por herramienta.** P-T para herramientas consecuentes. P-T y/o P-F para herramientas que sacan datos.
- **Primitivas de ocultar y revelar.** Variables más un LLM en cuarentena con salida estructurada. Funcionan como "endorsement" acotado por capacidad de información.

Las garantías formales son no-interferencia para integridad y "explicit secrecy" para confidencialidad.

## Números que reporta
- **Tabla 1** (gpt-4o, ataque "Tool Knowledge", 949 ataques; entre paréntesis, excluidas 2 tareas que no consideran ataques):

  | Defensa | Ataques exitosos |
  |---|---|
  | Basic | **163 (156)** |
  | Tool Filter | 28 (23) |
  | Variable Passing | 12 (0) |
  | FIDES sin políticas | 24 (23) |
  | Basic con políticas | 9 (0) |
  | **FIDES con políticas** | **1 (0)** |

- Sección 8.1: "Without policy checks, all planners, including FIDES, succumb to practical PIAs."
- Sección 8.2, utilidad:
  - Con políticas, el planner Basic pierde hasta **40%** de tareas completadas (gpt-4o).
  - FIDES pierde hasta **24,5%** (o3/o4-mini), pero completa hasta 16,7% más que Basic (o1).
  - Con modelos de razonamiento hace en promedio ~16% más tareas que Basic, y ~24% con ajuste de prompt.
  - Sin políticas, Variable Passing es hasta 57,52% peor que FIDES.

## Conexión con MESH
- **La regla a copiar.** "En cualquier contexto que contenga el correo externo, deniega acciones consecuentes" (sección 1) es literalmente la política que le falta a MESH. Es P-T aplicada a `update_vendor_bank_account` e `issue_refund`.
- **Valida la tesis "el tag solo informa".** FIDES sin chequeo de políticas, pese a llevar etiquetas, deja pasar 23 a 24 ataques. Con chequeo, 0. Lo mismo esperaríamos de `provenance_tag` (informativo) frente a una política.
- **Implementación concreta (etiqueta de contexto por join, a nivel de agente):**
  1. `packages/shared/src/index.ts`: agregar `label?: "trusted" | "external"` a `PeerMessage`.
  2. `apps/api/src/harness/agent-runner.ts`: agregar `tainted: boolean` a la sesión. Vale `true` si `isSeed` y la corrida tiene correo. Se pone en `true` también cuando `read_inbox` devuelve algún mensaje con `label === "external"`.
  3. `apps/api/src/message-bus.ts`: `send()` recibe el label del emisor (`session.tainted ? "external" : "trusted"`) y lo guarda en el mensaje. Es metadato del harness, no texto que el modelo pueda borrar.
  4. `apps/api/src/harness/sandbox.ts`: `execSandboxed(..., ctx)` aplica `POLICY = { update_vendor_bank_account: "P-T", issue_refund: "P-T" }`: si `ctx.tainted`, devuelve `blocked_by_taint_policy`.
  5. `apps/api/src/harness/risk-paths.ts`: cada salto propaga el label (`labelPropagated`). Si la política está activa, la ruta queda "enforced" sin depender del modelo.
- **Endorsement acotado.** FIDES permite un booleano extraído de un contexto contaminado. En MESH sería una herramienta `verify_vendor_out_of_band(vendor_id) → bool` simulada: el humano o un sistema confirma por otro canal y eso "limpia" solo esa acción. Es el control BEC real (callback al proveedor).
- **Límite a declarar.** El taint a nivel de contexto sobre-contamina: un agente que leyó el correo no puede hacer nada consecuente en toda la corrida. Para BEC está bien, porque es el comportamiento deseado. Hay que medirlo como costo de utilidad con escenarios benignos.
