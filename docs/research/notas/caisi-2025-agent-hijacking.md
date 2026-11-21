# Technical Blog: Strengthening AI Agent Hijacking Evaluations

- **Autores:** "Technical Staff at the Center for AI Standards and Innovation" (CAISI, NIST; antes US AI Safety Institute). Los ataques nuevos se desarrollaron con red-teaming junto al UK AI Security Institute.
- **Año / venue:** 2025 (publicado el 17 de enero de 2025; la página muestra una actualización del 19 de diciembre de 2025) / blog técnico oficial de NIST
- **Enlace:** https://www.nist.gov/news-events/news/2025/01/technical-blog-strengthening-ai-agent-hijacking-evaluations (código: https://github.com/usnistgov/agentdojo-inspect)
- **PDF local:** página web, sin PDF
- **Verificado:** página oficial en nist.gov leída con WebFetch (título, fecha, autoría institucional, cifras). En la página no figuran autores individuales. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
CAISI (US) y UK AISI evaluaron el "agent hijacking" (prompt injection indirecta) sobre AgentDojo, integrado con Inspect.
El modelo evaluado fue Claude 3.5 Sonnet actualizado (octubre de 2024).
Con los ataques de base de AgentDojo, el modelo parecía robusto: 11% de éxito con el mejor ataque de base.
Ataques nuevos, creados con red-teaming sobre un subconjunto de tareas Workspace y probados en tareas reservadas, subieron el éxito a 81%. Además se transfirieron a las otras tres suites.
Agregaron tareas de inyección de mayor impacto: ejecución remota de código en un contenedor Linux, exfiltración masiva de archivos y phishing automatizado a contactos.
Lección 1: mejorar los frameworks compartidos (arreglaron bugs, agregaron ejecución asíncrona y la integración con Inspect).
Lección 2: las evaluaciones deben ser adaptativas, con ataques nuevos contra el sistema concreto.
Lección 3: analizar por tarea y no solo en agregado, porque el éxito y el impacto varían mucho (la exfiltración tuvo poco éxito pero un impacto alto).
Lección 4: probar varios intentos, porque la salida es probabilística y un atacante puede reintentar barato.
Con 25 intentos por ataque, el éxito promedio de cinco tareas pasó de 57% a 80%.

## Ataque o defensa que propone
Ataques de inyección nuevos, obtenidos con red-teaming (no publican el texto en el blog), y tres tareas de inyección nuevas. No propone defensas.

## Números que reporta
- Mejor ataque de base: 11% de ASR. Mejor ataque nuevo: 81% (Claude 3.5 Sonnet de octubre de 2024, AgentDojo/Workspace, tareas reservadas).
- Promedio de las cinco tareas de inyección: 57% en un intento. Con 25 intentos por tarea: 80%.
- Los valores por entorno y por tarea solo aparecen en gráficos (no los transcribo).
- **No reportan intervalos de confianza** ni el tamaño exacto de las muestras, salvo las 25 repeticiones.

## Conexión con MESH
- **Respaldo directo para dos métricas del lote**: (1) desglose **por correo** y no solo por tipo (`summarize()` en `apps/api/src/batch.ts` hoy agrupa por `kind|fixes`, y las filas por correo ya existen en `rows`). (2) **"Éxito en al menos 1 de k intentos"** por correo, usando las repeticiones de `BATCH_REPS`. CAISI muestra que pasar de 1 a 25 intentos sube el éxito de 57% a 80%.
- **Adaptatividad**: los escenarios de MESH (`email-harness/scenarios/redteam_injection.json`, `bec_realistic.json`) son fijos. La lección 2 sugiere que, si una defensa da 0%, hay que intentar romperla con un correo hecho *contra esa defensa*, por ejemplo uno que imite el texto de `[provenance]` de `apps/api/src/harness/provenance.ts`. `quoteUntrusted()` ya neutraliza el marcador dentro del From. Probar que eso aguanta un ataque adaptativo es una buena demo.
- **Impacto por tarea**: MESH ya distingue la herramienta grave (`update_vendor_bank_account`, siempre bloqueada) de la recuperable (`issue_refund` simulado). En el reporte, conviene ponderar o separar por impacto, como hace CAISI, en vez de una sola tasa.
- **Cifra de pitch**: el mismo modelo que "pasaba" con 11% cayó en 81% con ataques adaptativos. Es la versión "evaluación" de la tesis de MESH: aprobar un test estándar no significa que el sistema sea seguro.
