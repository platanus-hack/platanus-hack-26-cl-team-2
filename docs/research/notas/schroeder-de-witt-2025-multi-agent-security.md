# Open Challenges in Multi-Agent Security: Towards Secure Systems of Interacting AI Agents

- **Autores:** v1 (4-may-2025): Christian Schroeder de Witt (Universidad de Oxford), autor único. v2 (29-abr-2026): Christian Schroeder de Witt, Klaudia Krawiecka, Igor Krawczuk, Ben Hagag, William L. Anderson, Peter Belcak, et al. (24 autores).
- **Año / venue:** 2025, preprint arXiv (cs.CR, cs.AI), sin Journal-ref.
- **Enlace:** https://arxiv.org/abs/2505.02077
- **PDF local:** ~/papers-ia-safety/multiagente/schroeder-de-witt-2025-multi-agent-security.pdf (v2, 82 páginas). La v1 se revisó aparte para confirmar el autor único.
- **Verificado:** página arxiv.org/abs/2505.02077 (título, versiones y 24 autores en la v2). Encabezado del PDF v1 (autor único, Oxford, 4-may-2025) y del PDF v2. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Paper de posición y agenda que propone la "seguridad multiagente" (multi-agent security) como campo: proteger redes de agentes contra amenazas que *surgen o se amplifican* por sus interacciones.
Su argumento: los protocolos de forma libre permiten colusión secreta y ataques en enjambre, y los efectos de red propagan rápido filtraciones, desinformación, jailbreaks y envenenamiento de datos.
Ordena el panorama de amenazas: quién es el atacante, una taxonomía de amenazas, dimensiones de variación del ataque y desafíos transversales (Sec. 3).
Discute compensaciones entre seguridad y utilidad, y entre distintos objetivos de seguridad, en entornos distribuidos y descentralizados.
En la Sec. 4.2 ("Data Trustworthiness and Provenance") dice que el problema central y poco explorado es definir **dónde ocurren las transiciones de confianza** en el grafo computacional.
Las entradas pueden venir de usuarios, de otros agentes, de APIs o de sensores. Sin especificar qué es confiable, hay "contaminación silenciosa" del razonamiento.
Pide investigar la **"procedencia semántica"**: metadatos que permitan a los agentes de más abajo ponderar sus entradas por nivel de confianza, en vez de tratarlas como igualmente fiables.
Aclara que la procedencia criptográfica establece el linaje, pero no que el dato fuera veraz en su origen.
Menciona CaMeL (separar control de datos y aplicar políticas por capacidades antes de cada llamada a herramienta) como el mejor punto actual.
Señala que MCP y A2A no fueron diseñados para una coordinación segura: no tienen procedencia de nivel auditoría ni restricciones de acción verificables.

## Ataque o defensa que propone
- No propone un ataque. Propone una agenda de defensas: diseño seguro del entorno, procedencia semántica y grafos de procedencia, protocolos, monitoreo, contención, atribución y gobernanza (Secs. 4-5).

## Números que reporta
- Es una revisión y agenda: **no reporta experimentos propios**. Cita resultados ajenos de forma cualitativa (por ejemplo, que CaMeL "elimina casi todos" los ataques de inyección en AgentDojo, sin dar cifra en el pasaje leído).
- Reutiliza el Case Study de Hammond et al. 2025 ("Overcoming Safeguards via Multiple Safe Models").

## Conexión con MESH
- **`provenance_tag` es una instancia mínima y ejecutable de lo que este paper pide como agenda:** que el origen del contenido viaje con él a través de las transiciones de confianza (agente → agente), para que el receptor pueda ponderarlo.
  - `provenanceTag()` en `apps/api/src/harness/provenance.ts` lo hace en texto. Lo agrega el harness y no el modelo, lo que coincide con la recomendación de no confiar en el agente para declarar el origen.
  - `risk-paths.ts` modela explícitamente esas "transiciones de confianza" como saltos (`RiskHop.provenanceVisible`, `verdictVisible`).
- **Lo que este paper contradice o matiza:** la procedencia no prueba veracidad. MESH lo reconoce en el texto del tag ("unverified"), pero `provenance_tag` es *informativa*, no *coercitiva*. El paper empuja hacia controles por capacidad (estilo CaMeL).
- **Idea "taint" coercitiva:** `observeRiskPaths()` ya calcula qué agentes quedaron "tocados" por el correo externo (el set `touched`). Una política en `apps/api/src/harness/sandbox.ts` podría exigir aprobación humana para `issue_refund` (hoy permitido por `DEFAULT_ALLOWED`) si el agente que la invoca está tocado por contenido externo.
  - Métrica nueva: los reembolsos en ataque (`refund_on_attack` en `evaluator.ts`) deberían bajar a 0.
  - Esa caída se compararía con lo que logra `provenance_tag` sola.
  - Es pasar de "informar" a "hacer cumplir".
- **Uso en el pitch:** MESH convierte una línea de la agenda de investigación (procedencia entre agentes en las transiciones de confianza) en un experimento medible con antes y después.
