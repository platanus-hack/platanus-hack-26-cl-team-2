# Mitigating the risk of prompt injections in browser use

- **Autores:** Anthropic (página firmada por el equipo "Alignment"; sin autores individuales). Fuente complementaria: "Piloting Claude in Chrome" (Anthropic, 25-ago-2025).
- **Año / venue:** 2025. Post de investigación en el sitio oficial de Anthropic, publicado el 24-nov-2025. Sin revisión por pares.
- **Enlace:** https://www.anthropic.com/research/prompt-injection-defenses (complementaria: https://claude.com/blog/claude-for-chrome, a la que redirige anthropic.com/news/claude-for-chrome)
- **PDF local:** página web, sin PDF
- **Verificado:** título, fecha y cifras leídas con WebFetch en la página oficial anthropic.com/research/prompt-injection-defenses (pestaña: "Mitigating prompt injections in browser use"). El post de Claude in Chrome se leyó en claude.com/blog/claude-for-chrome (fecha 25-ago-2025, con actualizaciones del 24-nov y 18-dic-2025). Las cifras de system cards posteriores que aparecieron en resultados de búsqueda NO se verificaron y no se usan. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Anthropic describe cómo defiende a Claude contra inyección de prompts cuando navega la web como agente (Claude in Chrome).
Dice que cualquier contenido que el agente lee (páginas, DOM oculto, imágenes, UI engañosa) puede llevar instrucciones del atacante.
La defensa tiene tres capas: entrenamiento, clasificadores sobre contenido no confiable y red teaming continuo.
Entrenamiento: aprendizaje por refuerzo con inyecciones plantadas en contenido web simulado, premiando que Claude las detecte y no las siga.
Clasificadores: escanean todo el contenido no confiable que entra al contexto y, si detectan algo, ajustan el comportamiento de Claude.
Red teaming: un equipo humano interno y desafíos externos tipo "Arena"; según el post, los humanos encuentran vectores más creativos que los sistemas automáticos.
Miden con un atacante adaptativo interno "Best-of-N" que combina técnicas, con 100 intentos por entorno.
Comparan cuatro modelos en tres condiciones: solo el modelo, con las salvaguardas antiguas y con las mejoradas.
Con las salvaguardas mejoradas, el ASR queda cerca del 1–2%; Opus 4.5 es el más bajo (1,4%).
El post advierte que un 1% de ASR "sigue siendo un riesgo significativo" y que ningún agente de navegador es inmune.

## Ataque o defensa que propone
Defensa en capas a nivel de modelo y de sistema: RL para robustez del modelo, clasificadores de entrada sobre contenido no confiable con intervención, y red teaming humano y externo. El post de Claude in Chrome agrega controles de producto: permisos por sitio, confirmación antes de acciones de alto riesgo (publicar, comprar, compartir datos), mejores prompts de sistema, categorías de sitios bloqueadas (incluidos "financial services") y red teaming específico (campos ocultos del DOM, URL, títulos de pestaña).

## Números que reporta
- **Post de nov-2025 (atacante Best-of-N adaptativo, 100 intentos por entorno, ~2.200–3.200 intentos por barra; ASR = % de ataques encontrados por el modelo):**
  - Sonnet 4: **13,8%** solo modelo → **10,7%** salvaguardas antiguas → **2,0%** mejoradas.
  - Sonnet 4.5: **13,8% → 10,8% → 1,9%**.
  - Haiku 4.5: **12,0% → 11,1% → 2,4%**.
  - Opus 4.5: **8,0% → 7,6% → 1,4%**.
- **Post de Claude in Chrome (ago-2025):** 123 casos de prueba, 29 escenarios de ataque. Sin mitigaciones, ASR **23,6%**; con mitigaciones en modo autónomo, **11,2%**. En un set de 4 tipos de ataque propios del navegador: **35,7% → 0%**.
- Lo que más baja el ASR son las salvaguardas de sistema (clasificadores), no el modelo solo: de ~8–14% a ~1,4–2,4%.

## Conexión con MESH
- **Valida la tesis de MESH con datos del propio proveedor:** incluso el mejor modelo solo (Opus 4.5) tiene **8%** de ASR ante un atacante adaptativo. La mayor parte de la reducción viene de capas *alrededor* del modelo. MESH aplica la misma filosofía: `sender-check.ts` (determinista), `sandbox.ts` (bloqueo duro de `update_vendor_bank_account`) y `provenance.ts` (lo añade el harness, no el modelo).
- **El hueco que deja Anthropic y MESH ataca:** sus clasificadores escanean "todo el contenido no confiable que entra a la ventana de contexto". En un sistema multiagente, lo que llega al agente de finanzas no entra como contenido no confiable sino como un mensaje de un colega por `read_inbox` (`apps/api/src/harness/agent-runner.ts`). Un clasificador por agente no lo revisaría, o lo vería ya parafraseado y limpio. Es el argumento de "cada componente pasa su revisión, pero la ruta falla" (`apps/api/src/harness/risk-paths.ts`): la etiqueta "no confiable" debe viajar con el pedido (`provenance_tag`), no quedarse en el primer salto.
- **"Confirmar antes de acciones de alto riesgo" y "bloquear servicios financieros"** son la versión de producto del sandbox de MESH: `update_vendor_bank_account` siempre bloqueado y registrado. Para el pitch, MESH se alinea con prácticas que Anthropic ya publica.
- **Idea de metodología:** adoptar el esquema de tres barras de Anthropic en `apps/web/src/BatchResults.tsx`: ASR "solo modelo" (sin fixes) → "salvaguardas por componente" (`sender_check`) → "salvaguardas de ruta" (`sender_check` + `provenance_tag`). Con `apps/api/src/batch.ts` ya se corren las combinaciones de fixes; falta presentarlo así y reportar *n* por barra, como hace Anthropic.
- **Idea de atacante:** su evaluación usa un atacante adaptativo con 100 intentos por entorno; los escenarios de MESH son fijos (`email-harness/scenarios/*.json`). Un modo "best-of-N" barato: generar N variantes de un correo BEC con un modelo y reportar ASR@N además del ASR por intento.
