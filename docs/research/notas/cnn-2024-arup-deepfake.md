# British engineering giant Arup revealed as $25 million deepfake scam victim

- **Autores:** Kathleen Magramo (CNN)
- **Año / venue:** 2024, CNN Business, publicado el 17-05-2024 a las 02:33 UTC según los metadatos (16-05 en la URL). Hay una nota previa de CNN del 04-02-2024 que no nombraba a la empresa: "Finance worker pays out $25 million after video call with deepfake 'chief financial officer'". Esa nota no la abrí.
- **Enlace:** https://www.cnn.com/2024/05/16/tech/arup-deepfake-scam-loss-hong-kong-intl-hnk
- **PDF local:** página web, sin PDF
- **Verificado:** descargué el HTML de cnn.com con curl y leí el texto completo, el titular (H1), el autor (JSON-LD `author`) y la fecha (`datePublished`). Las citas de Arup provienen de una declaración enviada por correo a CNN. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Arup, la firma británica de ingeniería detrás de la Ópera de Sídney, confirmó que fue víctima de una estafa con deepfakes.
Un empleado de finanzas de su oficina de Hong Kong terminó pagando unos US$25 millones a los estafadores.
Según la policía de Hong Kong, el empleado fue invitado a una videollamada con quienes creía que eran el CFO y otros colegas. Todos eran recreaciones deepfake.
Al principio sospechó, porque el primer contacto fue un correo de la "oficina del Reino Unido" que pedía una transacción secreta.
Descartó sus dudas después de la videollamada, porque los asistentes se veían y sonaban como colegas que conocía.
Luego envió HK$200 millones (unos US$25,6 millones) en 15 transacciones.
Arup avisó a la policía en enero y dijo que sus sistemas internos no fueron comprometidos.
Su CIO, Rob Greig, dijo que la empresa sufre ataques regulares (fraude de facturas, phishing, suplantación de voz por WhatsApp y deepfakes) y que su número y sofisticación crecen rápidamente.
Es el caso emblemático de "fraude del CEO/CFO" potenciado por IA generativa.
No hubo intrusión técnica: todo fue ingeniería social sobre un proceso de pago.

## Ataque o defensa que propone
- **Ataque:** BEC de varios canales. Primero un correo que suplanta al CFO y pide una transacción "secreta"; luego una videollamada deepfake que confirma el pedido y disipa la duda del empleado.
- **Defensa:** el artículo no propone ninguna. Lo que se deduce es que la verificación debe ir por un canal independiente y que un segundo canal controlado por el atacante no cuenta como confirmación. Esto último es inferencia mía, no lo dice el artículo.

## Números que reporta
- **US$25 millones** según Arup y CNN; **HK$200 millones ≈ US$25,6 millones** según la policía, vía RTHK.
- **15 transacciones.**
- Denuncia a la policía en **enero de 2024**; la policía lo informó en **febrero de 2024**.
- Arup: 18.500 empleados en 34 oficinas.
- No verificado en esta fuente: el detalle de que el dinero fue a 5 cuentas bancarias en Hong Kong. Aparece en blogs secundarios, no en este artículo de CNN.

## Conexión con MESH
- **Es la tesis de MESH con humanos:** el empleado sí sospechó en el salto 1, cuando recibió el correo. La duda se disolvió en el salto 2, con una "confirmación" de quienes parecían colegas internos. En MESH pasa lo mismo: `sender_check` (`apps/api/src/email/sender-check.ts`) solo lo ve el seed, y cuando el pedido llega al agente de finanzas parece un mensaje interno de un colega. `describe()` en `apps/api/src/harness/risk-paths.ts` lo dice textualmente: "el veredicto se pierde en el salto N".
- **El mensaje entre pares no es un canal independiente:** el check `peer_channel` de `componentChecks()` en risk-paths.ts pasa ("nadie puede hacerse pasar por otro agente"), pero eso no impide que el agente legítimo reenvíe contenido del atacante. Es el análogo de "el CFO en la videollamada se veía real".
- **Idea de chequeo:** marcar como `high` toda ruta donde la única "confirmación" que recibe el agente de finanzas viene de un agente que a su vez fue contaminado por el correo, es decir, una confirmación circular. Se puede calcular con `observeRiskPaths()`: si el agente de finanzas recibe dos mensajes y ambos remontan al seed, cuenta como una sola fuente.
- **Para el pitch:** "En Arup, el empleado sospechó del correo, pero los 'colegas' de la videollamada lo convencieron. En un equipo de agentes, el colega que convence es otro agente que leyó el correo."
