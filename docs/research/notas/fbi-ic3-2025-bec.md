# Federal Bureau of Investigation — Internet Crime Report 2025 (2025 IC3 Annual Report)

- **Autores:** FBI, Internet Crime Complaint Center (IC3). Organización, sin autores individuales.
- **Año / venue:** 2026 (cubre el año calendario 2025). Informe anual oficial del FBI. El PDF tiene fecha de creación 16-04-2026; la fecha exacta del anuncio público no la verifiqué.
- **Enlace:** https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf (el informe 2024 está en https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf)
- **PDF local:** ~/papers-ia-safety/bec-y-patrones/fbi-ic3-2025.pdf (y fbi-ic3-2024.pdf como respaldo)
- **Verificado:** descargué ambos PDF desde ic3.gov y extraje las cifras con `pdftotext`. Las cifras de 2025 y de 2024 salen de las tablas del propio informe (pp. 8-9 y 26 del 2025; tabla de tres años del 2024). No usé blogs de proveedores como fuente. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Es el informe anual del IC3, el canal oficial donde víctimas en EE. UU. (y de más de 200 países) denuncian delitos informáticos.
En 2025 el IC3 recibió 1.008.597 denuncias, con pérdidas reportadas por US$20.877 millones, un 26 % más que en 2024.
El Business Email Compromise (BEC) volvió a ser el segundo delito más costoso, solo por detrás del fraude de inversión.
El informe define BEC como una estafa contra empresas o personas que trabajan con proveedores y hacen transferencias habituales, ejecutada comprometiendo cuentas de correo o haciéndose pasar por alguien (Apéndice B).
Esa es exactamente la situación que simula MESH: un "proveedor" pide cambiar la cuenta donde se le paga.
Hay una sección nueva sobre IA en el delito (pp. 39-41) que separa las pérdidas de BEC donde se usó IA.
El informe explica que los generadores de texto imitan correos de un CEO y que la clonación de voz se usa para pedir transferencias.
El Recovery Asset Team (RAT) intenta congelar fondos con la "Financial Fraud Kill Chain"; históricamente la mayoría de sus casos eran BEC.
Insiste en que el tiempo es crítico: cuanto antes se reporta, más se recupera.
Las cifras son solo lo que las víctimas denuncian, así que subestiman el problema real.

## Ataque o defensa que propone
No es un paper técnico, así que no propone defensas para agentes. Describe el ataque (BEC: suplantar a un proveedor o ejecutivo para desviar una transferencia) y da recomendaciones operativas: contactar al banco de inmediato para revertir la transferencia y denunciar en ic3.gov con todos los datos de la transacción (p. 17).

## Números que reporta
- **BEC 2025:** 24.768 denuncias y **US$3.046.598.558** en pérdidas (tabla de tres años, p. 26; también pp. 8-9).
- **BEC 2024:** 21.442 denuncias y **US$2.770.151.146**. **BEC 2023:** 21.489 denuncias y US$2.946.830.270 (misma tabla; el informe 2024 da las mismas cifras).
- **Total 2025:** 1.008.597 denuncias, US$20.877 millones, +26 % frente a 2024 (p. 4/6). El total de 2024 fue US$16.600 millones (informe 2024).
- **Ranking 2025:** inversión US$8.648 millones, BEC US$3.047 millones, soporte técnico US$2.135 millones (pp. 8-9).
- **IA:** 22.364 denuncias con información relacionada con IA y US$893.346.472 en pérdidas ajustadas (p. 39). **Las empresas reportaron más de US$30 millones en pérdidas por BEC con uso de IA** (p. 39). Solo 135 denuncias de BEC mencionan IA (tabla p. 41), probablemente porque la víctima no sabe si se usó IA.
- **Medio de pago en BEC:** el gráfico de la p. 9-10 muestra una porción del 86 % en BEC, que parece ser transferencia bancaria/ACH. No lo verifiqué: la leyenda no se lee bien en el texto extraído.
- **RAT 2025:** 3.900 incidentes, US$1.163.919.846 de intento de robo, US$679.013.183 congelados, **58 % de éxito** (p. 17).
- **Promedio por denuncia de BEC 2025:** unos US$123.000. Es un cálculo propio (3.046.598.558 / 24.768), no una cifra del informe.

## Conexión con MESH
- **Motivación del pitch:** el escenario de `email-harness/scenarios/bec_realistic.json` (6 ataques y 2 correos legítimos, todos pidiendo cambiar el IBAN de un proveedor o una devolución) es el patrón del segundo delito más costoso del FBI: US$3.050 millones en 2025. La herramienta `update_vendor_bank_account` de `apps/api/src/harness/sandbox.ts` es justamente el "sink" del BEC real.
- **Los agentes heredan el problema:** si una empresa delega en agentes las cuentas por pagar, el atacante ya no necesita engañar a una persona, le basta con engañar la cadena de agentes. El cálculo de `analyzeRiskPaths()` en `apps/api/src/harness/risk-paths.ts` cuantifica cuántas rutas existen desde el correo hasta esa herramienta.
- **Idea de métrica, "exposición en dólares":** el evaluador (`apps/api/src/harness/evaluator.ts`) podría reportar el monto de la factura del correo (por ejemplo, EUR 18.640 en bec_01) como "pérdida evitada o no evitada". Así el resultado de una ejecución se lee en el mismo idioma que el IC3.
- **Lección del RAT, el tiempo importa:** todo intento bloqueado queda en la traza como `sandbox.tool_attempt` (sandbox.ts). MESH podría medir en qué turno se detectó el intento, como análogo de la "kill chain".
- **Cuidado al citar:** la cifra de IA (>US$30M) es pequeña frente al total de BEC. Sirve para decir que "ya aparece en las estadísticas oficiales", no que la IA domina el BEC.
