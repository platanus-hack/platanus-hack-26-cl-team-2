# High Precision Detection of Business Email Compromise
- **Autores:** Asaf Cidon (Barracuda Networks y Columbia University); Lior Gavish, Itay Bleier, Nadia Korshun, Marco Schweighauser y Alexey Tsitkin (Barracuda Networks) · **Año:** 2019 (28th USENIX Security Symposium) · **Enlace:** https://www.usenix.org/conference/usenixsecurity19/presentation/cidon · **Tema:** Detección de business email compromise (suplantación de empleados por correo) en tiempo real con clasificadores supervisados sobre historial de correo accedido por APIs de proveedores en la nube.
- **Cobertura de lectura:** páginas 1–18, completo (incluye referencias). Las tablas 6–9 se leyeron desde el .txt; no fue necesario abrir el PDF.

## Resumen
El BEC (suplantación de un empleado para pedir una transferencia, datos o un enlace de login) ha causado más de US$12 mil millones en pérdidas reportadas. La mayoría de estos correos no tienen malware ni listas negras que los delaten, son personalizados y, en su dataset, menos de uno de cada 50.000 correos es BEC, lo que hace difícil entrenar un clasificador con pocos falsos positivos. Los autores proponen BEC-Guard, en producción desde julio de 2017 dentro de Barracuda Sentinel, que lee el historial de correo de cada organización por la API de Office 365 o Gmail, detecta la suplantación en los encabezados y, solo para los correos sospechosos, analiza el contenido y los enlaces; los correos marcados van a cuarentena sin revisión de analistas. La evaluación sobre 200 millones de correos de varios cientos de organizaciones da una precisión de 98,2%, un recall de 96,9% y una tasa de falsos positivos de 1 en 5.260.000 para el sistema combinado. El clasificador de suplantación por sí solo tiene una precisión de 11,7%, así que la señal de encabezado no basta. Los autores reconocen evasiones conocidas y la necesidad de reentrenamiento continuo.

## Método
- **Datos de entrenamiento:** correo corporativo de unas 1.500 organizaciones con acceso por API a Office 365; más de 7.000 ejemplos de BEC etiquetados (p. 6). El clasificador de suplantación se entrenó con un año de historial; los clasificadores de contenido, con 300.000 correos de suplantación de un año (p. 9).
- **Balance de clases:** BEC es aproximadamente 50.000 veces menos frecuente que los legítimos (p. 6). Se submuestrean los legítimos con GMM (85 clusters) y muestreo proporcional por cluster (pp. 9–10).
- **Modelos:** (1) clasificador de suplantación sobre encabezados, random forest, con features como si el remitente es del dominio corporativo, si reply-to ≠ remitente, cuántas veces apareció el par nombre-dirección y popularidad del nombre (Tabla 3, pp. 6–7); (2) clasificador de texto, KNN sobre TF-IDF de 10.000 palabras y bigramas (pp. 8–9); (3) clasificador de enlaces, random forest con popularidad del dominio, longitud de URL y fecha de registro vía WHOIS (Tabla 5, p. 9).
- **Evaluación:** correos procesados en junio de 2018, muestreados al azar; consultas para encontrar BEC más etiquetado manual; 4.221 BEC; 200 millones de correos de varios cientos de organizaciones; división 50/50 entre entrenamiento y prueba (p. 13).
- **Métricas:** precisión, tasa de falsos positivos sobre todos los correos y recall. Objetivo de diseño: FP menor a 1 en un millón y precisión de 95% (p. 3).
- **Modelo de amenaza:** atacante externo que suplanta a un empleado por nombre desde una dirección distinta o con reply-to distinto (p. 5–6, 9). Supuestos de etiquetado: la misma dirección no suplanta más de 100 veces (p. 9) y el correo ya pasó un filtro antispam por volumen (p. 9). Fuera de alcance: cuentas comprometidas (p. 11), suplantación de personas externas (pp. 11–12), nombres genéricos y marcas (p. 12).
- **Ablaciones y control:** comparación de algoritmos (Tablas 7 y 8, p. 13), tamaño de diccionario (Figura 5, p. 14) y falsos negativos reportados por cinco organizaciones (Tabla 9, p. 14).

## Números clave
| Dato | Valor | Página |
|---|---|---|
| Precisión de BEC-Guard combinado (Tabla 6) | 98.2% | 13 |
| Tasa de falsos positivos de BEC-Guard combinado (Tabla 6) | 0.000019% (1 in 5,260,000) | 13 |
| Recall de BEC-Guard combinado (Tabla 6) | 96.9% | 13 |
| Precisión del clasificador de suplantación solo (Tabla 6) | 11.7%, FP 0.016%, recall 100% | 13 |
| Precisión del clasificador de texto con random forest, diccionario de 10.000 palabras (Tabla 7) | 99.2%, FP 1.7·10−5 %, recall 96.4% | 13 |
| Precisión del clasificador de enlaces con random forest (Tabla 8) | 97.1%, FP 1.3·10−5 %, recall 96.0% | 13 |
| Correos BEC encontrados en el conjunto de evaluación | 4,221 BEC emails | 13 |
| Proporción de BEC en el dataset | less than one out of 50,000 emails is a BEC attack | 3 |
| Ataques de wire transfer en la muestra de 3.000 (Tabla 1) | 46.9% | 4 |
| Ataques sin enlace (Tabla 1) | 59.9% of attacks do not involve a phishing link | 4 |
| Ataques en la muestra de Tabla 9: verdaderos positivos y falsos negativos reportados | 60 TPs y 5 FNs (cinco organizaciones) | 14 |

## Citas textuales
1. "BEC-Guard does not require an analyst to review the detected emails, but rather relies on offline and infrequent re-training of classifiers." (p. 3)
2. "If the precision is not high, users of BEC-Guard will lose confidence in the validity of its predictions." (p. 6)
3. "we have found the general approach of using historical email patterns via an API-based architecture has been very useful in quickly developing new classifiers for evolving threats." (p. 15)

## Limitaciones
Reconocidas por los autores:
- El enfoque supervisado requiere reentrenar continuamente los clasificadores y "is not fully generalizable" (p. 15).
- Evasión por legitimar el remitente: enviar cientos de correos legítimos desde la dirección suplantada antes de atacar (p. 12). Los autores creen que el costo para el atacante la limita.
- Evasión por reply-to legítimo: un perfil de LinkedIn o Salesforce con el nombre del empleado puede usar la lista blanca de servicios (p. 12).
- Evasión por texto: sinónimos de baja TF-IDF, nombres genéricos ("HR team", "IT"), fuentes de tamaño cero, alfabeto cirílico o griego (pp. 12–13). Texto dentro de imágenes no se cubre (p. 12).
- El clasificador de texto depende del idioma del dataset (p. 12).
- Falsos negativos: es difícil estimar la tasa real porque solo se mide sobre lo etiquetado (p. 14). La muestra de falsos negativos reportados es de cinco organizaciones (p. 14).
- Falsos positivos: correos personales o de exalumnos, y exempleados que piden W-2 (p. 13).
- Supuesto de 100 correos desde la misma dirección: los autores reconocen que puede sesgar el clasificador (p. 12).

Observación propia:
- Las etiquetas de evaluación salen de las mismas consultas heurísticas que definieron el etiquetado (p. 13). El recall mide lo que esas consultas encuentran, no el universo real de BEC.
- Hay dos cifras para el mismo dato: el texto dice "one in 5.3 million" (pp. 3 y 13) y la Tabla 6 dice "1 in 5,260,000" (p. 13). Conviene citar la tabla.
- No hay intervalos de confianza ni prueba estadística. Las diferencias entre algoritmos de texto (96,0% a 99,2% de precisión, Tabla 7) son pequeñas.
- La estimación de falsos negativos no reportados se basa en 65 casos (60 TPs y 5 FNs) de cinco organizaciones (Tabla 9): muestra muy chica.
- El dataset es privado, de clientes de Barracuda sobre Office 365, y no se puede reproducir.
- El paper no trata agentes, LLMs ni herramientas. Todo lo que sigue sobre MESH es inferencia.

## Qué le sirve a MESH
1. **Respaldo de "cada componente pasa, la ruta falla", parcial.** El paper muestra que la señal de remitente sola tiene precisión de 11,7% (p. 13), y que hace falta combinarla con contenido. Esto es coherente con que en MESH la verificación del remitente sola no cambió resultados (8/12 con y sin ella en Haiku). Demostrado: solo para clasificadores de BEC. Inferencia: el mismo patrón ocurre en agentes.
2. **La clase de ataque de MESH es la mayoritaria en el paper.** Wire transfer es 46,9% de los casos y 59,9% no tiene enlace (p. 4). Un pedido de cambio de cuenta bancaria en texto plano no dispara filtros de enlace ni de reputación. Demostrado: la frecuencia en su muestra. Inferencia: en MESH el riesgo está en la acción que se ejecuta, así que el control por procedencia en la herramienta complementa al detector de correo y no lo reemplaza.
3. **La etiqueta de procedencia debe venir del sistema, no del encabezado.** El paper muestra que el remitente puede "legitimarse" con correos previos (p. 12) y que una lista blanca de reply-to puede abusarse (p. 12). Inferencia: si MESH confiara en "remitente de confianza" para no etiquetar un correo como externo, tendría el mismo punto de evasión. Conviene copiar como caso de red-team: un atacante que primero conversa de forma legítima con Camila y luego pide el cambio de cuenta.
4. **Aprobación humana y falsos positivos.** BEC-Guard no tiene revisión humana (p. 3) y pone la precisión como condición de confianza del usuario (p. 6). Inferencia: el approval_gate de MESH pide revisión solo en reembolsos de más de USD 500 de origen externo, y el 0 de falsos positivos en 12 controles (n chico) es coherente con esa lógica, aunque no la prueba.
5. **Límite de USD 500.** El paper no tiene umbral monetario; sus métricas son por correo. Inferencia: los fraudes bajo USD 500 que MESH deja pasar son el mismo tipo de hueco que el paper atribuye a clasificadores de contenido: el atacante adapta texto y monto. Los autores dicen que "attackers constantly adapt their tactics and approaches" (p. 15); conviene presentar el límite como decisión de diseño, no como cobertura general.
6. **Métrica y pitch.** El paper reporta precisión, FP por correo y recall en ese orden y dice por qué (p. 3, p. 6). MESH puede reportar lo mismo: precisión y falsos positivos sobre controles legítimos, con recall solo sobre casos etiquetados. Frase para el pitch, con cita 2: "If the precision is not high, users of BEC-Guard will lose confidence in the validity of its predictions." (p. 6). Demostrado por Cidon et al. como criterio de diseño; el paralelo con MESH es inferencia.

## Verificación
- Verificado contra el texto completo del PDF por un segundo agente el 2026-11-21.
- Afirmaciones comprobadas: 60 · corregidas: 0 · eliminadas: 0.
- Lista breve de correcciones: Sin correcciones.
- Pendiente: Nada. La tabla 9 (p. 14) se confirmó solo en el .txt; la página del PDF no se abrió.
