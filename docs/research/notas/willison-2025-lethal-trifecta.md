# The lethal trifecta for AI agents: private data, untrusted content, and external communication

- **Autores:** Simon Willison
- **Año / venue:** 2025, blog personal (simonwillison.net), 16-06-2025
- **Enlace:** https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
- **PDF local:** página web, sin PDF
- **Verificado:** leí el post en simonwillison.net con WebFetch: título, fecha, autor y frases textuales. También revisé su post del 02-11-2025 (https://simonwillison.net/2025/Nov/2/new-prompt-injection-papers/), donde comenta el "Agents Rule of Two" de Meta. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Willison nombra una combinación de capacidades que vuelve explotable a cualquier agente con LLM: la "lethal trifecta".
Sus tres componentes son: acceso a tus datos privados, exposición a contenido no confiable y capacidad de comunicarse hacia afuera.
Si un agente tiene las tres, un atacante puede engañarlo con facilidad para que le envíe tus datos privados.
La causa de fondo: los LLM siguen instrucciones que vengan de cualquier parte del contexto, sin distinguir quién las escribió.
Según Willison, "todavía no sabemos cómo prevenir esto de manera 100 % confiable".
Desconfía de los guardrails comerciales que dicen bloquear "el 95 % de los ataques": en seguridad web, 95 % es nota reprobatoria.
Critica a MCP porque anima a mezclar herramientas de distintas fuentes, y con eso el usuario arma la trifecta sin darse cuenta.
Ejemplo: el exploit del MCP de GitHub, donde una sola herramienta reunía las tres capacidades (issues públicos, repos privados y PR).
Para desarrolladores remite a los patrones de Beurer-Kellner et al. y a CaMeL (Google DeepMind).
Para usuarios finales la única salida es evitar la combinación completa.

## Ataque o defensa que propone
- **Modelo de amenaza:** prompt injection indirecta que lleva a la exfiltración de datos cuando coinciden los tres factores.
- **Defensa:** cortar al menos una de las tres patas. No confiar en guardrails probabilísticos. Diseñar con patrones que impidan que el input no confiable dispare acciones con consecuencias.

## Números que reporta
No reporta datos propios. El único número es retórico: "95 %" como tasa típica que prometen los guardrails comerciales, que él califica de "failing grade" en seguridad web.

## Conexión con MESH
- **Adaptación al BEC:** la trifecta original habla de exfiltración. En MESH el daño es un cambio de estado (cambiar el IBAN), así que conviene usar la variante de Meta (Rule of Two: "change state or communicate externally"). Para cada agente las patas serían:
  - (1) contenido no confiable: el seed lee el correo y cualquiera que reciba un `send_message` derivado de él;
  - (2) datos o sistemas sensibles: `financeTools`, es decir, los datos maestros de proveedores;
  - (3) acción con consecuencias: `issue_refund` o `update_vendor_bank_account` en `apps/api/src/harness/sandbox.ts`.
- **Chequeo determinista por agente** (en `componentChecks()` de `apps/api/src/harness/risk-paths.ts`): `trifecta_local`. El seed tiene (1) pero no (2) ni (3), y finanzas tiene (2) y (3) pero no lee correo, así que pasa. Es la vista "componente por componente".
- **Chequeo por ruta** (en `analyzeRiskPaths()`): `trifectaOnPath = true` cuando la ruta acumula (1) en el origen y (2) y (3) en el destino, sin barrera intermedia. (1) viaja por cada salto `peer_message`, porque el texto del atacante viaja dentro del mensaje. Así la trifecta, que no existe en ningún agente individual, aparece en la ruta. Es la tesis "cada componente pasa su revisión, pero la ruta falla" expresada en el vocabulario que ya usa la comunidad.
- **Detalle de implementación:** `provenance_tag` (`apps/api/src/harness/provenance.ts`) no rompe la trifecta, porque solo informa. La rompería un fix que, viendo la procedencia, bloquee o exija aprobación para la herramienta del sink. Por eso la severidad `low` actual (procedencia y veredicto visibles) debería seguir contando como "trifecta presente, mitigada solo de forma probabilística".
- **Cita para el pitch, sobre `sender_check` (2/6 detectados):** "si 95 % es nota reprobatoria, 33 % lo es más". El argumento a favor de MESH es que analiza la ruta en vez de confiar en un filtro.
