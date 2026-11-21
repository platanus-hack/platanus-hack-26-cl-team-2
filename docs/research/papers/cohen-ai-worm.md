# Here Comes The AI Worm: Unleashing Zero-click Worms that Target GenAI-Powered Applications
- **Autores:** Stav Cohen (Technion), Ron Bitton (Intuit), Ben Nassi (Technion) · **Año:** 2024 (arXiv 2403.02817v2, revisión del 30 de enero de 2025) · **Enlace:** https://arxiv.org/abs/2403.02817 · **Tema:** gusano auto-replicante por inyección indirecta de prompts en ecosistemas de asistentes de correo con RAG; guardrail "Virtual Donkey"
- **Cobertura de lectura:** páginas 1–17, completo (cuerpo, referencias, Listings 1–3, figuras 1–18 y apéndice). No fue necesario abrir el PDF original porque el texto extraído era legible en todas las tablas.

## Resumen
El paper plantea si un atacante puede pasar de vulnerar una aplicación GenAI a vulnerar un ecosistema entero de aplicaciones conectadas por mensajes que usan RAG. Proponen Morris-II, un "adversarial self-replicating prompt" compuesto por un jailbreak (j), una instrucción para replicar la entrada en la salida (r) y una tarea maliciosa (m), que se escribe en un correo, queda guardado en la base RAG del destinatario y vuelve a salir en los borradores o respuestas del asistente. Evalúan el ataque contra asistentes de correo sobre Gemini 1.5 Flash, con correos reales de Enron, para medir recuperación, replicación y extracción de datos (contactos, teléfonos, direcciones). Encuentran que la carga se mantiene más de 90% hasta el salto 11 de propagación, y que cae a 40–80% entre los saltos 12 y 20 por la no determinación del modelo. Según sus propios números, en ese escenario un nuevo cliente se infecta alrededor de una de cada cinco veces que un usuario envía o recibe correos. Como defensa, proponen Virtual Donkey, un clasificador ligero que compara la salida del modelo con los correos recuperados por RAG usando BLEU, METEOR y ROUGE-L, con TPR 1.0 y FPR 0.015 en su dataset, aunque sin probarlo contra ataques adaptativos.

## Método
- **Modelo de amenaza:** el atacante solo puede enviar un correo a un usuario del ecosistema. No conoce el modelo, la implementación del RAG, el embedding ni la distribución de datos de la víctima (p. 3). Los objetivos son spam/phishing o exfiltración de datos confidenciales (p. 3).
- **Sistema evaluado:** cliente de correo con asistente GenAI implementado en LangChain; RAG con VectorStores y similitud coseno; motor Gemini 1.5 Flash (p. 5). Embedding principal: Text-Embedding-004 de Google (p. 6). Se compararon además GTE small/base/large y MPNet (p. 6).
- **Datos:** Enron; 20 empleados elegidos al azar, 100 correos por empleado (50 recibidos y 50 enviados), es decir 2,000 correos (p. 5). Para el guardrail, 100 bases personales de Enron (p. 9) y 10,000 correos de entrenamiento y prueba con división 70/30 (p. 10). Para OOD, 3 datasets de payloads (phishing, spam Walmart, persona cowboy) de 3,000 correos cada uno (p. 12), 20 jailbreaks distintos (p. 13) y 3,000 correos del corpus de Hillary Clinton (p. 13).
- **Experimentos de propagación:** 3 vías (correo nuevo desde asunto, enriquecimiento de cuerpo y respuesta), 1,000 experimentos por vía, 3,000 en total (p. 7). Resistencia en 20 saltos con 1,000 experimentos y motores GPT-4o mini, Gemini 1.5 Flash, Gemini 1.5 Pro y Claude 3.5 Sonnet, con k = 10 (p. 8). Corrección del payload con Gemini 1.5 Flash, repetida 1,000 veces (p. 8–9).
- **Métricas:** retrieval success, replication success, payload success, replication & payload success y combined success (producto de las tres anteriores), más coverage, error de alucinación, precisión y F1 (p. 5–6). Las tres primeras son binarias y, según los autores, la de replicación da una cota inferior (p. 6).
- **Guardrail Virtual Donkey:** se calculan BLEU, METEOR y ROUGE-L entre la salida y los n correos de entrada (solo el valor máximo por métrica). Clasificadores: regresión logística, Gaussian Naive Bayes y decision stump. No requiere una inferencia adicional (p. 9–10).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Correos del experimento de extracción (Enron, 20 empleados) | 2,000 emails | 5 |
| Retrieval rate, prefijo Wikipedia, Text-Embedding-004, k = 70% | 77.1% | 6 |
| Retrieval rate, prefijo Greetings, Text-Embedding-004, k = 70% | 19.5% | 6 |
| Retrieval rate, Text-Embedding-004 vs GTE-base-768, k = 60% | 57.1% vs 34.7% | 7 |
| Combined success rate, contexto de 20 correos (respuesta y enriquecimiento) | around 20% | 7 |
| Replication & payload success rate, saltos 1 a 11 (k = 10 a 100), Gemini 1.5 Flash | greater than 90% | 8 |
| Combined success rate, saltos 12 a 20 | 40%-80% | 8 |
| Replication & payload success rate, Gemini 1.5 Pro, salto 20 (k = 10) | 64% | 8 |
| F1 de corrección del payload, contexto de 10 a 100 correos (Gemini 1.5 Flash) | 0.78 a 0.58 | 9 |
| Solapamiento de distribuciones benigno/adversario (BLEU, METEOR, ROUGE-L) | 8%, 3% y 14% | 10 |
| Virtual Donkey (regresión logística, las tres métricas), TPR = 1.0 | TPR 1.000, FPR 0.015 | 11 |
| AUC del Virtual Donkey en el dataset OOD de Hillary Clinton | 0.79-0.97 | 13 |

## Citas textuales
1. "while compromising new assistants once in every five emails generated by the GenAI engine" (p. 2)
2. "a Virtual Donkey based on Logistic Regression using three features can perfectly detect adversarial self-replicating prompts with an FPR of 0.015" (p. 11)
3. "we have not tested the resilience of the method against adaptive attacks" (p. 13)

## Limitaciones
Reconocidas por los autores:
- Visibilidad: el prompt auto-replicante y el payload son visibles. Ocultarlos con técnicas como ASCII smuggling no evita que el payload quede visible para un humano en el circuito (p. 13).
- Ataques adaptativos: no probaron la resistencia de Virtual Donkey contra ataques adaptativos. Por eso lo presentan como un mecanismo que sube el costo del atacante en un factor, no como prevención completa (p. 13).
- No determinismo: la combinación de éxito cae de 40% a 80% entre los saltos 12 y 20 por el comportamiento no determinista del motor (p. 8).
- Cota inferior: la métrica de replicación exige la cadena idéntica, así que subestima el rendimiento real del ataque (p. 6).
- Alcance: los experimentos se hicieron en laboratorio y no contra aplicaciones existentes, para no liberar el gusano (p. 2).
- Acceso a la base RAG: restringir qué correos se guardan (lista blanca de remitentes o solo correos enviados y respondidos) reduce superficie de ataque, pero también reduce contexto, uso y precisión (p. 9).

Observación propia:
- El guardrail se entrena con el mismo tipo de jailbreak (role-play) y el mismo corpus que se evalúa en la parte in-distribution. Con TPR = 1.0, el FPR sube mucho en los escenarios OOD: 0.990 con ROUGE-L en el payload de phishing, 0.649 con METEOR (p. 17). Por eso el FPR de 0.015 no es un número transferible.
- Los números de propagación salen de un solo motor (Gemini 1.5 Flash) y de un solo corpus (Enron) en la parte principal. La generalización a otros motores aparece solo en la sección de resistencia (p. 5, p. 8).
- Los resultados de recuperación dependen del embedding y del prefijo del correo, y el paper no reporta intervalos de confianza (p. 6–7).
- El payload de exfiltración en el experimento de corrección incluye alucinaciones de direcciones de correo (error de 0.26 a 0.37), así que la métrica de extracción mezcla datos reales e inventados (p. 9).
- El paper no compara Virtual Donkey con las otras defensas que discute (LLM como juez, control de acceso, límite de tamaño). Esas defensas se descartan con argumentos, no con mediciones (p. 9).

## Qué le sirve a MESH
1. **Ruta, no componente (demostrado, con matices):** el paper muestra que la carga se mantiene de salto en salto (más de 90% en replicación y payload hasta el salto 11). Esto respalda la tesis "cada componente pasa, la ruta falla", pero el paper no mide rutas con herramientas de alto riesgo ni aprobación humana. Esa parte es inferencia nuestra.
2. **Verificación del remitente (afirmado en el modelo de amenaza, p. 3; la defensa solo se discute, no se mide):** el ataque necesita que el asistente de la víctima indexe correos entrantes en su RAG (p. 3, "active RAG property"). Limitar qué remitentes entran al contexto es una defensa que el paper discute (p. 9). Podemos citarla para justificar la verificación del remitente, aunque el paper advierte que cuesta contexto y precisión.
3. **Etiqueta de procedencia (inferencia propia, no evaluada en el paper):** Virtual Donkey detecta por contenido (similitud entre entrada y salida). MESH pone el origen en un campo que el sistema escribe y que viaja con el mensaje. Como el paper muestra que una defensa por contenido concreta, Virtual Donkey, sube mucho su FPR fuera de distribución (0.990 con ROUGE-L en el payload de phishing, con TPR = 1.0, p. 17), el argumento para una etiqueta estructural es más fuerte. Hay que presentarlo como argumento nuestro, no como resultado del paper.
4. **Límite de USD 500 y aprobación por procedencia (no aplica directamente):** el paper no tiene umbral monetario ni aprobación humana. Su payload es exfiltración de datos, no un movimiento de dinero. Sí sirve para notar que la visibilidad del payload deja un humano en el circuito (p. 13), lo que apoya que la aprobación humana vaya en la salida que sale del sistema. El límite de USD 500 es nuestro.
5. **Métrica para copiar:** las tres métricas binarias (retrieval, replication, payload) y su producto como "combined success rate" (p. 5–6) sirven como plantilla para reportar éxito por etapa en nuestras rutas de riesgo. También conviene reportar FPR junto con TPR, como hacen en la tabla de la p. 11, y advertir que el FPR cambia fuera de distribución (p. 17).
6. **Frase para el pitch (cita textual del paper):** "compromising new assistants once in every five emails generated by the GenAI engine" (p. 2). Sirve para mostrar que el riesgo de propagación es por volumen de correo y no por un ataque aislado. Hay que aclarar que son números de su laboratorio, con Gemini 1.5 Flash y Enron.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 60 · corregidas: 6 · eliminadas: 0.
- Correcciones:
  - Cita textual 1 y frase para el pitch: página 1 → página 2 (la frase está en la p. 2 del PDF).
  - Guardrail (Método): "No requiere una inferencia adicional" se ubica en p. 9–10, no p. 8–10.
  - Encabezado: "apéndice A" → "apéndice" (el PDF no rotula un apéndice A; las figuras 15–18 están en el apéndice).
  - Qué le sirve #2: "demostrado en el paper" → "afirmado en el modelo de amenaza, p. 3"; la lista blanca de remitentes solo se discute (p. 9), no se mide.
  - Qué le sirve #3: "las defensas por contenido" generalizaba un solo guardrail; ahora dice Virtual Donkey y precisa la métrica del FPR 0.990 (ROUGE-L, payload de phishing, p. 17).
- Pendiente: Nada.
