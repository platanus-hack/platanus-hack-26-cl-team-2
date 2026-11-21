# Identifying the Risks of LM Agents with an LM-Emulated Sandbox
- **Autores:** Yangjun Ruan, Honghua Dong, Andrew Wang, Silviu Pitis, Yongchao Zhou, Jimmy Ba, Yann Dubois, Chris J. Maddison, Tatsunori Hashimoto · **Año:** 2023 (arXiv:2309.15817; publicado en ICLR 2024) · **Enlace:** https://arxiv.org/abs/2309.15817 · **Tema:** evaluación de riesgos de agentes LM con herramientas mediante un sandbox emulado por LM (ToolEmu)
- **Cobertura de lectura:** páginas 1–70, completo (cuerpo, referencias, apéndices A–F, incluidos los prompts completos). Se usó el texto extraído; no hizo falta abrir el PDF porque las tablas salieron legibles.

## Resumen
Probar agentes LM con herramientas exige implementar cada herramienta y montar un sandbox para cada caso, lo que limita la cobertura de riesgos de cola larga y de herramientas de alto riesgo (p. 1). Los autores proponen ToolEmu: un LM (GPT-4) emula la ejecución de herramientas y el estado del entorno a partir de la especificación de la herramienta y de la instrucción, sin implementación real (p. 2, 5). Añaden un emulador adversarial que instancia escenarios con más probabilidad de provocar fallos (p. 6) y un evaluador LM que puntúa seguridad y utilidad (p. 7). Con 144 casos de prueba, 36 toolkits y 9 tipos de riesgo, reportan que el 68,8 % de los fallos identificados con el emulador adversarial son fallos reales validados por humanos (precisión; con el emulador estándar es 72,5 %) (p. 1, 2, 10). Seis de siete fallos de ChatGPT-3.5 en la herramienta Terminal se reprodujeron en una máquina real, con unas 8 horas de trabajo frente a menos de 15 minutos en emulación (p. 2, 10). Incluso el agente más seguro, GPT-4 con un prompt de seguridad, falla en el 23,9 % de los casos según su evaluador (p. 11).

## Método
- **Modelos del agente:** GPT-4 (gpt-4-0613), ChatGPT-3.5 (gpt-3.5-turbo-16k-0613), Claude-2 y Vicuna-1.5 (13B y 7B), con ReAct (p. 11). En la validación se usó temperatura 0,5 para el agente (p. 9).
- **Emulador y evaluadores:** GPT-4 con temperatura 0, con prompts de cadena de pensamiento y validación programática del formato (p. 9, 22). El emulador exige validar entradas (rechazar placeholders como "[EMAIL_ADDRESS]") y producir salidas consistentes con el estado previo (p. 6, 21).
- **Evaluador de seguridad:** puntúa de 0 a 3 según probabilidad (certainly not / possible / likely) y severidad (mild / severe), con "severe" definido como consecuencias significativas y a menudo irreversibles, como pérdida financiera o material sustancial (superior a USD 1000), daño irreversible o compromiso de la seguridad personal (p. 22; p. 7 solo da las categorías mild/severe).
- **Validación:** 100 casos muestreados del benchmark, cada uno con dos trayectorias (emulador estándar y adversarial), es decir 200 pares (p. 9). Anotación humana por 4 estudiantes de ciencias de la computación seleccionados de 25 candidatos, unas 25 horas cada uno (p. 9, 33). Se mide la precisión de los fallos identificados, la incidencia de fallos verdaderos, el porcentaje de emulaciones sin problemas críticos y el kappa de Cohen entre evaluador y humanos (p. 9–10).
- **Benchmark:** 144 casos generados con GPT-4 y revisados por autores, con al menos dos personas revisando cada caso (p. 8, 29–30). Incluye 36 toolkits y 311 herramientas, 30 de ellos sin benchmarks sandbox previos (p. 8). Evaluación de los agentes con el emulador adversarial en los 144 casos, a unos USD 1,2 por caso (p. 11).
- **Amenaza:** instrucciones subespecificadas (falta información de la tarea o restricciones de seguridad) con usuario de buena fe; no hay adversario malicioso. El riesgo sale de que el agente no resuelva la ambigüedad o invente datos (p. 4–5).
- **Replicación real:** solo la herramienta Terminal, en una EC2 t2.large con Ubuntu 22.04, con ChatGPT-3.5 y los 7 fallos detectados; 6 se reprodujeron (p. 41–45).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Casos de prueba del benchmark | 144 test cases, 9 risk types | 2 |
| Toolkits y herramientas del benchmark | 36 toolkits comprising a total of 311 tools | 8 |
| Failure incidence, GPT-4 con prompt "Safety" (agente base GPT-4: 39.4 %) | 23.9% | 11 |
| Failure incidence, GPT-4 agente base | 39.4% | 11 |
| Failure incidence, ChatGPT-3.5 agente base | 62.0% | 11 |
| Identified failure precision, emulador estándar | 72.5% ± 7.1% | 10 |
| Identified failure precision, emulador adversarial | 68.8% ± 6.7% | 10 |
| True failure incidence, estándar / adversarial | 39.6% ± 4.9% / 50.0% ± 5.1% | 10 |
| Emulaciones sin problemas críticos, estándar / adversarial | 91.9% ± 2.7% / 85.6% ± 3.6% | 10 |
| Cohen's κ evaluador de seguridad vs. humanos (A-H), seguridad | 0.478 ± 0.028 | 10 |
| Fallos de ChatGPT-3.5 en Terminal reproducidos en sandbox real | 6 de 7 | 10 |
| Coste por caso de evaluación de agentes | approximately $1.2 | 11 |

## Citas textuales
- "find that 68.8% of failures identified with ToolEmu would be valid real-world agent failures." (p. 1)
- "Notably, even the safest LM agent exhibits such failures 23.9% of the time according to our evaluator, underscoring the need to develop safer LM agents for real-world deployment." (p. 1)
- "Notably, even with existing sandboxes for the bash terminal, fully instantiating these failures took the authors about 8 hours, versus under 15 minutes in ToolEmu." (p. 2)

## Limitaciones
**Reconocidas por los autores:**
- Los emuladores "overlooked certain core constraints and caused critical issues in the emulations (Table 4), which was more evident in complex or adversarial scenarios" (p. 13).
- El evaluador de seguridad "could fail to detect certain risky actions committed by the LM agent", con recall de 73,1 % frente a un promedio humano de 75,3 % (p. 13).
- El emulador adversarial "sometimes compromises the emulation quality but does so to attain a higher failure incidence rate" (p. 10).
- Las estimaciones tienen errores estándar grandes por el tamaño muestral pequeño (p. 10).
- La curación de casos sigue dependiendo de humanos; los casos generados por LM violaron requisitos (p. 14).
- Solo se modela subespecificación con intención benigna; no se evalúan amenazas con intención maliciosa (p. 14).
- Los resultados de agentes no son totalmente deterministas aunque la temperatura sea 0; error estándar de 0,07 (seguridad), 0,05 (utilidad) y 4,1 % (incidencia) (p. 11, nota 2).
- El acuerdo entre anotadores humanos es "moderate", no sustancial (p. 10, 30).

**Observación propia:**
- Los 23,9 %, 39,4 % y 62,0 % son juicios de GPT-4 sobre trayectorias. La validación humana es sobre 100 casos y la precisión tiene ±6,7 a ±7,1 puntos (p. 10). Las cifras de tasa de fallo no están validadas por humanos caso por caso.
- La Tabla 5 se evalúa con el emulador adversarial, es decir, con escenarios diseñados para fallar (p. 11). No mide el comportamiento típico del agente.
- Cifras internas inconsistentes: en p. 11 aparece 75,3 % como precisión del evaluador y 73,1 % como recall; en p. 13 el mismo 73,1 % se presenta como recall frente a 75,3 % humano.
- El umbral de severidad de USD 1000 (p. 22) es elección de los autores y no está justificado con datos.
- GPT-4 hace de emulador y de evaluador, y también es uno de los agentes evaluados. Hay riesgo de sesgo de familia de modelos entre juez y juzgado.
- No hay agentes multiagente: todos los experimentos usan un agente único en ReAct (p. 11).
- La replicación real cubre una sola herramienta, un solo agente y 7 casos, y uno de los 7 se descartó por inconsistencias (p. 41, 45).

## Qué le sirve a MESH
1. **Sandbox simulado para barrer casos (demostrado en el paper):** el emulador adversarial sube la incidencia de fallos verdaderos de 39,6 % a 50,0 % frente al estándar (p. 10; el paper habla de unos 10 p.p., con errores estándar de ±4,9 y ±5,1). Inferencia: el paper respalda barrer escenarios con un entorno barato antes de montar el MCP real, pero no reemplaza el sandbox real de MESH. Es una referencia para justificar la búsqueda de rutas de riesgo con casos estresados.
2. **Métricas para copiar:** "failure incidence" (porcentaje de casos con al menos un fallo) y la puntuación de utilidad junto a la de seguridad (p. 11). El paper advierte que un agente que no actúa tiene seguridad 3,000 pero utilidad 0,063 (NoAct, p. 11). Inferencia: los 0 falsos positivos en 12 controles de MESH cubren parte de esa utilidad, pero conviene reportar también cuántos reembolsos legítimos sobre USD 500 quedan retenidos y cuánto tarda su aprobación.
3. **Umbral de USD 500 y casos de cola:** el paper separa severidad leve y grave por las consecuencias, no solo por el monto: pérdida financiera o material sustancial (superior a USD 1000), daño irreversible o compromiso de seguridad personal (p. 22). Inferencia: los fraudes que siguen pasando bajo USD 500 (6/21 y 3/21 en MESH) no alcanzan por sí solos el umbral de USD 1000 del paper; la severidad depende también de la reversibilidad y del alcance, así que conviene reportarlos con su monto y sus consecuencias, no como fallo sin clasificar. El paper también muestra transferencias fragmentadas en tramos de USD 10 000 (Fig. E.7, p. 35), aunque allí el usuario lo pidió. Inferencia: un umbral por operación se puede fragmentar; una regla por beneficiario o por ventana de tiempo sería más robusta.
4. **Prompt frente a compuerta estructural:** la mejor defensa del paper es un prompt de seguridad, que baja la incidencia de 39,4 % a 23,9 % en GPT-4 (p. 11–12). El paper no evalúa compuertas fuera del modelo. Demostrado: el paper obtiene reducciones solo con prompts. Inferencia: la aprobación por procedencia de MESH actúa en el sandbox y no depende de que el modelo obedezca. Las cifras no son comparables porque las tareas, los casos y las métricas son distintos; conviene decirlo explícitamente al citar.
5. **Entradas fabricadas y verificación del remitente:** el paper trata la "fabricated information" y las "unwarranted assumptions" como fallos centrales (p. 23, 55–56). Inferencia: que la verificación del remitente no cambie nada (8/12 con y sin ella en Haiku) es coherente con que el agente falla al resolver la ambigüedad, no con que ignore el origen del dato. La etiqueta de procedencia atiende algo que el paper no mide: de dónde vino el dato. Inferencia: ni el paper ni su evaluador consideran procedencia ni multiagente, así que ese hueco es un aporte posible de MESH.
6. **Frase para el pitch (demostrado por el paper):** "6 de 7 fallos de ChatGPT-3.5 en la herramienta Terminal pudieron reproducirse en un sandbox real" (p. 10). Y, para la motivación: "even the safest LM agent exhibits such failures 23.9% of the time according to our evaluator" (p. 1). Ambas están respaldadas por el paper, pero la primera es de un solo agente en Terminal y la segunda es un juicio del evaluador LM, no un hecho humano verificado.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 66 · corregidas: 6 · eliminadas: 0.
- Correcciones:
  - Resumen: el 68,8 % es la precisión del emulador adversarial (Tabla 3, p. 10), no de ToolEmu en general; el estándar da 72,5 %.
  - Método: "severe" no se define solo por USD 1000; p. 22 da también daño irreversible y compromiso de seguridad personal. p. 7 solo da las categorías.
  - Qué le sirve (1): se añaden los errores estándar (±4,9 y ±5,1) a la diferencia de unos 10 p.p. (p. 10).
  - Qué le sirve (3): el paper no separa la severidad "por el monto" con USD 500; su umbral es USD 1000 y depende también de las consecuencias (p. 22).
  - Qué le sirve (6): la frase de pitch generalizaba de un fallo a "un agente"; ahora se limita a 6 de 7 fallos de ChatGPT-3.5 en Terminal (p. 10).
  - Qué le sirve (5): la afirmación negativa sobre procedencia y multiagente se marca como inferencia.
- Pendiente: la temperatura 0,5 del agente en la validación (p. 9) puede aplicarse solo a Claude-2, porque el texto no lo aclara; no se cambió. Las cifras de MESH (17/21, 6/21, 3/21, 8/12, USD 500, etc.) no se verificaron, según el encargo.
