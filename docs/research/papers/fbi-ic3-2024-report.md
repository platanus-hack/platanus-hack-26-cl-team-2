# Internet Crime Report 2024
- **Autores:** Federal Bureau of Investigation, Internet Crime Complaint Center (IC3) · **Año:** 2025 · **Enlace:** https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf · **Tema:** estadísticas de fraude y crimen cibernético reportados por el público; BEC (compromiso de correo empresarial) como contexto de MESH
- **Cobertura de lectura:** páginas 1–47, completo (texto extraído del PDF, 1715 líneas, todas leídas). No se abrió el PDF porque las tablas salen legibles en el texto. Las páginas de accesibilidad (alt text) se leyeron como parte del texto.

## Resumen
El informe anual del IC3 del FBI agrega las denuncias que el público presenta en ic3.gov sobre fraudes y amenazas cibernéticas. En 2024 recibió 859,532 denuncias y pérdidas reportadas por $16.6 billion, un récord según el propio informe (p. 3–4). El fraude habilitado por ciberdelitos concentra casi 83% de las pérdidas (p. 11). Business Email Compromise (BEC) aparece con 21,442 denuncias y $2,770,151,146 en pérdidas (p. 9–10), y es el tipo de caso que el Financial Fraud Kill Chain intenta congelar (p. 13). El paper no evalúa ningún control defensivo; solo incluye materiales educativos en el Apéndice E (p. 47), como «Check – Call – Wait» y «Avoid falling to a BEC scam». Es un registro de denuncias, no un estudio de seguridad de sistemas. Su valor para MESH es de contexto: muestra que el vector de correo externo que suplanta a un proveedor o cliente tiene volumen y pérdidas reales, y que la detección suele llegar después del pago.

## Método
- **Tipo de estudio:** agregación estadística de denuncias presentadas por el público a través de IC3.gov, sin experimentos ni modelos de ataque propios (p. 41, 44).
- **Datos:** 859,532 denuncias en 2024; 256,256 con pérdida real reportada; pérdida media por denuncia de $19,372 (p. 4). Comparación de tres años 2022–2024 por tipo de delito (p. 18–19, 30–31, 36–38).
- **Procesamiento:** los analistas del IC3 revisan las denuncias y asignan tipo de delito y pérdida ajustada; cada denuncia tiene un solo tipo de delito; las pérdidas en moneda extranjera se convierten a USD cuando es posible (p. 44).
- **Desglose:** por tipo de delito, grupo de edad, estado, país de origen de la denuncia y destino de transferencias internacionales (p. 14, 16, 20–23, 24–25).
- **Métricas:** número de denuncias, pérdida reportada en USD y "success rate" de la Financial Fraud Kill Chain (66%, p. 13). El informe no define cómo se calcula esa tasa.
- **Modelo de amenaza implícito:** fraude dirigido al público, con BEC definido como compromiso de cuentas de correo, teléfono o reuniones virtuales por ingeniería social o intrusión, para hacer transferencias no autorizadas (p. 42). No hay modelo de agentes ni de sistemas automatizados.

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Denuncias totales en 2024 | 859,532 | 4 |
| Pérdidas reportadas en 2024 | $16.6 billion | 3 |
| Pérdida media reportada por denuncia (2024) | $19,372 | 4 |
| Business Email Compromise: denuncias | 21,442 | 9 |
| Business Email Compromise: pérdidas | $2,770,151,146 | 10 |
| Fraude habilitado por ciberdelitos: parte de las pérdidas (2024) | almost 83% of all losses; $13.7 Billion | 11 |
| Cryptocurrency (descriptor): pérdidas | $9,322,335,911 | 10 |
| Financial Fraud Kill Chain: success rate | 66% | 13 |
| Financial Fraud Kill Chain: intentos (3,020 denuncias) | $848.4 Million attempted theft | 13 |
| Operation Level Up: víctimas de inversión en cripto notificadas | 4,323 | 14 |
| Denunciantes de 60+: pérdidas | $4.885 Billion | 27 |
| Ransomware: nuevas variantes reconocidas por IC3 en 2024 | 67 | 15 |

## Citas textuales
1. "Last year saw a new record for losses reported to IC3, totaling a staggering $16.6 billion." (p. 3)
2. "Cyber-enabled fraud is responsible for almost 83% of all losses reported to IC3 in 2024." (p. 11)
3. "Most Financial Fraud Kill Chain incidents initiated by the IC3 RAT are Business Email Compromise (BEC)." (p. 13)

## Limitaciones
**Reconocidas por los autores:**
- Las denuncias son autorreportadas. Los datos descriptivos (tipo de delito, pérdida) pueden cambiar con investigaciones posteriores, y las cifras son "an assessment taken at a point in time, which may change" (p. 44).
- Puede haber denuncias duplicadas: "Some complainants may have filed more than once, creating a possible duplicate complaint" (p. 44).
- Ransomware sub-reportado: "In some cases, entities do not report any loss amount to FBI, thereby creating an artificially low overall ransomware loss rate" (p. 10).
- Las estadísticas por estado solo incluyen denuncias con ubicación aportada por el denunciante cuando la conoce (p. 20, 21, 44); la edad es opcional (p. 8, 44).
- Un conteo de denuncias no es un conteo de personas (p. 44).

**Observación propia:**
- No hay tasa de prevalencia ni base de comparación. Sin denuncias no reportadas ni número de intentos fallidos, no se puede estimar qué fracción del fraude se denuncia.
- "Cryptocurrency" es un descriptor que cruza otros tipos de delito (p. 9, 37). Sumarlo a los tipos de delito cuenta dos veces. No se debe sumar con BEC ni con inversión.
- La "success rate" de la Financial Fraud Kill Chain (66%, p. 13) no tiene definición ni denominador en el texto.
- Hay una discrepancia de redondeo para el mismo grupo: p. 8 da "$4.8 billion" para 60+ (147,127 denuncias), y p. 27 da "$4.885 Billion". Aquí se usa el valor de p. 27.
- El informe no tiene datos sobre agentes de IA, automatización ni correo procesado por sistemas. Para MESH sirve como referencia de volumen y de patrón, no como evidencia de un ataque a agentes.

## Qué le sirve a MESH
1. **Respalda el escenario BEC como riesgo real.** El paper muestra BEC con 21,442 denuncias y $2,770,151,146 en pérdidas en 2024 (p. 9–10), y con pérdidas de $2,742,354,049 (2022) y $2,946,830,270 (2023) en la tabla de tres años (p. 19). Esto demuestra volumen y pérdida, no que un agente de IA sea más vulnerable. La inferencia es que una ruta correo externo → pago es el mismo patrón que MESH simula.
2. **Verificación del remitente: el paper muestra suplantación, no prueba que la verificación falle.** El caso de Denver describe un correo "spoofed" de supuestos agentes inmobiliarios que pidieron una transferencia, y las víctimas lo notaron dos días después (p. 15). Inferencia propia: el remitente visible no basta como garantía, lo que respalda que MESH no dependa solo de la verificación del remitente. El paper no evalúa esa verificación.
3. **Etiqueta de procedencia y detección tardía.** El caso de Singapur muestra que el dinero se movió antes de que se congelara: se congelaron $5,100,000 de un envío de $6,661,650, y lo que no estaba disponible se transfirió a España y China (p. 15). Inferencia: marcar el origen en el momento de entrada, antes del pago, tiene más valor que intentar recuperar después.
4. **Umbral de USD 500.** La pérdida media por denuncia es $19,372 (p. 4). El umbral de MESH está muy por debajo de esa media. El paper no da distribución por monto, así que no se puede saber qué fracción de los fraudes quedaría bajo USD 500. Es una limitación que MESH ya reconoce y el paper no la resuelve.
5. **Métrica a copiar, con cuidado.** El concepto de "success rate" del Financial Fraud Kill Chain (66%, p. 13) puede inspirar una métrica de MESH (intentos bloqueados frente a fraudes completados), pero el informe no la define. Hay que definirla propia y no citar el 66% como si fuera comparable.
6. **Frase para el pitch (verificada).** "Last year saw a new record for losses reported to IC3, totaling a staggering $16.6 billion." (p. 3). Sirve para abrir con el tamaño del problema. Frase de apoyo: "Most Financial Fraud Kill Chain incidents initiated by the IC3 RAT are Business Email Compromise (BEC)." (p. 13), que conecta el caso de MESH con el fraude que el FBI sigue día a día.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 42 · corregidas: 2 · eliminadas: 0.
- Correcciones:
  - Resumen: decía que el paper «no propone ningún método defensivo»; el Apéndice E (p. 47) sí incluye materiales educativos («Check – Call – Wait», «Avoid falling to a BEC scam»). Se corrigió; el paper sigue sin evaluar controles.
  - Limitaciones: la frase sobre estadísticas por estado no tenía respaldo en p. 20–21; la base está en p. 44 («generated from information entered when known/provided by the complainant»). Se corrigió la cita de página y la formulación.
- Pendiente: la afirmación de cabecera sobre la cobertura de lectura («páginas 1–47, completo ... todas leídas») describe el proceso de lectura, no el paper; revisé las páginas citadas en la nota, no todas las 47 una por una.
