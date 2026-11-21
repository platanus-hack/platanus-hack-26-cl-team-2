# Multi-Agent Risks from Advanced AI

- **Autores:** Lewis Hammond, Alan Chan, Jesse Clifton, Jason Hoelscher-Obermaier, Akbir Khan, Euan McLean, et al. (44 autores en total)
- **Año / venue:** 2025. Cooperative AI Foundation, Technical Report #1 (campo Comments de arXiv). arXiv v1 19-feb-2025 (cs.MA).
- **Enlace:** https://arxiv.org/abs/2502.14143
- **PDF local:** ~/papers-ia-safety/multiagente/hammond-2025-multi-agent-risks.pdf
- **Verificado:** página arxiv.org/abs/2502.14143 (título, primeros autores, 44 autores, "Cooperative AI Foundation, Technical Report #1") y el PDF (96 páginas). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Es un reporte de taxonomía, no un experimento: sostiene que los sistemas de muchos agentes avanzados tienen riesgos distintos a los de un agente solo.
Clasifica las fallas según los incentivos de los agentes en tres modos: miscoordinación, conflicto y colusión.
Identifica siete factores de riesgo: asimetrías de información, efectos de red, presiones de selección, dinámicas desestabilizadoras, compromiso y confianza, agencia emergente y seguridad multiagente (Secs. 3.1-3.7).
En "efectos de red" (3.2) trata la propagación de errores en cadenas de delegación, que "transmiten no solo información sino instrucciones u objetivos". Si esos objetivos se distorsionan, el delegante sale perjudicado.
También ahí trata los ataques "infecciosos" entre agentes (Case Study 8, que resume Gu et al., Ju et al. y Lee & Tiwari).
En "seguridad multiagente" (3.7) describe ataques heterogéneos: agentes "seguros" por separado se combinan para saltarse las salvaguardas (Case Study 12, Jones et al. 2024).
Advierte que la dificultad de atribuir responsabilidad en redes difusas complica la defensa.
Incluye 13 casos de estudio (históricos, resultados previos y pequeños experimentos propios).
Cierra con implicaciones para seguridad, gobernanza y ética de la IA.
Sirve como marco de referencia citable para decir que el riesgo está en la interacción y no en el componente.

## Ataque o defensa que propone
- No propone un ataque ni una defensa concretos. Propone una taxonomía (3 modos de falla y 7 factores de riesgo) y una agenda: evaluaciones multiagente, monitoreo, "multi-agent security testing", trazabilidad y atribución.

## Números que reporta
Es un reporte de síntesis. Las cifras vienen de los casos de estudio:
- **Case Study 12** (cita a Jones et al. 2024): generar código vulnerable con cada modelo por separado tiene un éxito **menor al 3%**. Combinando un modelo de frontera "seguro" (Claude 3 Opus) con uno débil sin restricciones (Llama 2 70B con jailbreak), el éxito sube a **43%**.
- **Case Study 7** (experimento propio): 100 artículos de BuzzFeed reescritos sucesivamente con GPT-3.5. La tasa de respuestas correctas a 10 preguntas factuales cae de **~96% a menos de 60% después de la 8.ª reescritura** (Fig. 6). La información se degrada salto a salto, incluso sin malicia.
- **Case Study 8:** repite a Gu et al. 2024 (un millón de agentes, número logarítmico de pasos para comprometer la red).

## Conexión con MESH
- **Respaldo directo de "cada componente pasa, la ruta falla":** el Case Study 12 es el ejemplo canónico (<3% por separado contra 43% combinados). Es la misma lógica de `componentChecks()` contra `paths` en `apps/api/src/harness/risk-paths.ts`: `componentsAllOk` puede ser `true` mientras hay rutas `severity: "high"`.
- **"Cadenas de delegación que transmiten instrucciones"** (Sec. 3.2) es literalmente el modelo de rutas de MESH: correo → seed → (intermediario) → finanzas, y los niveles `interaction`/`systemic`.
- **Case Study 7 como analogía cuantitativa:** la información relevante (aquí, la advertencia del `sender_check`) se degrada en cada reescritura.
  - MESH puede medir su propia curva de supervivencia de la advertencia por salto: `observeRiskPaths()` ya registra `warningCarried` y `agentWarned` por salto.
  - Idea: agregar en `apps/api/src/batch.ts` la métrica "% de saltos seed→X donde la advertencia sobrevive", separada por fix. Es el equivalente MESH del 96% → <60%.
- **Uso en el pitch:** es el marco de una institución reconocida (Cooperative AI Foundation, con autores de DeepMind, Anthropic, CMU y otros) que nombra el problema. MESH es una herramienta concreta para el factor de riesgo "efectos de red" y "seguridad multiagente" en un caso de negocio (BEC).
