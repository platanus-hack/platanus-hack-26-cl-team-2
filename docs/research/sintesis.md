# Síntesis de la literatura: seguridad de agentes de IA y MESH

Revisión de 40 fuentes ([lista](papers.md), una nota por paper en [papers/](papers/)). Convención: cada número de la literatura lleva (Autor año, p. N) y enlace a la nota. Lo que es nuestra lectura va marcado como **inferencia**. Los números de MESH salen de [pitch.md](../pitch.md), [approval-gate.md](../experiments/approval-gate.md) y [redteam-refunds.md](../experiments/redteam-refunds.md), tal cual y con su n: son conteos chicos, no tasas.

## 1. En una página

**1. Las defensas que viven dentro del modelo o del prompt se rompen cuando el atacante se adapta.** Con ataques adaptativos, 12 defensas recientes caen con tasas de éxito superiores a 90% en la mayoría de los casos (Nasr 2025, p. 1; [nota](papers/nasr-attacker-moves-second.md)). Spotlighting y sandwiching pasan de "tan bajo como 1%" con ataques estáticos a más de 95% con búsqueda adaptativa (Nasr 2025, pp. 5–6), y MetaSecAlign de 2% a 96% (p. 7). Con 8 defensas contra InjecAgent, los ataques adaptativos superan 50% (Zhan 2025, p. 1; [nota](papers/zhan-adaptive-attacks.md)). Ningún paper revisado ataca de forma adaptativa una compuerta determinista, así que tampoco la confirma.

**2. Un control determinista en la llamada a la herramienta baja el éxito del ataque a casi cero en benchmarks, con costos.** Progent: 39.9% a 1.0% en AgentDojo y 70.3% a 3.9% en ASB (Shi 2025, p. 2; [nota](papers/shi-progent.md)). FIDES con GPT-4o: 163 (156) inyecciones exitosas sin política contra 9 (0) con política en el planificador básico (Costa 2025, p. 15; [nota](papers/costa-fides-ifc.md)), pero con pérdida de utilidad de hasta 40% (p. 16). PFI agrega 90.56% de tokens en AgentDojo (Kim 2025, p. 13; [nota](papers/kim-prompt-flow-integrity.md)).

**3. Lo que esos controles no cubren es justo lo que MESH ve pasar.** Progent no defiende ataques que caben dentro del mínimo privilegio de la tarea (Shi 2025, p. 5). FIDES no frena ataques texto a texto (Costa 2025, p. 16). **Inferencia:** un reembolso pedido por un cliente es una acción permitida por la tarea; por eso los fraudes verosímiles bajo el umbral siguen pasando.

**4. En multiagente, el fallo está en la ruta y no en cada agente.** Los sub-agentes pueden rechazar la acción y el sistema completa el ataque igual (Triedman 2025, p. 1; [nota](papers/triedman-mas-malicious-code.md)); la inyección clásica casi no funciona ahí, pero el secuestro por metadatos logra 58–90% con GPT-4o (pp. 1–2). La estructura lineal es la más frágil: caída de 23.7% frente a 5.5% en la jerárquica (Huang 2024, p. 1; [nota](papers/huang-resilience-faulty-agents.md)). Etiquetar el agente de origen en el prompt, solo, baja el éxito apenas 5% (Lee 2024, p. 9; [nota](papers/lee-prompt-infection.md)).

**5. Ni el remitente ni el contenido distinguen el fraude.** Un clasificador de remitente solo tiene 11.7% de precisión; combinado con texto y enlaces llega a 98.2% (Cidon 2019, p. 13; [nota](papers/cidon-bec-guard.md)), en un dominio sin adversarios adaptativos. Una cuenta comprometida hereda la confianza del destinatario (Ho 2019, p. 1; [nota](papers/ho-lateral-phishing.md)).

**6. La aprobación humana es el eslabón menos medido.** "Tired or overloaded human verifiers" aprueban acciones inseguras (Beurer-Kellner 2025, p. 3; [nota](papers/beurer-kellner-design-patterns.md)); la aprobación puede volverse "meaningless rubber stamping" (Feng 2025, p. 8; [nota](papers/feng-levels-of-autonomy.md)); participantes de Magentic-UI la juzgaron excesiva (Mozannar 2025, p. 25; [nota](papers/mozannar-magentic-ui.md)). Ningún paper mide cuántos fraudes aprueba un humano real.

## 2. Mapa de ataques

| Familia | Qué es | Papers | Número representativo |
|---|---|---|---|
| Inyección indirecta | Instrucciones en datos que el agente lee (correo, web, reseñas) | [Greshake](papers/greshake-indirect-prompt-injection.md), [Liu](papers/liu-formalizing-prompt-injection.md), [BIPIA](papers/yi-bipia.md), [InjecAgent](papers/zhan-injecagent.md), [AgentDojo](papers/debenedetti-agentdojo.md) | GPT-4o con "Important message": 57.7% de acciones maliciosas ejecutadas (Debenedetti 2024, p. 20); en competencia, indirecta 27.1 frente a directa 5.7 de ASR (Zou 2025, p. 4) |
| Ataques a herramientas | Desviar a un agente con herramientas hacia una llamada no autorizada | [ASB](papers/zhang-agent-security-bench.md), [WASP](papers/evtimov-wasp.md), [ToolEmu](papers/ruan-toolemu.md), [Zou](papers/zou-agent-red-teaming-competition.md) | ASB, ataque mixto: 84.30% de ASR promedio en 13 modelos (Zhang 2024, p. 9). WASP: desviar es fácil (0.429 con GPT-4o) y completar el objetivo es raro (hasta 16%) (Evtimov 2025, pp. 6–7) |
| Propagación multiagente | Un mensaje o contenido contagia o secuestra a otros agentes | [Prompt Infection](papers/lee-prompt-infection.md), [Cohen](papers/cohen-ai-worm.md), [Triedman](papers/triedman-mas-malicious-code.md), [He](papers/he-agent-in-the-middle.md), [Huang](papers/huang-resilience-faulty-agents.md) | Carga del gusano con más de 90% de éxito hasta el salto 11 (Cohen 2024, p. 8); en cadena, AiTM llega a 95.2 y 98.5 de ASR (He 2025, p. 6) |
| MCP y tool poisoning | Instrucciones en descripciones de herramientas o recursos externos | [Hou](papers/hou-mcp-landscape.md), [Radosevich](papers/radosevich-mcp-safety-audit.md), [MCPTox](papers/wang-mcptox.md), [Song](papers/song-mcp-attack-vectors.md) | MCPTox: 72.8% de ASR en o1-mini y rechazo máximo menor a 3% (Wang 2025, p. 1); recursos externos maliciosos 93.33% (Song 2025, p. 10) |
| BEC y phishing | Fraude por correo hacia personas o, por extensión, hacia agentes | [Ho](papers/ho-lateral-phishing.md), [Heiding](papers/heiding-automated-spear-phishing.md), [FBI IC3](papers/fbi-ic3-2024-report.md), [Cidon](papers/cidon-bec-guard.md) | BEC 2024: 21,442 denuncias (p. 9) y US$2,770,151,146 de pérdidas (p. 10) (FBI IC3 2025). Spear phishing con IA: 54% de clics frente a 12% del control (Heiding 2024, p. 8) |
| Ataques adaptativos | El atacante optimiza contra la defensa concreta | [Zhan](papers/zhan-adaptive-attacks.md), [Nasr](papers/nasr-attacker-moves-second.md), [LLMail-Inject](papers/abdelnabi-llmail-inject.md) | 839 participantes y 461,640 intentos (Abdelnabi 2025, p. 2); replay sin optimizar: 58.0 de ASR en GPT-4o y 32.0 en Meta SecAlign 70B (p. 9) |

## 3. Mapa de defensas

| Familia | Qué garantiza | Costo en utilidad | Qué la rompe |
|---|---|---|---|
| Detección y clasificadores ([Liu](papers/liu-formalizing-prompt-injection.md), [MELON](papers/zhu-melon.md), [LLMail](papers/abdelnabi-llmail-inject.md), [Cohen](papers/cohen-ai-worm.md)) | Nada formal; probabilística | Detector de AgentDojo: utilidad 69.0% a 41.49% (Debenedetti 2024, p. 20). MELON: 69.08% a 58.78% y 9.28% de falsos positivos (Zhu 2025, pp. 8–9). Todas las defensas de LLMail juntas: 10.0% de FP en Enron (Abdelnabi 2025, p. 14) | Búsqueda adaptativa: más de 90% en detectores (Nasr 2025, p. 7). Detector de Zhan: detección de 61 a 1 (p. 6). Fuera de distribución, el FPR de Virtual Donkey sube a 0.990 (Cohen 2024, p. 17) |
| Delimitado y spotlighting ([Hines](papers/hines-spotlighting.md)) | Ninguna; marca dentro del canal de texto | Sin daño observado en benchmarks de NLP (Hines 2024, p. 5); sandwich baja la utilidad de 0.38 a 0.24 en resumen (Liu 2023, p. 10) | Si el atacante conoce el delimitador lo copia (Hines 2024, p. 4); adaptativo: más de 95% (Nasr 2025, p. 6) |
| Entrenamiento ([StruQ](papers/chen-struq.md), BIPIA white-box) | Ninguna en el peor caso ("not completely secure", Chen 2024, p. 14) | StruQ: 67.2% a 67.6% en Llama (p. 10). BIPIA white-box: MT-Bench de 5.2062 a 1.6625 en Vicuna-13B (Yi 2023, p. 8) | GCG: 97% a 58% con StruQ (Chen 2024, p. 10); MetaSecAlign 2% a 96% con búsqueda (Nasr 2025, p. 7) |
| Aislamiento ([IsolateGPT](papers/wu-isolategpt.md), Magentic-UI) | Separa apps o agentes; el flujo entre ellos pasa por el consentimiento del usuario | Menos de 30% de latencia en 75.73% de consultas (Wu 2024, p. 14) | Ataques dentro de una misma app (fuera de alcance, p. 5); el éxito depende de que el usuario conceda el flujo malicioso (p. 10) |
| Flujo de información y procedencia ([CaMeL](papers/debenedetti-camel.md), [FIDES](papers/costa-fides-ifc.md), [f-secure](papers/wu-system-level-ifc.md), [PFI](papers/kim-prompt-flow-integrity.md)) | Sobre acciones con herramientas, fuerte en el papel; en CaMeL la verificación formal queda pendiente (p. 25) | CaMeL: 86.6% a 74.2% en Claude 4 Sonnet (Debenedetti 2025, p. 33). FIDES: hasta 40% (Costa 2025, p. 16). PFI: SUR 61.86% frente a 12.37% del baseline (Kim 2025, p. 12) | Ataques texto a texto (Costa 2025, p. 16); canales laterales (Debenedetti 2025, pp. 19–21); sin evaluación adaptativa de CaMeL (p. 17); etiquetas de integridad definidas a mano (Costa 2025, p. 14) |
| Políticas y privilegios ([Progent](papers/shi-progent.md), [AgentSpec](papers/wang-agentspec.md), [Conseca](papers/tsai-conseca.md)) | Determinista por llamada | AgentSpec: tareas seguras 58.62% a 54.26% (Wang 2025, p. 8). Conseca: 12.0/20 frente a 14.0/20 sin política (Tsai 2025, p. 5) | Acciones dentro del privilegio (Shi 2025, p. 5); revisan acciones sueltas, no trayectorias (Tsai 2025, p. 6; Wang 2025, p. 11); AgentSpec se evaluó sin adversario (p. 7) |
| Aprobación humana (PFI, Progent, [Magentic-UI](papers/mozannar-magentic-ui.md)) | Solo si el humano revisa de verdad | PFI: 1.49 alertas por tarea frente a 4.11 si se alerta en todo (Kim 2025, p. 13) | Fatiga y aprobación mecánica (Beurer-Kellner 2025, p. 3; Feng 2025, p. 8) |
| Monitoreo ([Greenblatt](papers/greenblatt-ai-control.md), Huang) | Probabilístico; depende de un revisor más débil o igual | Edición confiable: seguridad 92%, utilidad 94% (Greenblatt 2023, p. 15) | Un monitor que colude (p. 14); un revisor LLM puede ser engañado por un comentario (Huang 2024, pp. 7–8) |

## 4. Dónde se ubica MESH

**Las tres piezas.** (a) Aprobación por procedencia: el sandbox retiene reembolsos sobre USD 500 y todo cambio bancario cuando el trabajo viene de un correo externo. (b) Etiqueta de procedencia: el sistema, no el modelo, agrega el origen a cada mensaje entre agentes. (c) Rutas de riesgo: enumeración sin IA de caminos correo, agentes, herramienta financiera, con visibilidad del origen en cada salto.

**Lo que es igual a lo ya publicado.** El principio de (a) y (b), una etiqueta que pone el sistema y una política determinista que la mira antes de la herramienta, es el de CaMeL (capacidades con procedencia y políticas antes de cada llamada; Debenedetti 2025, p. 9), FIDES (la etiqueta de la conversación es la unión de las de sus mensajes y P-T bloquea llamadas consecuentes si hay datos no confiables; Costa 2025, pp. 7–8) y PFI (atributos de origen y alertas de aprobación; Kim 2025, p. 9). CaMeL dice que en una aplicación real las violaciones "will not be blocked, but they will require user confirmation" (p. 11), que es la retención de MESH. AgentSpec ya tiene `user_inspection` como enforcement externo al LLM (Wang 2025, p. 10). IsolateGPT exige consentimiento para acciones irreversibles (Wu 2024, p. 7). Los patrones de diseño recomiendan lo mismo en abstracto (Beurer-Kellner 2025, p. 4).

**Lo que es más simple o más débil.**
- La etiqueta viaja por mensaje, no por valor. CaMeL y FIDES propagan etiquetas por dato dentro de un intérprete o planificador; MESH las pega a los mensajes del harness. **Inferencia:** si un agente reescribe el contenido, el origen del dato fino se pierde, aunque la etiqueta del mensaje se conserve.
- El umbral de USD 500 es una decisión nuestra. Ni CaMeL (políticas binarias por origen y lectores; Debenedetti 2025, pp. 9, 36) ni PFI (Kim 2025, pp. 8–9) ni FIDES usan montos. **Inferencia:** sin umbral, esas políticas también habrían detenido los fraudes bajo USD 500 que en MESH siguen pasando.
- El gate es una regla en el mismo proceso (límite que declara [pitch.md](../pitch.md)), no un monitor de referencia separado como el proxy de Progent (Shi 2025, p. 11).
- La etiqueta informa; no decide. Eso lo dice el propio pitch, y la literatura lo respalda: una etiqueta en el prompt, sola, es débil (Lee 2024, p. 9).
- No hay ataque adaptativo contra el gate ni medición del aprobador humano. Los trabajos más cercanos tampoco los tienen (Shi 2025, p. 15 prueba tres ataques adaptativos; Kim 2025, p. 14 reconoce que el usuario puede aprobar a ciegas por comodidad).
- Progent sí puede escribir `<` sobre argumentos (Shi 2025, p. 5): el umbral es expresable en lenguajes de reglas ya existentes, no es una novedad técnica.

**Lo que es distinto (o al menos no encontrado en las 40 fuentes).**
1. **Rutas de riesgo calculadas antes de correr.** Conseca admite que revisa acciones aisladas y no trayectorias (Tsai 2025, p. 6); AgentSpec dice que no hace análisis de trayectorias (Wang 2025, p. 11); Triedman modela el sistema como grafo dirigido (Triedman 2025, p. 19) pero no da un algoritmo. **Inferencia:** el análisis determinista de "dónde se pierde la advertencia" es la pieza más propia de MESH.
2. **Dominio y objetivo.** Fraude BEC y de reembolsos contra agentes Claude reales en un equipo con personas. AgentDojo tiene banca, pero la inyección entra por la salida de una herramienta, no por un correo (Debenedetti 2024, nota, observación propia). **Inferencia** sobre una muestra de 40.
3. **Medir si la advertencia llega a quien decide** (4/12, 7/12, 12/12). No encontramos esa métrica en las notas; los benchmarks miden si la acción se ejecuta.
4. **Resultado negativo medible:** una verificación de remitente sin efecto (ver sección 5).

## 5. Nuestros resultados frente a la literatura

| Resultado de MESH | Qué dice la literatura | Veredicto | Fuente |
|---|---|---|---|
| Fraudes de reembolso emitidos, 7 ataques, 21 ejecuciones por celda: Haiku 4.5 17/21 a 6/21 con `approval_gate`; Sonnet 4.6 8/21 a 3/21. Ningún reembolso mayor a USD 500 ejecutado con la defensa | Controles en la herramienta bajan el éxito a casi cero: 39.9% a 1.0% (Shi 2025, p. 2); 163 (156) a 9 (0) (Costa 2025, p. 15); ATR 0.00% (Kim 2025, p. 12) | Coincide en dirección. No comparable en magnitud: MESH deja residuo por el umbral y ninguno de esos trabajos es adaptativo | [approval-gate.md](../experiments/approval-gate.md); [Progent](papers/shi-progent.md), [FIDES](papers/costa-fides-ifc.md), [PFI](papers/kim-prompt-flow-integrity.md) |
| Lo que sigue pasando con la defensa son fraudes bajo USD 500 (rf_01, USD 289; en Haiku también rf_05) | Progent no cubre ataques dentro del mínimo privilegio (Shi 2025, p. 5); el filtro de herramientas falla en 17% de los casos porque las herramientas de la tarea bastan (Debenedetti 2024, p. 9) | Coincide (cualitativo) | [approval-gate.md](../experiments/approval-gate.md); [AgentDojo](papers/debenedetti-agentdojo.md) |
| Reembolsos legítimos (2 controles de monto chico): 12/12 emitidos con y sin defensa | Las defensas tienen costo de utilidad: hasta 40% (Costa 2025, p. 16); 69.08% a 58.78% (Zhu 2025, p. 8); 58.62% a 54.26% (Wang 2025, p. 8) | Sin comparación válida. **Inferencia:** los controles son de monto chico y no ejercitan la regla; n = 12 | [approval-gate.md](../experiments/approval-gate.md); [FIDES](papers/costa-fides-ifc.md), [MELON](papers/zhu-melon.md), [AgentSpec](papers/wang-agentspec.md) |
| `sender_check` no cambia el daño: Haiku 8/12 a 8/12; Sonnet 2/12 a 2/12 (6 ataques de `redteam_injection`, 2 repeticiones). Marca 2 de 6 correos de `bec_realistic.json` | El remitente solo tiene 11.7% de precisión (Cidon 2019, p. 13); una cuenta legítima comprometida hereda la confianza (Ho 2019, p. 1) | Coincide de forma indirecta; ningún paper prueba un chequeo de remitente sobre un agente LLM | [pitch.md](../pitch.md); [BEC-Guard](papers/cidon-bec-guard.md), [Ho](papers/ho-lateral-phishing.md) |
| Haiku 4.5 cae más que Sonnet 4.6: 16/24 frente a 4/24 (MCP, 6 ataques); 17/21 frente a 8/21 en reembolsos | Más capacidad, más vulnerabilidad: correlación de Pearson 0.63 con el tamaño (Liu 2023, p. 9) y 0.6423 con Elo (Yi 2023, p. 4) | Contradice en apariencia. Modelos de 2023 y tareas de texto; n chico; Anthropic no publica tamaños (**inferencia**) | [pitch.md](../pitch.md); [Liu](papers/liu-formalizing-prompt-injection.md), [BIPIA](papers/yi-bipia.md) |
| Los ataques que funcionan piden lo que un caso legítimo pediría; con señales sociales fuertes (chargeback, VIP, reembolso más reenvío) se escaló 16/16 (Sonnet) | Los ataques "task-relevant" tienen ASR más alta (Yi 2023, p. 5); los agentes rechazan más lo agresivo: ASR 38.98 en no agresivas frente a 33.12 (Zhang 2024, pp. 31–32); los ataques "succeed rarely" si el objetivo es anormalmente sensible (Debenedetti 2024, p. 2) | Coincide | [redteam-refunds.md](../experiments/redteam-refunds.md); [BIPIA](papers/yi-bipia.md), [ASB](papers/zhang-agent-security-bench.md) |
| Cambio bancario intentado sin defensa: Haiku 10/15, Sonnet 0/15; con `approval_gate`, Haiku 9/15 (siempre bloqueado) | Los modelos casi no rechazan: menos de 3% (Wang 2025, p. 1), RR 4.67% (Song 2025, p. 10) | Haiku coincide. Sonnet 4.6 contradice, pero es otro ataque (envenenamiento de herramientas) y otro modelo | [approval-gate.md](../experiments/approval-gate.md); [MCPTox](papers/wang-mcptox.md), [Song](papers/song-mcp-attack-vectors.md) |
| Lote multiagente (3 agentes, Haiku 4.5, 48 ejecuciones, daño 0/48): la advertencia llegó a finanzas 4/12 sin defensa, 7/12 con verificación, 12/12 con etiqueta | LLM Tagging solo baja el éxito 5% (Lee 2024, p. 9) pero mide bloqueo, no entrega; los sub-agentes rechazan y el sistema igual falla (Triedman 2025, p. 1) | Sin comparación directa. El 12/12 es por construcción (lo reconoce el pitch) y no implica que finanzas decida bien | [approval-gate.md](../experiments/approval-gate.md); [Prompt Infection](papers/lee-prompt-infection.md), [Triedman](papers/triedman-mas-malicious-code.md) |
| El resultado sale de la traza con reglas, sin IA | AgentDojo usa funciones deterministas sobre el estado y no un LLM juez porque este también podría ser engañado (Debenedetti 2024, p. 4); los jueces LLM son poco fiables (Nasr 2025, pp. 9–10) | Coincide con la práctica recomendada | [pitch.md](../pitch.md); [AgentDojo](papers/debenedetti-agentdojo.md), [Nasr](papers/nasr-attacker-moves-second.md) |
| Rutas de la demo: 2 rutas, 2 de severidad alta; con verificación más etiqueta, 0 altas | Nadie calcula rutas antes de ejecutar (ver sección 4) | Sin comparación | [pitch.md](../pitch.md) |

**Advertencia de n.** Nasr 2025 (pp. 9, 24) y Greenblatt 2023 (p. 6, 1500 problemas) muestran que las evaluaciones chicas engañan; MESH tiene 21, 12 y 6 casos por celda. Los números de arriba son indicativos.

## 6. Diez ideas ordenadas por impacto

Costos de modelo: los lotes de MESH han costado del orden de US$1 por 3 corridas de Sonnet ([redteam-refunds.md](../experiments/redteam-refunds.md)); presupuesto total US$50.

| # | Qué hacer | Por qué (paper) | Esfuerzo | Demo | Antes del pitch |
|---|---|---|---|---|---|
| 1 | Barrer el umbral (0, 100, 250, 500) con controles legítimos grandes y reportar utilidad bajo ataque. `APPROVAL_REFUND_LIMIT` ya es una variable de entorno | FIDES y PFI bloquean sin umbral (Costa 2025, p. 8; Kim 2025, pp. 8–9); AgentDojo reporta utilidad con y sin ataque (Debenedetti 2024, p. 6) | 2–3 h más unos US$ de API | Curva "fraudes que pasan frente a legítimos retenidos" | Sí |
| 2 | Atacante que conoce la regla: montos justo bajo el umbral y reembolsos fraccionados (3 de USD 480) | Un ataque "backdoor rarely" derrota una auditoría de presupuesto fijo (Greenblatt 2023, p. 8); el atacante adaptativo rompe lo evaluado en estático (Nasr 2025, p. 25) | Mínimo 3 h; completo 1 día | "Rompemos nuestro propio gate" | Versión mínima |
| 3 | Regla acumulada por cliente, beneficiario y ventana de tiempo | ToolEmu ve transferencias fragmentadas (Ruan 2023, p. 35); el umbral por operación se fragmenta (**inferencia**) | 3–5 h, sin IA | Antes y después del ataque fraccionado de la idea 2 | Si la 2 lo justifica |
| 4 | Medir al aprobador: 5 personas del equipo revisan 10 casos retenidos (fraude y legítimo), con y sin etiqueta | Fatiga y aprobación mecánica (Beurer-Kellner 2025, p. 3; Feng 2025, p. 8; Mozannar 2025, p. 25); nadie lo mide | Medio día | "Cuántos fraudes aprueba un humano" | Solo si hay gente libre |
| 5 | Atacar la etiqueta: correo que escribe "[ORIGEN: interno]", agente que la resume y la pierde | Los marcadores dentro del canal se copian (Hines 2024, p. 4); el tagging por prompt es débil (Lee 2024, p. 9); **inferencia:** la etiqueta debe ser campo estructurado | 3–4 h | Correo falsificado, etiqueta intacta | Sí |
| 6 | Intervalos de Wilson en todas las tablas y 10 repeticiones en las celdas clave | Las evaluaciones chicas engañan (Nasr 2025, p. 9) | Intervalos: 30 min, sin costo; repeticiones: 2 h más API | Barras de error en el deck | Intervalos sí; repeticiones parcial |
| 7 | Validar las rutas predichas contra las trazas: cuántas rutas de severidad alta se recorrieron y cuántas terminaron en daño | AgentSpec reconoce que no analiza trayectorias (Wang 2025, p. 11); Triedman define el ataque como sufijo de la traza (Triedman 2025, p. 19) | 2–3 h sobre datos ya existentes, sin API | Panel "predicha frente a observada" | Sí |
| 8 | Éxito por longitud de ruta y topología (cadena, árbol, hub) con 5 a 8 agentes | Cadena más vulnerable (He 2025, p. 6; Huang 2024, p. 1); métrica de saltos propuesta en la nota de [Lee](papers/lee-prompt-infection.md) | 1 día más API | Gráfico de daño por saltos | No |
| 9 | Regla por valor: destino del reembolso distinto del método de pago original, o cuenta distinta de la registrada, se retiene sin importar el monto | Política de CaMeL para `send_money` por origen del destinatario (Debenedetti 2025, p. 36); MELON compara destinatario y monto (Zhu 2025, p. 14) | 0.5–1 día | Fraude bajo USD 500 retenido | No |
| 10 | Mover el gate a un proxy MCP separado y leer SPF/DKIM/DMARC en vez de solo `From:` | Modo proxy de Progent (Shi 2025, p. 11); límites del propio README | 1–2 días | "El agente no puede saltarse la regla" | No |

## 7. Ocho frases para el pitch

Cada cita se comprobó con búsqueda en el texto del PDF (página del PDF indicada).

1. **Español:** "El fraude por correo no es una hipótesis: en 2024 el FBI recibió 21.442 denuncias de BEC y US$2.770.151.146 en pérdidas reportadas."
   **Respaldo:** BEC, 21,442 denuncias (p. 9) y $2,770,151,146 (p. 10). Son denuncias autorreportadas, no agentes de IA.
   **Fuente:** FBI IC3, 2025, https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf · [nota](papers/fbi-ic3-2024-report.md).

2. **Español:** "El texto del correo no te dice si es fraude: lo que lo separa de uno legítimo es la intención de quien lo manda, por eso decidimos por origen y no por contenido."
   **Respaldo:** "the only difference between a high-quality phishing email and a legitimate one is the sender's intentions." (p. 7). El paper no prueba nuestra defensa.
   **Fuente:** Heiding et al., 2024, https://arxiv.org/abs/2412.00586 · [nota](papers/heiding-automated-spear-phishing.md).

3. **Español:** "Cada agente puede rechazar la acción y el sistema completar el ataque igual: por eso miramos la ruta, no el componente."
   **Respaldo:** "these attacks succeed even if individual agents are not susceptible to direct or indirect prompt injection, and even if they refuse to perform harmful actions." (p. 1). Corresponde a sistemas con ejecución de código, no a finanzas.
   **Fuente:** Triedman, Jha, Shmatikov, 2025, https://arxiv.org/abs/2503.12188 · [nota](papers/triedman-mas-malicious-code.md).

4. **Español:** "En la mayor competencia pública de red teaming de agentes, casi todos violaron su política con 10 a 100 intentos."
   **Respaldo:** "Nearly all agents exhibit policy violations for most behaviors within 10–100 queries, with high attack transferability across models and tasks." (p. 1). Escenarios simulados.
   **Fuente:** Zou et al., 2025, https://arxiv.org/abs/2507.20526 · [nota](papers/zou-agent-red-teaming-competition.md).

5. **Español:** "Las defensas que dicen tener casi cero ataques en benchmarks públicos suelen ser de las más fáciles de romper; por eso no confiamos en un detector y ponemos la compuerta fuera del modelo."
   **Respaldo:** "defenses that merely report near-zero attack success rates on public benchmarks are often among the easiest to break once novel attacks are attempted." (p. 9). Nasr no evalúa compuertas deterministas; la segunda mitad de la frase es nuestra postura.
   **Fuente:** Nasr, Carlini, Sitawarin et al., 2025, https://arxiv.org/abs/2510.09023 · [nota](papers/nasr-attacker-moves-second.md).

6. **Español:** "Un control determinista sobre la llamada a la herramienta bajó las inyecciones exitosas de 163 a 9 (y de 156 a 0 al excluir 2 tareas); no frena los ataques de texto a texto, y por eso protegemos la herramienta de pago."
   **Respaldo:** gpt-4o, planificador básico, sin política 163 (156), con política 9 (0), FIDES con política 1 (0) (p. 15); "Since we only enforce policies upon tool calls, our planners do not stop these text-to-text attacks." (p. 16). Solo AgentDojo y un tipo de ataque.
   **Fuente:** Costa et al., 2025, https://arxiv.org/abs/2505.23643 · [nota](papers/costa-fides-ifc.md).

7. **Español:** "Hoy los agentes fallan al completar el ataque, pero los propios autores dicen que esa protección por incompetencia no va a durar."
   **Respaldo:** "current web-navigation agents exhibit a form of security by incompetence" (p. 3) y "the current limitations in agents' ability to fully execute attacks are unlikely to persist." (p. 3).
   **Fuente:** Evtimov et al., 2025, https://arxiv.org/abs/2504.18575 · [nota](papers/evtimov-wasp.md).

8. **Español:** "Poner el nombre del origen en el mensaje no alcanza por sí solo: la etiqueta informa, la compuerta decide."
   **Respaldo:** "none of the tested defense strategies, including LLM Tagging, prove particularly effective when used in isolation. LLM Tagging alone reduces the attack success rate by only 5%" (p. 9). Su tag es un prefijo en el prompt; la de MESH la pone el sistema (diferencia nuestra).
   **Fuente:** Lee y Tiwari, 2024, https://arxiv.org/abs/2410.07283 · [nota](papers/lee-prompt-infection.md).

## 8. Límites de esta revisión

- Son 40 fuentes elegidas a mano, no una revisión sistemática. "No lo encontramos en las 40" no significa que no exista.
- La lectura la hicieron agentes sobre el texto extraído del PDF; un segundo agente verificó cada nota. Las figuras se leyeron solo por leyenda y texto circundante en casi todas las notas.
- CaMeL se leyó sin los apéndices de trazas (pp. 42–123) ni las referencias (Debenedetti 2025, nota, cobertura de lectura). StruQ: la verificación no volvió a leer los apéndices.
- Varias notas señalan inconsistencias internas de los propios papers (por ejemplo, 300 frente a 163 en CaMeL, p. 14 y p. 34; 23.6 frente a 23.51 en FIDES, p. 16). Aquí usamos tablas antes que texto y evitamos las cifras dudosas.
- Casi todos los modelos evaluados son de 2023–2025 (GPT-4o, Claude 3.5, Llama 3); los de MESH son Haiku 4.5 y Sonnet 4.6. Las magnitudes no se trasladan.
- Casi todos los benchmarks son simulados, miden la llamada a la herramienta y no el daño real, y no son adaptativos contra compuertas deterministas.
- Los resultados de MESH son conteos con n de 6 a 48 ejecuciones por celda, un solo prompt neutral y datos crudos que no están versionados. Las comparaciones de la sección 5 son cualitativas.
- Las ideas de la sección 6 y las marcas de **inferencia** son lectura nuestra, no afirmaciones de los papers.
