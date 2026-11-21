# IsolateGPT: An Execution Isolation Architecture for LLM-Based Agentic Systems
- **Autores:** Yuhao Wu, Franziska Roesner, Tadayoshi Kohno et al. (cinco autores en el PDF: + Ning Zhang, Umar Iqbal) · **Año:** 2024 (arXiv 2403.04960; versión NDSS 2025) · **Enlace:** https://arxiv.org/abs/2403.04960 · **Tema:** aislamiento de ejecución de apps de terceros en sistemas basados en LLM (hub-and-spoke), y control de flujos entre apps
- **Cobertura de lectura:** páginas 1–20, completo (cuerpo, Sección VIII, referencias y apéndices A–B). Texto extraído leído en su totalidad (1–1367 líneas). Se usó el PDF solo para verificar las Tablas I y II en las páginas 10 y 13, porque el texto extraído las desordena.

## Resumen
El paper aborda un problema de arquitectura: en sistemas tipo ChatGPT, las apps de terceros comparten una misma ventana de contexto y una misma instancia de LLM, así que una app puede influir en otra o extraer datos del sistema con lenguaje natural. Los autores proponen IsolateGPT, una arquitectura hub-and-spoke: cada app corre en un *spoke* aislado (proceso separado, con su propio LLM y memoria), y un *hub* cuyo operador es un módulo no-LLM, junto con un planificador (LLM ajustado) y una memoria, media toda interacción. Las apps solo se comunican mediante un protocolo de comunicación entre spokes (ISC) con formatos tipados e identificadores efímeros, y cada colaboración, acceso a datos o envío a un host remoto requiere consentimiento del usuario. Para evaluar, los autores construyen un benchmark de 1,598 ataques (InjecAgent extendido con 544 escenarios de robo de datos del sistema) y cuatro casos de estudio. En el benchmark, el sistema base (VanillaGPT) tiene una tasa promedio de éxito de ataque de 20.2%, mientras que en IsolateGPT el diálogo de permiso aparece en 7.6% de los casos y siempre con advertencia. En funcionalidad, IsolateGPT iguala a VanillaGPT en los benchmarks de LangChain con apps, y el overhead de latencia es menor a 30% para 75.73% de las consultas. Los autores concluyen que el aislamiento de ejecución mejora la seguridad sin pérdida de funcionalidad, con el costo de más latencia y más fricción para el usuario.

## Método
- **Sistema:** IsolateGPT implementado en LangChain 0.1.10 (~6K líneas de Python), memoria en Redis 5.0.1; aislamiento por procesos con seccomp y setrlimit (Apéndice A, p. 17). Modelo: GPT-4 (versión 0613) para todas las evaluaciones (p. 19). Comparación contra VanillaGPT, el mismo sistema sin aislamiento (p. 9).
- **Modelo de amenaza (p. 4–5):** el LLM y el sistema son confiables; las apps son no confiables; el contenido procesado por las apps puede ser malicioso (p. ej., un correo). Fuera de alcance: ataques de prompt injection dentro de una misma app; dentro del alcance: que esos ataques se propaguen a otras apps o al sistema.
- **Benchmark de seguridad (p. 9):** base de InjecAgent [13], extendida por los autores con 544 ataques donde se busca robar datos guardados en la memoria del sistema, para un total de 1,598 ataques. Métricas: tasa de éxito de ataque (ASR) para VanillaGPT en la primera y segunda app comprometida (A1, A2); para IsolateGPT, frecuencia de aparición del diálogo de permiso (PA) y fracción de esos diálogos con advertencia (WR) (p. 10).
- **Casos de estudio (p. 10–12):** (1) Ride sharing: una app maliciosa sube la tarifa de otra en $10 (Figura 5). (2) Robo de datos: un correo malicioso hace que el LLM exfiltre un documento de Google Drive y borre los correos (Figura 6). (3) Exposición inadvertida de datos entre una app de viajes y una de salud (Figura 7). (4) Alteración del sistema por instrucciones en conflicto entre dos apps de tono opuesto (Figura 8).
- **Funcionalidad (p. 13; nombres de los benchmarks en p. 18; conteos de consultas en Tabla IV, p. 14):** cuatro benchmarks de LangChain: Typewriter de una app, Typewriter de 26 apps (hasta 13 por caso), Relational Data (colaboración multi-app, hasta 5 apps colaborando; 21 consultas según Tabla IV) y Email Extraction sin apps (42 consultas). Métrica: corrección de pasos intermedios y de salida final (Tabla II).
- **Rendimiento (p. 14–15):** tiempo de resolución por componente (planificación, ejecución, memoria) en arranque en frío; costo relativo para 10% de las consultas (1.85× más; la sección no da una cifra en dólares).
- **Permisos (p. 18):** una vez, por sesión y permanente. No se permiten permisos permanentes para acciones irreversibles (enviar correo, compra).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Total de ataques en el benchmark extendido | 1,598 | p. 9 |
| Escenarios añadidos por los autores (robo de datos del sistema) | 544 | p. 9 |
| Tasa promedio de éxito de ataque, VANILLAGPT, todos los ataques (Tabla I) | 20.2% | p. 10 |
| Tasa de éxito de ataque, VANILLAGPT, segunda app comprometida, promedio (Tabla I; la tabla no pone símbolo %) | 81.3 | p. 10 |
| Frecuencia de aparición del diálogo de permiso, ISOLATEGPT, promedio | 7.6% | p. 10 |
| Fracción de diálogos de permiso de ISOLATEGPT con advertencia (WR) | 100% | p. 10 |
| Consultas con overhead de ISOLATEGPT menor a 30% frente a VANILLAGPT | 75.73% | p. 2 (también p. 14) |
| Overhead en percentiles 90 y 95 | 1.24× y 1.80× | p. 14 |
| Costo adicional para 10% de las consultas de benchmark | 1.85× más | p. 15 |
| Overhead de referencia de Gazelle (navegador con process isolation) | nearly ∼44% | p. 14 |
| Corrección final en colaboración multi-app, VANILLAGPT y ISOLATEGPT (Tabla II) | 0.95 y 0.95 | p. 13 |
| Caso de estudio C: tarifa de Metro Hail con VANILLAGPT (con +$10 de Quick Ride) | $61.80 | p. 11 (Figura 5) |
| Caso de estudio C: tarifa de Metro Hail con ISOLATEGPT | $51.80 | p. 11 (Figura 5) |

## Citas textuales
- "The performance overhead incurred by IsolateGPT to improve security is under 30% for three-quarters of tested queries." (p. 1)
- "For VANILLAGPT, on average 20.2% of the attacks succeeded across all of the tested attacks." (p. 10)
- "Note that we require explicit user consent before any irreversible action is taken by the app, such as the app sending an email or making a purchase, similar to deployed LLM-based systems, such as ChatGPT [48]." (p. 7)

## Limitaciones
**Reconocidas por los autores:**
- Alcance: "It is out of our scope to protect against such attacks within the scope of a single app" (p. 5). La inyección de prompt dentro de la app que procesa el contenido malicioso queda fuera.
- Supuesto de confianza: el LLM y el sistema que lo aloja se asumen "trustworthy and uncompromised" (p. 5).
- Revisión humana: "currently there are no fool-proof mechanisms to automatically detect malicious natural language instructions" (p. 8). Por eso el usuario debe revisar los mensajes entre spokes.
- Nota al pie 6: un adversario motivado podría inferir con side channels con qué app colabora un spoke (p. 8).
- Modelo de permisos "preliminary": "a comprehensive permission model is needed" (p. 9) y "a preliminary effort tailored for a limited set of use cases" (p. 18).
- Ataques a datos del sistema: la menor tasa de éxito "is mainly a limitation of the prompts in the benchmarks" (p. 10).
- Dependencia del usuario: "the success of an attack depends on the user granting permission for a malicious flow" (p. 10).
- Overhead: "our prototype system is not optimized for performance" (p. 14). Los propios autores reportan que los benchmarks "have imperfections" y que casos reales pueden quedar fuera (p. 14).
- Fricción de uso: el usuario debe dar datos manualmente, y los autores lo llaman "this usability security trade-off is necessary" (p. 12).
- Supuesto de la reproducción: "we assume that when users are presented with permission dialog with warnings, they reject the data access and app collaboration requests" (p. 19).

**Observación propia:**
- Un solo modelo (GPT-4 0613) y un solo proveedor. No hay resultados con otros modelos, y el paper no evalúa si la protección depende del modelo.
- IsolateGPT no reporta una tasa de éxito de ataque de extremo a extremo. Para él solo hay PA y WR (Tabla I, p. 10). La protección real depende de que el usuario rechace la solicitud que llega con advertencia. El paper no mide qué pasa cuando el usuario acepta.
- No se mide la calidad de las advertencias del hub: ni falsos positivos ni falsos negativos. El paper dice que la evaluación del hub es "reasonably reliable" (p. 9) sin datos que lo respalden.
- El benchmark de 1,598 es una extensión hecha por los propios autores (544 casos añadidos, p. 9). No es un benchmark externo estándar, y los números no son directamente comparables con otros trabajos.
- El overhead se mide con permisos concedidos automáticamente (p. 14) y con arranque en frío (p. 14). El costo de fricción del consentimiento en uso real no aparece en las cifras de latencia.
- Los casos de estudio son una instancia por caso, sin repeticiones ni intervalos de confianza. La Tabla II usa 21 consultas en colaboración multi-app (Tabla IV, p. 14), así que la igualdad de corrección (0.95 con 0.95) tiene poca potencia estadística.
- El paper no tiene etiqueta de procedencia ni umbrales de monto. Los mensajes ISC llevan formato tipado e identificadores efímeros (p. 8), pero no marcan de dónde vino el dato. Tampoco aparece la palabra "provenance".

## Qué le sirve a MESH
1. **Respaldo a la idea de decisión fuera del modelo.** El paper sostiene que el operador debe ser un módulo no-LLM determinista porque "it exchanges natural language-based messages with untrustworthy modules" (p. 6). Esto coincide con que approval_gate en el sandbox, no el prompt, retenga el reembolso. El paper no prueba esa comparación con prompts adaptativos; es una inferencia de diseño compartida, no un resultado.
2. **Aprobación humana por acción irreversible (p. 7 y p. 18).** IsolateGPT exige consentimiento antes de enviar correos o comprar, y no permite permisos permanentes para esas acciones (p. 18). MESH va más lejos en un punto: el disparador es procedencia externa más monto mayor a USD 500, y no el tipo de acción. Importante: el paper no tiene umbral de monto ni procedencia. El umbral de USD 500 es decisión propia de MESH y el paper no la respalda ni la contradice.
3. **Rutas de riesgo (inferencia).** El planificador del hub solo habilita interacción entre apps cuando hay dependencia entre ellas, y si no la hay sintetiza por separado en un spoke vacío (p. 6). Es parecido a calcular qué caminos entre fuente y herramienta están permitidos. El paper no mide rutas: solo describe el mecanismo.
4. **Métrica para copiar: reportar cuántas veces dispara la defensa, y cuánto de lo que pasa es residual.** IsolateGPT reporta PA=7.6% y WR=100% (p. 10), pero no el fraude que sigue pasando cuando el usuario acepta. MESH sí reporta los fraudes que siguen pasando bajo el umbral (17/21 → 6/21 en Haiku y 8/21 → 3/21 en Sonnet, con fraudes bajo USD 500 como residuo). Esa es una diferencia de honestidad de métrica que vale la pena destacar en la síntesis. Para el ataque, conviene copiar el benchmark de InjecAgent que los autores extendieron (ref. [13]).
5. **Etiqueta de procedencia y verificación del remitente: el paper no tiene ninguna.** El protocolo ISC valida formato y usa identificadores efímeros (p. 8), pero no etiqueta de dónde viene un mensaje. La advertencia de MESH de que el origen es un correo externo (12/12 con etiqueta frente a 4/12 sin defensa) cubre un hueco que este paper no aborda. Es una inferencia del hueco, no algo que el paper pruebe.
6. **Frase para el pitch (el paper la afirma; no es un resultado independiente de MESH):** "With IsolateGPT, we demonstrate that by innovating and applying tried-and-tested security practices, i.e., execution isolation, we can considerably improve the security of LLM-based systems." (p. 15). Sirve para situar MESH dentro de la línea de aislamiento. Para no sobrevender, conviene acompañarla de la limitación del propio paper: la protección depende de que el usuario rechace lo que se le advierte (p. 10 y p. 19).

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 60 · corregidas: 3 · eliminadas: 0.
- Correcciones:
  - Resumen: el planificador y la memoria no son módulos no-LLM. El paper solo llama no-LLM al operador, y dice que el planificador es "a tailored LLM" (p. 6). La memoria también usa un LLM para resumir (Apéndice A-C, p. 17).
  - Funcionalidad: los nombres de los cuatro benchmarks (Typewriter, Typewriter 26 apps, Relational Data, Email Extraction) están en p. 18, no en p. 13. Los conteos de consultas están en Tabla IV, p. 14.
  - Rendimiento: el paper reporta el costo como factor (1.85× más para 10% de las consultas) y no da una cifra en dólares en esa sección.
- Pendiente: Nada del paper. Las cifras propias de MESH no se verificaron, por instrucción. Las Tablas I, II y IV se leyeron en el texto extraído, que es legible; no fue necesario renderizar la página del PDF.
