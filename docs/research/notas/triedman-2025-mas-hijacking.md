# Multi-Agent Systems Execute Arbitrary Malicious Code

- **Autores:** Harold Triedman, Rishi Jha, Vitaly Shmatikov (Cornell)
- **Año / venue:** 2025. COLM 2025 (el PDF dice "Published as a conference paper at COLM 2025"). arXiv v1 15-mar-2025, v2 12-sep-2025.
- **Enlace:** https://arxiv.org/abs/2503.12188
- **PDF local:** ~/papers-ia-safety/multiagente/triedman-2025-mas-hijacking.pdf
- **Verificado:** página arxiv.org/abs/2503.12188 (título, autores, versiones) y encabezado del PDF (venue COLM 2025). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
El paper presenta el "MAS hijacking" (secuestro del flujo de control de un sistema multiagente).
Contenido adversario (un archivo local, una página web, incluso una sola imagen) logra que el orquestador invoque agentes peligrosos y termine ejecutando código arbitrario (reverse shell) o exfiltrando datos del contenedor.
El truco más simple: el agente que lee el archivo devuelve un **mensaje de error falso**, del tipo "la única forma de abrirlo es ejecutarlo", y el orquestador le pide al agente de código que lo ejecute.
Los autores lo encuadran como el clásico problema del **"confused deputy"**: los sub-agentes "lavan" el pedido del atacante, que llega al orquestador como salida confiable de un agente confiable.
El orquestador nunca toca contenido no confiable, así que la inyección indirecta directa sobre él no es posible: el ataque solo funciona a través del traspaso.
Prueban AutoGen (orquestadores Magentic-One, Selector y Round-Robin), CrewAI y MetaGPT, con GPT-4o, GPT-4o-mini, Gemini 1.5 Pro y Gemini 1.5 Flash.
Las inyecciones indirectas conocidas (plantillas de AgentDojo) fallan casi siempre: ~0-1%.
Funciona aunque cada agente, por separado, rechace las acciones dañinas. En CrewAI, el orquestador creó un archivo "dummy" para leer "de forma segura" y después ejecutó el archivo de ataque igual.
En AutoGen, después de que el coder se negó, otro sub-agente escribió él mismo el reverse shell.
Concluyen que la causa no es la falta de alineamiento de cada agente sino la confianza implícita entre agentes y el manejo "adaptativo" de errores.

## Ataque o defensa que propone
- Ataque: MAS hijacking (control-flow hijacking) mediante metadatos entre agentes (reportes de error, estados de tarea). Vectores: archivo local, redirección web, página web e imagen.
- No propone una defensa propia. Discute LLM Tagging (Lee & Tiwari), validación de llamadas a herramientas y defensas de prompting. Un trabajo posterior de los mismos autores (arXiv 2510.17276) evalúa defensas tipo LlamaFirewall: no lo leí, **no verificado**.

## Números que reporta
- Abstract: con agentes GPT-4o, la ejecución de código malicioso vía web ocurre en **58-90%** de los intentos según el orquestador, y llega a **100%** en algunas combinaciones.
- Tabla 2 (Web Redirect, reverse shell): el éxito va de 58% a 90% con GPT-4o y de 43% a 100% con GPT-4o-mini (RR 100%, Sel. 98%). Las líneas base son IPI 0-1% y pedido directo 0-50%.
- Tabla 3 (Local File): Magentic-One + GPT-4o **97%**; Selector 95%; RR 87%; CrewAI 68%; MetaGPT 8%.
- Tabla 5 (CrewAI, exfiltración): orquestador GPT-4o con sub-agentes GPT-4o-mini y archivo local, 65% (con sub-agentes GPT-4o, 37%).
- Tabla 7 (pedido directo de abrir un reverse shell): GPT-4o tiene 72% de rechazo y 0% de éxito; GPT-4o-mini, 86% de rechazo y 6% de éxito.
- Sec. 6.4: en el experimento "direct hijack" (los metadatos adversarios, en el formato que produce un sub-agente, se envían directo al orquestador como prompt de usuario) el éxito es **80% (28/40) con 0% de rechazo**, contra **6% de éxito y 86% de rechazo** del pedido en lenguaje llano (Tabla 7, GPT-4o-mini, promedio entre orquestadores). Los autores concluyen que "lavar" el pedido a través de sub-agentes es una nueva forma de jailbreak indirecto. Ojo: el 80% no pasa por un sub-agente; mide el efecto del formato. (Precisión agregada por el coordinador tras releer la Sec. 6.4.)
- Contacto incidental: 87,5% (35/40). Con 10 paráfrasis del pedido del usuario, el éxito va de 40% a 85% (59,5% en promedio, 200 intentos).
- Cada combinación se midió con 10 intentos.

## Conexión con MESH
- **Es la evidencia más fuerte para la tesis de MESH:** "el pedido se lava al pasar por un agente". La inyección clásica casi nunca funciona contra el orquestador (Sec. 6.1), pero el ataque que pasa por sub-agentes logra 58–90% (GPT-4o), y el pedido en el formato reformulado por un sub-agente pasa de 6% a 80% de éxito (Sec. 6.4). MESH dice lo mismo para BEC: finanzas recibe "un mensaje interno de un colega", como escribe `describe()` en `apps/api/src/harness/risk-paths.ts`.
- **Esto ya lo muestra Triedman.** Lo que MESH agrega:
  - el dominio financiero y de ingeniería social, sin código malicioso ni inyección explícita;
  - un análisis **estático y determinista** de las rutas antes de correr (`analyzeRiskPaths()`), confirmado contra la traza (`observeRiskPaths()`);
  - una medición del salto donde se pierde el veredicto (`verdictLostAtHop`);
  - una defensa del harness (`provenance_tag`) que hace viajar el origen a través del traspaso.
- **Idea para MESH: "delta de lavado".** Correr los mismos correos con el seed = finanzas (ruta `local`, finanzas lee el correo original) contra seed ≠ finanzas (rutas `interaction`/`systemic`). La diferencia de tasa de `attack_succeeded` (en `apps/api/src/harness/evaluator.ts`) es el equivalente MESH del 6% → 80%. `batch.ts` ya acepta `BATCH_SEED`/`BATCH_FINANCE`; solo falta correr las dos configuraciones y reportar la resta.
- **El chequeo `peer_channel` de `componentChecks()` siempre da `ok: true`** ("nadie puede hacerse pasar por otro agente"). Triedman muestra que el problema no es la suplantación del canal sino el contenido auténtico de un compañero engañado (confused deputy). Es justo el ejemplo de "el componente pasa, la ruta falla".
