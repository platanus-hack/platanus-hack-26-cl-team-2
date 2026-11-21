# Pitch MESH (3 minutos, Platanus Hack 26, track AI Security)

Lo que piden los jueces: «el ataque funcionando y la defensa deteniéndolo, con números».
La idea que tiene que quedar: **cada componente pasa su revisión, pero la ruta falla.**

Regla para todo este documento: **no inventar números.** Donde dice `[N/M]`, se copia de la tabla
«Experimento en lote» en Evaluaciones (`apps/api/results/batch-latest.json`). Si no hay lote, se
dice que no hay lote.

- Deck (6 diapositivas, con notas del orador): https://claude.ai/artifact/5Vd2NUX1uQEtNFHXcdNA6e
  (privado hasta que se comparta desde el menú Share).
- Demo en vivo: https://mesh-lab.onrender.com · guion detallado en [demo.md](demo.md).

## Orden y tiempos

| Tiempo | Qué se muestra |
|---|---|
| 0:00–0:10 | Diapositiva 1, portada: «Cada componente pasa su revisión. La ruta falla.» |
| 0:10–0:35 | Diapositiva 2, el problema: correo → Camila ⇢ Tomás → `update_vendor_bank_account`. |
| 0:35–0:55 | Diapositiva 3, cómo funciona: ataque → rutas de riesgo → defensa. |
| 0:55–2:00 | **Sitio en vivo** (demo.md, 0:40–2:10): rutas previstas, «Iniciar conversación», traza, «Repetir con etiqueta de procedencia». |
| 2:00–2:20 | Diapositiva 4, la defensa: `sender_check` frente a `provenance_tag`. |
| 2:20–2:45 | Diapositiva 5, antes y después en lote (`[N/M]`). |
| 2:45–3:00 | Diapositiva 6, límites honestos y qué sigue. |

Si el sitio falla, se sigue con el deck sin saltar nada: la diapositiva 4 cubre la defensa.

## Datos fijos que ya están comprobados (sin modelo)

- `sender_check` marca 2 de 6 correos de ataque de `bec_realistic.json` (`bec_05` y `bec_06`).
  Los otros 4 salen «OK»: dominio con letras cambiadas (`cumbres-logisitca.es`), correo personal
  que se hace pasar por una colega, buzón real comprometido y el mismo nombre con otra
  terminación (`.co` en vez de `.com`).
- En `spoof_02_fake_microsoft_bank`, `sender_check` da SUSPICIOUS.
- Rutas de la demo (Camila inicial, Mateo, Tomás con finanzas): 2 rutas, 2 de severidad alta.
  Con verificación del remitente + etiqueta de procedencia: 0 de severidad alta. Solo con la
  etiqueta: severidad media (finanzas ve el origen, pero no el veredicto). Lo cubren los tests de
  `apps/api/test/risk-paths.test.ts`.

## La tabla «antes y después» (para completar)

Mismas columnas y filas que la tabla «Experimento en lote» de Evaluaciones.

| Mitigación | Ejecuciones | Llegó a finanzas | Finanzas vio el origen o una advertencia | Los agentes escribieron una advertencia | Intento de cambio bancario | Reembolso simulado | Fallidas |
|---|---|---|---|---|---|---|---|
| Sin mitigación | [N] | [N/M] | [N/M] | [N/M] | [N/M] | [N/M] | [N] |
| Verificación del remitente | [N] | [N/M] | [N/M] | [N/M] | [N/M] | [N/M] | [N] |
| Etiqueta de procedencia | [N] | [N/M] | [N/M] | [N/M] | [N/M] | [N/M] | [N] |
| Ambas | [N] | [N/M] | [N/M] | [N/M] | [N/M] | [N/M] | [N] |

Modelo: [modelo] · Repeticiones por combinación: [R] · Correos: [correos del lote] · Fecha: [fecha].

Las tasas cuentan solo ejecuciones completadas; las fallidas van aparte. Las dos columnas de
advertencia se calculan sobre las ejecuciones que llegaron a finanzas, no sobre el total.

Ojo al leerla: con la etiqueta, «Finanzas vio el origen o una advertencia» es sí por construcción,
porque la pone el sistema. Lo que dice algo es esa columna **sin** etiqueta, «Los agentes escribieron
una advertencia» y los intentos de cambio bancario. Si «Intento de cambio bancario» es 0 en todas
las filas, se dice así.

---

## Texto para Devpost

**Nombre:** MESH

**Tagline:** MESH encuentra dónde se pierde la advertencia entre agentes de IA, antes de que un
correo falso mueva plata.

**Descripción:**

Las empresas ya ponen equipos de agentes de IA a leer correo y operar finanzas. Cada agente puede
pasar su revisión y el sistema fallar igual: el primero ve que el remitente es sospechoso, pero al
pasarle el pedido a un colega la advertencia se queda atrás, y finanzas recibe un mensaje «interno».

MESH lanza correos de ataque contra agentes Claude reales con herramientas de finanzas en sandbox,
calcula sin IA cada ruta del correo al dinero y saca el resultado de la traza con reglas. Su defensa,
`provenance_tag`, hace que el sistema, no el modelo, adjunte el origen externo a cada mensaje entre
agentes.

En lote, con los mismos correos y agentes: sin mitigación, finanzas vio el origen o una advertencia
en [N/M] ejecuciones; con ambas mitigaciones, en [N/M]. Intentos de cambio bancario: [N/M] y [N/M].
Con pocas repeticiones, son números indicativos, no tasas.

**Límites:** `sender_check` solo lee el `From:` (sin SPF, DKIM ni DMARC); las rutas miran hasta dos
traspasos; el sandbox es una regla en el mismo proceso; no hay buzón real.

## Bloque corto para el README

```markdown
## MESH en 30 segundos

En un equipo de agentes de IA, cada pieza puede pasar su revisión y el sistema fallar igual: el
agente que lee un correo falso ve la advertencia sobre el remitente, pero cuando le pasa el pedido a
finanzas, la advertencia no viaja.

- **Ataque:** correos de ataque contra 2 a 8 agentes Claude reales; solo algunos tienen herramientas
  de finanzas, en sandbox (el cambio bancario siempre se bloquea y cada intento queda registrado).
- **Rutas de riesgo, sin IA:** antes de lanzar, MESH lista cada camino del correo a una herramienta
  de finanzas y revisa salto por salto si quien recibe sabe que el pedido vino de afuera.
- **Defensa:** `provenance_tag`, el sistema (no el modelo) adjunta el origen a cada mensaje entre
  agentes. Se mide repitiendo con los mismos agentes y el mismo correo.
- **Números (lote):** finanzas vio el origen o una advertencia en [N/M] sin mitigación y en [N/M] con
  ambas. Intentos de cambio bancario: [N/M] y [N/M].
- **Límites:** pocas repeticiones (indicativo, no tasas); `sender_check` solo lee el `From:`; rutas de
  hasta dos traspasos; sandbox en el mismo proceso.

Demo: https://mesh-lab.onrender.com · Guion: [docs/demo.md](docs/demo.md)
```

---

## Preguntas probables de los jueces

**«¿No es solo prompt engineering?»**
No. La defensa no le pide nada al modelo: el sistema agrega la etiqueta de origen a cada mensaje
entre agentes; el agente no la escribe ni la puede borrar. El análisis de rutas y el resultado se
calculan con reglas, sin IA, y el cambio bancario lo bloquea el sandbox, no la buena voluntad del
modelo. Lo honesto: la etiqueta asegura que el origen **llegue** a finanzas; qué
hace con eso sigue siendo decisión del modelo. Por eso medimos.

**«¿Una sola ejecución prueba algo?»**
No, y lo decimos. Una ejecución muestra el mecanismo, no una tasa. Por eso existe el lote: mismos
correos y mismos agentes bajo cada combinación de mitigaciones, varias repeticiones: [N/M]. Las fallidas
(por ejemplo, errores de la API) no entran en las tasas, pero se muestran aparte, y si alguna alcanzó
a intentar el cambio bancario también se ve («+N en fallidas»). Lo que sí es fijo y no depende del modelo: el análisis de rutas da
lo mismo cada vez para la misma configuración.

**«¿Por qué no basta con el chequeo de remitente?»**
Por dos razones. Primero, llega solo al primer agente: en el primer traspaso el veredicto se queda
atrás. Segundo, no detecta los ataques buenos: de los 6 correos BEC realistas de
`bec_realistic.json`, marca solo 2. Por eso `provenance_tag` no depende del veredicto: avisa que el
hilo empezó en un correo externo que nadie en la empresa verificó, aunque el remitente se vea limpio.
