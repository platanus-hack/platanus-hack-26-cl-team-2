# Detecting and Characterizing Lateral Phishing at Scale
- **Autores:** Grant Ho, Asaf Cidon, Lior Gavish et al. · **Año:** 2019 · **Enlace:** https://arxiv.org/abs/1910.00790 · **Tema:** phishing lateral desde cuentas de empleados comprometidas; detección y caracterización a escala
- **Cobertura de lectura:** páginas 1–22, completo (texto extraído, 1,424 líneas, incluye referencias y apéndices A–C). No fue necesario abrir el PDF: todas las tablas se leyeron bien en el texto.

## Resumen
El paper aborda el phishing lateral: un atacante toma una cuenta de correo legítima de una empresa y envía phishing a otros empleados, que confían en el remitente y, a menudo, también en los filtros de correo. Los autores construyen un detector que usa solo el historial de correos de la organización (sin logs de red), con features de destinatarios, palabras de "carnada" y reputación global de la URL. Lo entrenan con 25,670,264 correos y lo evalúan en 87,413,431 correos de 92 organizaciones, con entrenamiento temporal y reentrenamiento mensual. El detector encuentra 87.3% de los incidentes conocidos en prueba, con 316 falsos positivos y precisión de 23.3%. Con los ataques detectados y reportes de usuarios caracterizan 180 incidentes de 33 organizaciones: casi todos usan señuelos genéricos (documento compartido, alerta de cuenta), 7% tiene contenido dirigido, y al menos 11% de los atacantes compromete otra cuenta. Un 31% muestra comportamiento sofisticado (responder a víctimas o borrar rastros). Concluyen que el phishing lateral es un problema real y oportunista, no solo de APT.

## Método
- **Datos:** 113,083,695 correos enviados por empleados de 92 organizaciones con Office 365 (clientes de Barracuda, en inglés). Entrenamiento: abril–junio 2018, 52 organizaciones exploratorias, 25,670,264 correos. Prueba: julio–octubre 2018, 87,413,431 correos, las 52 exploratorias más 40 de prueba elegidas al azar antes de analizar datos.
- **Ground truth:** 1,902 correos de phishing lateral de 154 cuentas comprometidas en 33 organizaciones (1,694 reportados por usuarios y el resto solo por el detector). De los reportados por usuarios, 40 contenían transferencia bancaria falsa o adjunto malicioso y 1,862 una URL maliciosa. Etiquetado manual; criterio de "lateral" = el correo sale de una cuenta interna (Sent Items o SPF/DKIM).
- **Detector:** Random Forest (PySpark), 64 árboles, profundidad máxima 8, hoja mínima 4, submuestreo de 200 correos benignos por cada ataque. Features: número de destinatarios únicos; "recipient likelihood" (similitud de Jaccard con destinatarios del mes anterior); palabra de señuelo (booleano sobre ~150 frases "phishy"); reputación global de la URL más rara (ranking Cisco Umbrella Top 1M) y reputación local (aporta casi nada). Pesos: reputación global 0.42, número de destinatarios 0.34, recipient likelihood 0.17, "phishy" 0.06, local 0.01.
- **Métricas:** Detection Rate por incidente (par único asunto + remitente), no por correo; precision; tasa de falsos positivos por correo. Hay detectores comparados (fuzzy phish y template) en el apéndice B, con peor rendimiento.
- **Modelo de amenaza:** cuenta legítima comprometida que envía phishing con URL maliciosa a destinatarios internos y externos. Los ataques desde cuentas externas (spoofing) quedan fuera.
- **Caracterización:** clasifican a cada atacante como Account-agnostic, Organization-wide, Lateral-organization o Targeted-recipient; etiquetan el contenido con dos ejes de personalización (tema y nombre, 3×3).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Correos enviados por empleados analizados | 113,083,695 unique, employee-sent emails | p. 4 |
| Organizaciones en el dataset | 92 enterprise organizations | p. 1 |
| Detection Rate en prueba (detector URL) | 87.3% (96 de 110 incidentes) | p. 7 |
| Falsos positivos en prueba (Tabla 1) | 316 | p. 7 |
| Precision en prueba (Tabla 1) | 23.3% | p. 7 |
| Tasa de falsos positivos en prueba (Tabla 1) | 0.00036% | p. 7 |
| Peso de la reputación global de URL en el modelo | 0.42 | p. 7 |
| Organizaciones con al menos un incidente lateral (muestra aleatoria) | 14% en siete meses | p. 2 |
| Atacantes que comprometen al menos otro empleado | over 11% | p. 2 |
| Correos de phishing lateral / cuentas comprometidas / incidentes | 1,902 / 154 / 180 | p. 8 |
| Tasa de conversión mediana (cuenta nueva comprometida por empleados contactados) | one newly hijacked account per 542 fellow employees | p. 10 |
| Incidentes con contenido dirigido | 7% | p. 12 |
| Incidentes con mensajes genéricos | 92.7% | p. 13 |

## Citas textuales
- "Our analysis shows that this attack is potent and widespread" (p. 1).
- "Attackers could attempt to evade our detector by targeting different features we draw upon" (p. 8).
- "most follow strategies that employ non-personalized phishing attacks that can be readily used across different organizations" (p. 15).

## Limitaciones
Reconocidas por los autores:
- La tasa de detección es "best-effort" y "potentially overestimates the true positive rate", porque el ground truth es imperfecto y no incluye ataques dirigidos no reportados (p. 7).
- El ground truth tiene sesgo hacia correos que contactan a muchos destinatarios y hacia ataques que los usuarios reconocen fácilmente (p. 8).
- Solo cubren phishing por URL; el número de ataques sin URL "likely underestimates" (p. 8). Los 12 ataques con adjunto son falsos negativos por diseño (p. 7).
- La evasión no se evalúa: "more work is needed to explore defenses against potential evasion attacks" (p. 8).
- La tasa de éxito de ataques (al menos 11%) es una cota conservadora; puede confundir compromisos concurrentes (p. 9).
- Precision baja. Los autores la llaman "lower than desired", aunque consideran operable el volumen de falsas alarmas (p. 20).
- Los detectores basados en texto fallan por el "churn" del texto de phishing; el detector fuzzy solo detectó 2 incidentes con 0 falsos positivos y se perdieron 38 (p. 20).
- Datos de 92 organizaciones de habla inglesa (p. 3) y solo de Office 365 (p. 4). Excluye correos de cuentas externas (p. 4).

**Observación propia:**
- Tabla 1 y el texto no coinciden. El texto dice 312 falsos positivos en prueba (p. 7) y la tabla 316; la precisión de 23.3% es consistente con 316. En entrenamiento, el texto dice 62 falsos positivos (p. 7), pero la tabla dice 136, y la precisión de 31.3% es consistente con 136. Parece que el texto mezcla cifras con verdaderos positivos. Conviene citar la Tabla 1.
- El resultado de 11% se escribe como "over 11%" (p. 2) y como "at least 11%" (pp. 8–9). Usar "al menos 11%", que es la formulación conservadora de los autores.
- Es phishing de credenciales (las URL llevan a páginas falsas de login de Office 365, p. 4) y su impacto no se mide en dinero. No hay análisis de fraude BEC con montos ni de transferencias bancarias.
- El detector se apoya en la reputación de la URL, una señal que un fraude sin enlace no tiene. Los 40 correos con transferencia falsa quedan fuera de su diseño (p. 5 y p. 7).

## Qué le sirve a MESH
1. **Lo que el paper demuestra:** una cuenta legítima hereda la confianza del destinatario ("automatically benefits from the implicit trust in the hijacked account", p. 1). **Inferencia propia:** si el correo fraudulento viene de un empleado comprometido, la etiqueta de procedencia "correo externo" no se activa, y approval_gate no retendría ese caso. Es un límite que conviene declarar en el pitch y en la sección de la rama de procedencia.
2. **Respalda el perfil de amenaza de MESH:** la mayoría de los incidentes usa mensajes genéricos (92.7%, p. 13) y solo 7% tiene contenido dirigido (p. 12). Esto sostiene que los fraudes de MESH pueden ser plantillas reutilizables. El paper no mide BEC, así que no respalda ni contradice el umbral de USD 500.
3. **Argumento de costo de falsos positivos (p. 2):** un 20% de falsos positivos "would lead to thousands of false alerts each day". **Lo que el paper demuestra:** la alerta debe ser de bajo volumen. **Inferencia:** el gate de MESH, que solo se aplica a reembolsos de más de USD 500 de origen externo, sigue esa lógica. Sus 0 falsos positivos en 12 controles no permiten estimar una tasa; hay que decirlo así.
4. **Métrica para copiar (p. 7):** contar incidentes como pares únicos (asunto, remitente) y no por correo, para que un ataque con muchos correos idénticos no domine el resultado. En MESH conviene contar fraudes intentados como incidentes y no como correos.
5. **Ataque/evasión (p. 8):** el paper advierte que los atacantes pueden esquivar features. **Inferencia:** un fraude que fracciona el reembolso en montos menores a USD 500 esquiva el gate de MESH. Ese es el caso que el experimento ya documenta como sobreviviente, y el paper da base para incluirlo como clase de ataque explícita.
6. **Frase para el pitch (p. 15, cita textual):** "most follow strategies that employ non-personalized phishing attacks that can be readily used across different organizations". Sirve para argumentar que el fraude de MESH no requiere sofisticación. Lo que el paper demuestra es la prevalencia del contenido genérico en phishing de credenciales; extenderlo a BEC es inferencia.
