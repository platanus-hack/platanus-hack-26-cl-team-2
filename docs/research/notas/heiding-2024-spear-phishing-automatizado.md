# Evaluating Large Language Models' Capability to Launch Fully Automated Spear Phishing Campaigns: Validated on Human Subjects

- **Autores:** Fred Heiding, Simon Lermen, Andrew Kao, Bruce Schneier, Arun Vishwanath (Harvard Kennedy School, independiente y Avant Research Group)
- **Año / venue:** 2024, preprint en arXiv (cs.CR), arXiv:2412.00586v1, 30-11-2024. Según búsquedas hay una versión en un workshop de ICML 2025 y otra en Expert Systems with Applications (2026) con un título algo distinto. Ninguna de las dos la verifiqué.
- **Enlace:** https://arxiv.org/abs/2412.00586
- **PDF local:** ~/papers-ia-safety/bec-y-patrones/heiding-2024-spear-phishing.pdf
- **Verificado:** abstract en arxiv.org, más título, autores y cifras leídos en el PDF descargado de arxiv.org/pdf/2412.00586 (abstract y §1, pp. 1-2). · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
El paper mide si un LLM puede montar solo una campaña de spear phishing completa, desde investigar a la víctima hasta enviarle el correo.
Construyeron una herramienta que busca información pública de cada objetivo, arma un "perfil de vulnerabilidad" y escribe el correo personalizado.
La probaron con 101 participantes reales, con aprobación ética, repartidos en cuatro grupos.
Grupos: phishing genérico (control), correos escritos por expertos humanos, correos 100 % automatizados con IA y correos de IA con revisión humana.
Los correos automatizados lograron la misma tasa de clics que los de expertos humanos.
Según los autores, un año antes los modelos necesitaban un humano en el ciclo para igualar a los expertos. Eso ya no hace falta.
La información que reunió la IA sobre cada persona fue precisa y útil en la gran mayoría de los casos.
También evaluaron LLM como detectores, y les fue bastante mejor cuando se les pide explícitamente sospechar.
Hacen un análisis económico: la IA abarata mucho el phishing personalizado a gran escala.
Concluyen que hacen falta nuevas defensas, porque la calidad del texto ya no delata al atacante.

## Ataque o defensa que propone
- **Ataque:** una cadena completamente automatizada: OSINT (GPT-4o con búsqueda web), perfil, correo personalizado escrito con GPT-4o o Claude 3.5 Sonnet, envío y seguimiento de clics.
- **Defensa:** usar LLM para detectar la intención del correo. Probaron Claude 3.5 Sonnet, GPT-4o, Mistral, Llama 3.1 y Gemini. El hallazgo principal es "priming for suspicion": preguntar si el correo es sospechoso, en vez de preguntar qué intenta, mejora la detección sin subir los falsos positivos.

## Números que reporta
- **Tasa de clics** (abstract y §1, p. 1): control 12 %, expertos humanos 54 %, IA totalmente automatizada 54 %, IA con humano en el ciclo 56 %. "350 % mejor que el control".
- **Perfiles OSINT:** precisos y útiles en el **88 %** de los casos; inexactos solo en el 4 % (abstract, p. 1).
- **Detección:** Claude 3.5 Sonnet detectó **el 97,25 %** de 363 correos de phishing **sin falsos positivos** en un conjunto de 381 (18 legítimos) (§1, p. 2). En la prueba inicial de 20 correos detectó el 100 %.
- **Economía:** la IA puede hacer el phishing "hasta 50 veces" más rentable en audiencias grandes (abstract y §6).
- **Muestra:** 101 participantes en total.

## Conexión con MESH
- **Valida la premisa del escenario:** los correos de `email-harness/scenarios/bec_realistic.json` están bien escritos, en español e inglés, y personalizados (con número de factura, OC y nombre del contacto). Según Heiding et al., un atacante con IA produce ese nivel de calidad a costo casi nulo, así que "el correo se ve mal" ya no sirve como defensa.
- **Explica por qué `sender_check` no basta:** `apps/api/src/email/sender-check.ts` solo mira la línea `From:` (freemail, subdominios falsos, marcas en el nombre). Un atacante automatizado elige dominios parecidos o buzones comprometidos (bec_01, bec_03), que no disparan esas reglas. Por eso detecta 2 de 6.
- **Idea, un fix probabilístico comparable:** agregar a `apps/api/src/harness/fixes.ts` un fix `llm_screen` que pida a un modelo un veredicto con el prompt "¿es sospechoso?" (el priming del paper) y que viaje en el `provenanceTag` (`apps/api/src/harness/provenance.ts`) igual que hoy viaja `senderCheck`. Métrica: detección sobre los 6 ataques y falsos positivos sobre los 2 benignos, puesta al lado del 2/6 de `sender_check`. Hay que dejar claro en la demo que es probabilístico (ver la nota de Willison: "95 % es nota reprobatoria").
- **Mensaje para el pitch:** "la IA ya escribe phishing tan bien como un experto (54 % vs 54 % de clics). Lo que MESH revisa es qué pasa cuando el que lee ese correo es otro agente."
