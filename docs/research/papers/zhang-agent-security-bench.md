# Agent Security Bench (ASB): Formalizing and Benchmarking Attacks and Defenses in LLM-based Agents
- **Autores:** Hanrong Zhang, Jingyuan Huang, Kai Mei, Yifei Yao, Zhenting Wang, Chenlu Zhan, Hongwei Wang, Yongfeng Zhang (Zhejiang University y Rutgers University; p. 1) · **Año:** 2024 (arXiv 2410.02644; el PDF indica publicación en ICLR 2025, p. 1) · **Enlace:** https://arxiv.org/abs/2410.02644 · **Tema:** benchmark de ataques (inyección directa e indirecta, memory poisoning, backdoor en el plan, mixtos) y defensas contra agentes LLM con herramientas
- **Cobertura de lectura:** páginas 1–36, completo (cuerpo, referencias, apéndices A–F y declaraciones éticas y de reproducibilidad). No se usó el PDF original; el texto extraído fue legible en todas las tablas.

## Resumen
Los agentes LLM que usan herramientas, memoria y system prompt tienen varios puntos de entrada para un atacante, y los benchmarks previos (InjecAgent, AgentDojo) cubren solo inyección indirecta o pocos escenarios (p. 1–2). Los autores presentan ASB: 10 escenarios, 10 agentes, más de 400 herramientas, ataques de inyección directa (DPI), indirecta (IPI), memory poisoning, un backdoor nuevo llamado Plan-of-Thought (PoT) y ataques mixtos, además de 11 defensas y 7 métricas (p. 1, 8). Evalúan 13 backbones y encuentran que el ataque mixto es el más efectivo (ASR promedio 84.30%) y el memory poisoning el menos efectivo (7.92%) (p. 9). Las defensas de prompt probadas (delimiters, paraphrasing, instruction prevention, sandwich, dynamic prompt rewriting) casi no reducen el ASR y a veces bajan el rendimiento sin ataque (p. 10, 32). Los detectores basados en perplejidad y en LLM no distinguen bien el memory poisoning (FNR promedio 0.660; p. 34–35). Proponen la métrica NRP = PNA × (1 − ASR) para elegir backbones por equilibrio entre utilidad y seguridad (p. 10, 27). La conclusión del paper es que las defensas actuales son insuficientes y que hace falta trabajo futuro en defensas (p. 10).

## Método
- **Modelos:** 13 backbones: LLaMA3 8B y 70B, LLaMA3.1 8B y 70B, Gemma2 9B y 27B, Mixtral-8x7B, Qwen2 7B y 72B (abiertos); GPT-3.5 Turbo, GPT-4o, GPT-4o-mini y Claude-3.5 Sonnet (cerrados) (C.1 y Tabla 13, p. 25–26).
- **Agente:** ReAct sobre el repositorio AIOS, con planificación en JSON y memoria RAG en Chroma (LangChain) (A.2, C.2.2, p. 16 y 26).
- **Datos:** 10 escenarios (IT, inversiones, e-commerce, investigación, etc.), 10 agentes, 50 tareas de agente, 20 herramientas normales, 400 herramientas de ataque y 400 tareas de ataque (Tabla 3, p. 8). Las tareas se marcan como agresivas o no agresivas (B.2.3, p. 24–25).
- **Ataques:** 5 de inyección directa y 5 indirectas (naive, escape characters, context ignoring, fake completion, combined), memory poisoning (con DPI para envenenar la base), ataque mixto (DPI + IPI + memory poisoning) y PoT backdoor con el trigger "with perspicacious discernment" por defecto (Tabla 1, Sec. 4, C.2.2, p. 5–7, 26).
- **Defensas:** delimiters, dynamic prompt rewriting, sandwich prevention, instructional prevention, paraphrasing, shuffle (contra PoT), detección por perplejidad y detección por LLM (Tabla 2, A.4, p. 7, 19–22).
- **Métricas:** ASR (fracción de tareas de ataque en que el agente usa la herramienta atacante; Ec. 18, p. 26), RR (tasa de rechazo, juzgada por un LLM), PNA (éxito sin ataque), BP (éxito en tareas limpias con el backdoor presente), FNR, FPR y NRP = PNA × (1 − ASR) (Tabla 4, Ec. 20; p. 8, 27).
- **Modelo de amenaza:** el atacante conoce los detalles de sus herramientas y puede registrarlas en plataformas de terceros; no conoce el backbone y solo accede por API; puede insertar un system prompt malicioso (PoT); puede modificar el prompt del usuario (p. 4).
- **Simulación:** las herramientas son simuladas con salida predefinida, no APIs reales (C.2.1 y C.2.6, p. 25 y 29).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| ASR promedio, ataque mixto (DPI+IPI+memory poisoning), 13 backbones | 84.30% | 9 (Tabla 5; también Tabla 14, p. 30) |
| ASR promedio, DPI | 72.68% | 9 (Tabla 5) |
| ASR promedio, IPI | 27.55% | 9 (Tabla 5) |
| ASR promedio, memory poisoning | 7.92% | 9 (Tabla 5) |
| ASR promedio, PoT backdoor | 42.12% | 9 (Tabla 5) |
| ASR promedio de todos los ataques, 13 backbones | 46.91% | 9 (Tabla 5, fila Average) |
| ASR promedio con defensa Paraphrasing contra DPI (baseline sin defensa en la misma tabla: 78.38%) | 56.87% | 10 (Tabla 7) |
| ASR promedio con defensa Dynamic Prompt Rewriting contra DPI (mismo baseline) | 44.45% | 10 (Tabla 7) |
| ASR promedio con defensa Sandwich contra IPI (baseline sin defensa en la misma tabla: 27.98%) | 28.04% | 10 (Tabla 8) |
| Claude-3.5 Sonnet: PNA 100.00%, ASR 56.44%, NRP 43.56% (NRP más alto de la tabla) | 43.56% | 10 (Tabla 6) |
| FNR promedio de detección por LLM contra memory poisoning (FPR promedio 0.200) | 0.660 | 34 (texto); 35 (Tabla 21) |
| Tareas de ataque en ASB | 400 | 8 (Tabla 3) |

## Citas textuales
- "with the highest average attack success rate of 84.30%, but limited effectiveness shown in current defenses" (p. 1)
- "current prevention-based defenses are inadequate: they are ineffective at preventing attacks and often cause some utility losses in the primary tasks when there are no attacks" (p. 10)
- "this defense cannot fundamentally disrupt the underlying connection between the adversarial input and the tool's output" (p. 32)

## Limitaciones
Los autores no tienen una sección de limitaciones. Lo que reconocen en el texto:
- "In the future, we will focus on improving defenses and expanding attack scenarios." (p. 10)
- Las defensas de prompt "often cause some utility losses" y bajan el PNA; por ejemplo, la defensa con delimiters baja el PNA promedio de 29.46% a 22.52% (p. 10, 32–33).
- Las defensas de detección por perplejidad y por LLM tienen FNR y FPR altos; los autores lo atribuyen a que el atacante puede usar tareas más simples que las normales (p. 34).
- Para la defensa contra DPI/IPI, reconocen que una defensa más estricta podría retrasar al agente, algo crítico en tiempo real (p. 33).
- Las herramientas son simuladas, y eligen eso por estabilidad y reproducibilidad frente a APIs reales (p. 25).

Observación propia:
- El ASR mide si el agente invoca la herramienta atacante, no si ocurre un daño real. Con herramientas simuladas con salida predefinida (p. 25–26, 29), "éxito" significa una llamada, no un efecto en un sistema. Esto no se declara como limitación.
- Inconsistencias de cifras: el ataque mixto aparece con 84.30% (Tablas 5 y 14) y con 84.03% en el texto de D.1.2 (p. 30). El número de métodos también varía: "27 different types of attack/defense methods" (p. 1), 13 ataques y 11 defensas en la Tabla 3 (p. 8), y "16 different attacks" en B.3 (p. 24).
- Las líneas base de las Tablas 7 y 8 (78.38% y 27.98%) coinciden con el ataque Combined Attack de la Tabla 17 (p. 31), no con el promedio DPI de la Tabla 5 (72.68%). El paper no dice qué ataque usa cada tabla de defensas, así que las comparaciones entre Tablas 5 y 7 no son directas.
- El memory poisoning usa solo DPI para envenenar la base (C.2.2, p. 26) y se prueba con un agente único, no con traspaso de plan entre agentes. El paper menciona que "other agents using the same memory database" pueden leer el plan envenenado (p. 7), pero no lo prueba.
- El ejemplo de NRP en p. 27 escribe "80% × (1 − 0.30)% = 80% × 0.70% = 56%"; el cálculo correcto usa 0.70 sin el símbolo de porcentaje. Es un error de notación menor.
- Solo se evalúa un agente ReAct de un framework (AIOS). Los resultados pueden depender de ese diseño.

## Qué le sirve a MESH
1. **Respalda la premisa de que la defensa en el prompt no basta (el paper lo demuestra solo para defensas de prompt):** ninguna de las defensas de prompt probadas baja el ASR a un nivel útil (DPI con paraphrasing 56.87%; DPR 44.45%; IPI con sandwich 28.04% frente a 27.98% sin defensa; p. 10). Esto apoya que el approval_gate esté fuera del modelo, en el sandbox. Inferencia propia: ASB no prueba defensas estructurales como la de MESH; solo muestra que las defensas en el prompt no alcanzan.
2. **Cuidado con la etiqueta de procedencia si solo es texto para el modelo:** la defensa sandwich (recordatorio añadido a la respuesta de la herramienta) no cambió el ASR en IPI (28.04% frente a 27.98%; p. 10, 32). Inferencia propia: la etiqueta de MESH sirve porque la pone el sistema y la lee el gate o el humano, no porque el modelo la obedezca. Los 12/12 de advertencias entregadas a finanzas miden que la señal llega, no que el modelo actúe bien con ella.
3. **Métrica para copiar:** definir el ASR como fracción de tareas de ataque en que el agente llega a la herramienta de alto riesgo (Ec. 18, p. 26), y reportar PNA (controles legítimos completados) junto con el ASR en la misma tabla. NRP = PNA × (1 − ASR) (Ec. 20, p. 27) resume ambos en una cifra, pero MESH debe reportar PNA y ASR por separado porque el NRP oculta la composición.
4. **El límite de USD 500 tiene sustento indirecto:** ASB muestra que los agentes rechazan más las instrucciones agresivas (RR 8.31% frente a 4.87%) y que el ASR es mayor en las no agresivas (38.98% frente a 33.12%; p. 31–32). Inferencia propia: un fraude que se ve como un pago normal, por ejemplo bajo USD 500, tiene más probabilidad de pasar el rechazo del modelo; por eso el límite no debe depender de que el modelo lo detecte. ASB no mide montos ni rutas de correo.
5. **Ruta multiagente sin evidencia en ASB:** el paper solo evalúa un agente que usa herramientas, por lo que no prueba la cadena Camila → Mateo → Tomás ni la propagación de procedencia. Ahí MESH tiene aporte propio: el resultado 4/12 → 12/12 no tiene comparación directa en la literatura revisada en este paper, y conviene presentarlo como hallazgo propio y no como consistente con ASB.
6. **Frases para el pitch (con cita):** "with the highest average attack success rate of 84.30%, but limited effectiveness shown in current defenses" (p. 1). Úsela para justificar que la defensa tiene que ir más allá del prompt. Para la misma idea, "current prevention-based defenses are inadequate" (p. 10) y "this defense cannot fundamentally disrupt the underlying connection between the adversarial input and the tool's output" (p. 32), que apoyan la separación entre el modelo y el gate de MESH.
