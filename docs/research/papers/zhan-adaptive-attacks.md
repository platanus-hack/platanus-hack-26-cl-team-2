# Adaptive Attacks Break Defenses Against Indirect Prompt Injection Attacks on LLM Agents
- **Autores:** Qiusi Zhan, Richard Fang, Henil Shalin Panchal, Daniel Kang · **Año:** 2025 · **Enlace:** https://arxiv.org/abs/2503.00061 · **Tema:** inyección indirecta de prompts (IPI) y ataques adaptativos contra defensas en agentes LLM
- **Cobertura de lectura:** páginas 1–17, completo (texto extraído, incluidas referencias y apéndices A–C). La Tabla 4 (p. 8) se verificó en el PDF porque la fila "Total" salía desordenada en el texto. Las Figuras 2–5 se leyeron solo por su caption y el texto que las comenta; no extraje los valores de las barras.

## Resumen
Los agentes LLM usan herramientas externas (correo, reseñas, APIs), y eso abre la puerta a la inyección indirecta de prompts (IPI): instrucciones maliciosas escondidas en contenido que el agente lee (p. 1). Hay defensas propuestas contra IPI, pero su robustez no se había probado frente a ataques adaptativos, es decir, diseñados después de conocer la defensa (pp. 1–2). Los autores implementan ocho defensas en tres familias: detección (detector fine-tuned, detector LLM, filtrado de perplejidad), cambios en el prompt (instrucciones, delimitadores, sandwich, parafraseo) y cambios en el modelo (fine-tuning adversarial) (pp. 2–3). Para cada una diseñan un ataque adaptativo basado en GCG y AutoDAN, con una variante multiobjetivo que además evita al detector y una variante en dos etapas contra el parafraseo (pp. 3–4). Sobre el benchmark InjecAgent, los ataques adaptativos superan 50% de ASR contra las defensas evaluadas en ambos agentes (pp. 1–2). El ataque solo se optimiza para la primera acción del agente, y su efecto en la segunda etapa del robo de datos es mínimo (pp. 8, 10). La conclusión es que estas defensas no dan la robustez que aparentan y que las defensas de IPI deben evaluarse con ataques adaptativos (p. 9).

## Método
- **Agentes:** Vicuna-7B con prompt ReAct ("prompted agent") y Llama3-8B fine-tuned para llamadas a funciones ("finetuned agent") (p. 4). El detector LLM usa el mismo modelo que el agente (pp. 5–6).
- **Dataset:** InjecAgent, 1.054 casos de prueba: daño directo y robo de datos (p. 4). Para el estudio se tomó un subconjunto de 100 casos: 25 ataques de daño directo, 27 de robo de datos y 16 escenarios de usuario (p. 4). Validación extra en AgentDojo: 16 casos, solo con Llama3-8B (p. 14).
- **Defensas (Tabla 1, p. 2):** detector fine-tuned (DeBERTaV3), detector LLM, filtrado de perplejidad, instrucciones de prevención, aislamiento de datos con delimitadores, sandwich, parafraseo y fine-tuning adversarial (LoRA, r=32, sobre 215 casos fallidos en Vicuna y 816 en Llama3) (pp. 2–3, 14).
- **Ataques adaptativos:** GCG adaptado a IPI, que optimiza un sufijo o prefijo S para que el agente invoque la herramienta atacante (p. 3). M-GCG añade un objetivo de sigilo que hace que el detector clasifique la respuesta como benigna, con α = 0,5 (pp. 3–4, 14). AutoDAN contra el filtrado de perplejidad (p. 4). T-GCG, en dos etapas, contra el parafraseo (p. 4). Objetivos de entrenamiento: "Thought: I will use the <Ta> tool to" para ReAct y `{"name": "<Ta>"` para Llama3 (p. 4).
- **Modelo de amenaza:** el atacante solo puede modificar el contenido externo, pero tiene acceso white-box al agente, a los modelos de defensa y a los prompts (p. 3; p. 10).
- **Métricas:** ASR-defense y ASR-adaptive. ASR-all es la métrica por defecto y no cuenta las salidas inválidas. También se usan target rate (salidas que empiezan con el target) y valid rate (pp. 5–7). El robo de datos tiene dos pasos; el segundo lo simula gpt-4-0613 (p. 5).
- **Cómputo:** unos 30 minutos por adversarial string en una A100 (p. 14).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Defensas evaluadas | 8 | p. 1 |
| Casos de prueba del benchmark InjecAgent | 1,054 | p. 4 |
| Casos del subconjunto evaluado | 100 | p. 4 |
| ASR original sin defensa, Vicuna-7B (texto) | 56% | p. 6 |
| ASR original sin defensa, Llama3-8B (texto) | 9% | p. 6 |
| ASR-defense con fine-tuning adversarial, Vicuna-7B (texto) | 12% | p. 6 |
| Tabla 2, tasa de detección del detector fine-tuned, ataques originales, Vicuna-7B (DR-o; DR-a tras el ataque adaptativo) | 61 (%); 1 (%) | p. 6 |
| Tabla 3, filtrado de perplejidad, Vicuna-7B (ASR-o → ASR-a; sin unidad en la tabla) | 24 → 76 | p. 7 |
| Tabla 3, parafraseo, Llama3-8B (ASR-o → ASR-a; sin unidad en la tabla) | 8 → 54 | p. 7 |
| Tabla 4, daño directo, Vicuna-7B, ASR-attack | 0.90 ± 0.06 | p. 8 |
| Tabla 6, AgentDojo, detector LLM con M-GCG, ASR-adaptive (sin unidad en la tabla) | 31.25 | p. 15 |
| Longitud media de contexto, AgentDojo vs. InjecAgent | 3,823 vs. 1,033 tokens | p. 14 |

## Citas textuales
- "Despite defenses designed for IPI attacks, their robustness remains questionable due to insufficient testing against adaptive attacks." (p. 1)
- "In the context of IPI attacks, the attacker can only manipulate the content of external sources, such as reviews or emails" (p. 1)
- "Our results demonstrate that the adaptive attacks successfully break all of these defenses." (p. 9)

## Limitaciones
Reconocidas por los autores:
- Los ataques adaptativos solo se optimizan para la primera acción del agente. La mejora es mínima en el segundo paso del robo de datos, y el análisis de ese límite queda para trabajo futuro (p. 10; ver también p. 8).
- El acceso es white-box al agente, a los modelos de defensa y a los prompts. Los ataques black-box y grey-box no se evaluaron (p. 10).
- Las defensas se atacan por separado; no se evalúa ninguna combinación de defensas (p. 10).
- El estudio no es exhaustivo: no cubre autoevaluación con LLM, otros métodos de fine-tuning ni otras defensas (p. 10).
- No se mide el impacto de las defensas en casos normales (p. 6).
- En AgentDojo los ataques son menos efectivos que en InjecAgent. Los autores lo atribuyen a contextos más largos y piden más investigación en contextos largos (pp. 14–15).

Observación propia:
- Muestra chica: 100 casos en el subconjunto principal y 16 en AgentDojo. Solo Tabla 4 trae dispersión (±); el resto de las tablas no tiene intervalos.
- Denominadores distintos sin explicar: el texto da 56% y 9% de ASR original (p. 6), mientras la fila "Total" de la Tabla 4 da 0.50 y 0.40 (p. 8). El paper no aclara la diferencia, y no la resolví.
- El detector LLM comparte pesos con el agente (pp. 5–6). No es un detector independiente, así que sus números no son comparables con el detector fine-tuned.
- El robo de datos depende de que gpt-4-0613 simule la respuesta de la herramienta (p. 5). Ese paso no es independiente del modelo evaluado.
- Las figuras con los valores por defensa (Figuras 2–5) no las extraje, así que las comparaciones entre defensas se apoyan en las tablas.

## Qué le sirve a MESH
1. **Lo que el paper demuestra:** las defensas basadas en el prompt (instrucciones, delimitadores, sandwich) y los detectores quedan rotos con ataques adaptativos (pp. 5–9). Inferencia de la nota (el paper no evalúa etiquetas de procedencia): esto sugiere tratar la etiqueta de procedencia como una defensa que no alcanza sola si vive solo como texto dentro del prompt.
2. **Inferencia (no probada por el paper):** la etiqueta de procedencia de MESH tiene que viajar como metadato que pone el sistema, no como texto que el modelo pueda imitar o ignorar. Si la etiqueta se pierde o se reescribe entre agentes, la defensa de procedencia pierde valor. Conviene probar esto en MESH.
3. **Aprobación por procedencia en el sandbox:** el paper ataca la salida del modelo hacia la llamada a la herramienta. La compuerta de MESH actúa después de esa llamada, fuera del modelo, así que este tipo de ataque no la evade por la misma vía. Esto es inferencia; el paper no evalúa controles fuera del modelo. Lo que sí queda expuesto es lo que la compuerta decide: el umbral de USD 500 y el origen del correo. El paper no discute umbrales de aprobación por monto; sí fija umbrales de detector (0,5 en p. 2; θ de perplejidad en p. 3).
4. **Métrica para copiar:** reportar ASR-defense y ASR-adaptive por separado, con n y tipo de ataque, como hace la Tabla 4. Los números de MESH (17/21 → 6/21 con Haiku; 8/21 → 3/21 con Sonnet) son evaluaciones no adaptativas. El paper muestra que, en IPI, las evaluaciones no adaptativas subestiman la vulnerabilidad (pp. 1–2, 9). Aplicar esa conclusión a MESH es inferencia.
5. **Rutas de riesgo de varios pasos:** el paper encuentra que el efecto del ataque cae en el segundo paso del robo de datos (p. 8, p. 10). Para MESH, una ruta correo → Camila → Mateo → Tomás puede tener el primer paso comprometido y los siguientes sin ataque directo. Eso justifica calcular la ruta completa y no solo el primer agente. Es inferencia a partir de un caso del paper.
6. **Frase para el pitch (con cita):** "Our results demonstrate that the adaptive attacks successfully break all of these defenses." (p. 9). En español: las defensas que viven dentro del prompt se rompen con ataques adaptativos, por eso MESH pone la compuerta fuera del modelo. Esto es una comparación de posición, no una prueba de que la compuerta de MESH funcione; eso lo muestran los experimentos propios, con n chico y sin ataque adaptativo.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 55 · corregidas: 3 · eliminadas: 0.
- Correcciones:
  - "Qué le sirve" 1: rango de páginas de las defensas rotas de pp. 6–9 a pp. 5–9 (la Figura 2 está en p. 5); la frase sobre la etiqueta de procedencia se marcó como inferencia de la nota, porque el paper no evalúa etiquetas de procedencia.
  - "Qué le sirve" 3: "El paper no discute umbrales" era excesivo; el paper sí fija umbrales de detector (0,5 en p. 2; θ de perplejidad en p. 3). Se acotó a umbrales de aprobación por monto.
- Pendiente: Nada. Las cifras de las Figuras 2–5 no se extrajeron y la nota no les atribuye valores.
