# Respaldo para el pitch de MESH

Cinco frases con cita, en la forma «esto ya lo muestra X; nosotros agregamos Y», y tres preguntas
difíciles con respuesta. Cada cifra sale de una nota de [notas/](notas/) verificada contra la fuente
original. La misma regla de [docs/pitch.md](../pitch.md) vale aquí: no decir números que no estén
en la nota.

## Cinco frases

### 1. El problema cuesta plata real

> «El fraude por correo que pide cambiar datos de pago ya le costó a las empresas **US$3.046
> millones** en 2025, solo en lo denunciado al FBI. Es el segundo delito más costoso del informe.
> Nosotros probamos qué pasa cuando quien lee ese correo es un equipo de agentes de IA.»

Cita: FBI IC3, *Internet Crime Report 2025*, p. 26 (BEC: 24.768 denuncias, US$3.046.598.558).
[Nota](notas/fbi-ic3-2025-bec.md). Uso: apertura, diapositiva 2.

### 2. OWASP ya describe nuestro escenario

> «OWASP ya lo lista como amenaza: en su Top 10 para aplicaciones agénticas, un correo hace que un
> agente clasificador le pida a uno de finanzas mover plata, y finanzas paga porque confía en un
> agente interno. Nosotros lo convertimos en un banco de pruebas: agentes Claude reales, herramientas
> de finanzas en sandbox y el resultado sacado de la traza, sin IA.»

Cita: OWASP GenAI Security Project, *OWASP Top 10 for Agentic Applications for 2026* (publicado el
9-dic-2025), ASI03 «Identity and Privilege Abuse», escenario 3 «Cross-Agent Trust Exploitation»,
p. 16. Texto original: «A crafted email from IT instructs an email sorting agent to instruct a finance
agent to move money to a specific account. The sorter agent forwards it, and the finance agent,
trusting an internal agent, processes the fraudulent payment without verification.»
[Nota](notas/owasp-2025-top10-agentic-apps.md). Uso: diapositiva 2, justo después del diagrama.

### 3. El «lavado» entre agentes ya está medido; nosotros lo localizamos

> «Que un pedido se lava al pasar por otro agente ya está medido: en Cornell, la inyección clásica
> casi nunca funcionó contra sistemas multiagente, pero el mismo ataque pasado por los sub-agentes
> logró que el sistema ejecutara código malicioso en 58 a 90 % de los intentos. Nosotros agregamos el
> mapa: antes de correr, MESH dice en qué salto se pierde la advertencia, y después la traza
> confirma qué ruta se recorrió.»

Cita: Triedman, Jha y Shmatikov, *Multi-Agent Systems Execute Arbitrary Malicious Code*, COLM 2025.
Abstract: «execute arbitrary malicious code in 58-90% of trials» (GPT-4o, según el orquestador);
sección 6.1: «IPI is almost completely unsuccessful». [Nota](notas/triedman-2025-mas-hijacking.md).

Si un juez pregunta por el «6 % contra 80 %» del mismo paper (sección 6.4): pedir el reverse shell en
lenguaje llano da 6 % de éxito y 86 % de rechazo (GPT-4o-mini, promedio entre orquestadores, Tabla 7);
el mismo pedido **en el formato en que lo reformula un sub-agente**, enviado directo, da 80 % (28 de 40)
con 0 % de rechazo. Los autores concluyen que el «lavado» a través de agentes de confianza es un
jailbreak indirecto nuevo. No decir «80 % pasando por un sub-agente»: ese experimento no pasa por uno.

Ojo: su ataque es ejecución de código, no pagos. Uso: diapositiva 3 o al mostrar las rutas previstas.

### 4. Avisar no basta: por eso medimos la ruta

> «Que etiquetar el origen no alcanza ya lo muestran otros: una etiqueta de origen sola reduce el
> ataque en solo 5 %, y Microsoft concluye que sin políticas que la hagan cumplir, todos los sistemas
> caen. Nosotros mostramos dónde se pierde esa etiqueta en un equipo de agentes, y medimos cada
> mitigación con los mismos agentes y el mismo correo.»

Citas: Lee y Tiwari, *Prompt Infection: LLM-to-LLM Prompt Injection within Multi-Agent Systems*,
arXiv 2410.07283, 2024, sección 6 («LLM Tagging» sola: −5 %; combinada con Marking bloquea el 100 %).
[Nota](notas/lee-2024-prompt-infection.md). Costa et al. (Microsoft), *Securing AI Agents with
Information-Flow Control*, arXiv 2505.23643, 2025, sección 8.1: «Without policy checks, all planners,
including FIDES, succumb to practical PIAs». [Nota](notas/costa-2025-fides.md).

Si se implementa la idea 1 de [ideas.md](ideas.md) (`taint_gate`), se puede cerrar con: «y la
convertimos en una regla del sistema: si el pedido viene del correo, el cambio bancario se bloquea
aunque el modelo quiera hacerlo». **Sin la idea 1, no decir esa última parte.**

### 5. Cada agente cumple la regla; la ruta la viola

> «Meta propuso una regla simple: ningún agente debe juntar estas tres cosas: leer contenido no
> confiable, acceder a sistemas sensibles y poder actuar. En nuestro equipo, cada agente por separado
> la cumple: el que lee el correo no paga, y el que paga no lee el correo. Pero la ruta la viola,
> porque el correo viaja por un mensaje interno hasta finanzas. Eso es lo que MESH calcula.»

Cita: Meta AI, *Agents Rule of Two: A Practical Approach to AI Agent Security*, blog, 31-oct-2025.
[Nota](notas/meta-2025-agents-rule-of-two.md). Mismo argumento en Willison, *The lethal trifecta for
AI agents* (2025). [Nota](notas/willison-2025-lethal-trifecta.md).

El razonamiento es cierto hoy para la configuración de la demo (Camila lee el correo y no tiene
finanzas; Tomás tiene finanzas y no lee el correo). Para **mostrarlo en pantalla** hace falta la idea 2
de [ideas.md](ideas.md). Sin ella, decirlo verbalmente sobre el panel de rutas actual.

---

## Tres preguntas difíciles

### P1. «Triedman, Lupinacci y Prompt Infection ya mostraron que los agentes confían en sus pares. ¿Qué aportan ustedes?»

**Respuesta.** «Tiene razón, el problema no lo descubrimos nosotros, y lo citamos. Esos trabajos
muestran que el ataque funciona: Triedman con ejecución de código, Lupinacci con malware (los 18
modelos que probaron cayeron al menos una vez vía un agente par) y Lee y Tiwari con infecciones que
se replican. Nosotros agregamos tres cosas. Primero, un análisis sin IA que corre antes de lanzar y
dice en qué salto se pierde la advertencia; la traza después confirma la ruta. Segundo, el caso de
fraude con pagos, donde el canal entre agentes es auténtico y el correo muchas veces no tiene ninguna
inyección visible: de los 6 correos BEC realistas, el chequeo de remitente marca solo 2. Tercero,
comparamos mitigaciones con los mismos agentes y el mismo correo.»

**No decir «somos los primeros».** Triedman cita un trabajo de análisis estático de cadenas de
herramientas (Liu et al. 2024c) que no verificamos.

Fuentes: [Triedman](notas/triedman-2025-mas-hijacking.md), [Lupinacci](notas/lupinacci-2025-inter-agent-trust.md),
[Lee y Tiwari](notas/lee-2024-prompt-infection.md); dato de 2 de 6 en [docs/pitch.md](../pitch.md).

### P2. «Su `provenance_tag` es solo texto que le avisa al modelo. La literatura dice que eso casi no sirve. ¿Por qué funcionaría?»

**Respuesta.** «Estamos de acuerdo, y por eso no lo vendemos como la solución. La etiqueta asegura
que finanzas **sepa** que el pedido vino de afuera; qué hace con eso lo decide el modelo, y por eso lo
medimos en lote en vez de suponerlo. Lo que sí es determinista hoy es el sandbox: el cambio bancario
se bloquea siempre y el intento queda registrado. Y lo que MESH muestra es que, sin la etiqueta,
finanzas decide sin saber que el pedido vino de afuera. El paso siguiente es el que piden CaMeL y
FIDES: que la procedencia active una regla, no solo un aviso.»

Si se implementó la idea 1: «y ya lo hicimos: con `taint_gate`, el sandbox bloquea la acción si el
agente recibió contenido del correo, aunque el modelo quiera ejecutarla».

Si preguntan si la etiqueta se puede falsificar: hoy sí, en parte (el texto del agente no se limpia
de la marca `[provenance]`). Es la idea 3 de [ideas.md](ideas.md); si no está hecha, decirlo como
límite conocido.

Fuentes: [Lee y Tiwari](notas/lee-2024-prompt-infection.md), [FIDES](notas/costa-2025-fides.md),
[CaMeL](notas/debenedetti-2025-camel.md) (con Claude 4 Sonnet, los ataques exitosos bajan de 75 a 11
de 949 con sus políticas).

### P3. «El cambio bancario está siempre bloqueado y corren pocas repeticiones. ¿Qué miden realmente?»

**Respuesta.** «Medimos el **intento**, no si la plata se movió. El sandbox registra la llamada antes
de decidir si la bloquea, así que vemos si el modelo cayó aunque el sistema lo haya frenado. Un
benchmark de Meta separa justamente esos dos niveles: los agentes se desvían de su tarea en 17 a 86 %
de los casos, pero el objetivo del atacante se cumple en 16 % como máximo, lo que los autores llaman
seguridad por incompetencia. Sobre las repeticiones: con 5 corridas, cero intentos solo nos deja decir
que el éxito está por debajo del 43 %; con 15, por debajo del 20 %. Lo decimos así. Lo que no depende
de repeticiones es el análisis de rutas: da lo mismo cada vez para la misma configuración. Y son
ataques fijos: el instituto de estándares de EE. UU. muestra que con ataques adaptados el éxito
contra Claude 3.5 Sonnet subió de 11 % a 81 %, así que nuestros números son un piso, no un techo.»

Cálculo de las cotas: intervalo de Wilson al 95 % con 0 éxitos, cota superior = z²/(n + z²), con
z = 1,96: n = 5 → 43 %; n = 15 → 20 %.

Fuentes: [WASP](notas/evtimov-2025-wasp.md), [CAISI/NIST](notas/caisi-2025-agent-hijacking.md),
[AgentDojo](notas/debenedetti-2024-agentdojo.md) (reporta intervalos de confianza).
