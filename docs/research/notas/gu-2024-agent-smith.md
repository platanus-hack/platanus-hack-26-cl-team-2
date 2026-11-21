# Agent Smith: A Single Image Can Jailbreak One Million Multimodal LLM Agents Exponentially Fast

- **Autores:** Xiangming Gu, Xiaosen Zheng, Tianyu Pang, Chao Du, Qian Liu, Ye Wang, Jing Jiang, Min Lin
- **Año / venue:** 2024, ICML 2024 (campo Comments de arXiv). arXiv v1 13-feb-2024, v2 3-jun-2024.
- **Enlace:** https://arxiv.org/abs/2402.08567
- **PDF local:** ~/papers-ia-safety/multiagente/gu-2024-agent-smith.pdf
- **Verificado:** página arxiv.org/abs/2402.08567 (título, 8 autores, "ICML 2024") y encabezado del PDF v2. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
Presenta el "infectious jailbreak": en un entorno multiagente basta con hacer jailbreak a **un** agente para que la infección se propague a (casi) todos, de forma exponencial, sin que el adversario vuelva a intervenir.
Usan agentes multimodales LLaVA-1.5 con memoria (historial de texto y un álbum de imágenes, como colas FIFO) y RAG sobre el álbum.
La interacción es chat aleatorio por pares (quien pregunta y quien responde) en cada ronda.
El adversario mete una imagen adversaria en el álbum de un solo agente. La imagen está optimizada para que el agente la recupere y la comparta, y para que induzca respuestas dañinas.
Al compartirla en el chat, la imagen pasa al álbum del otro agente, y así sigue la cadena.
Modelan la dinámica como una epidemia, con una tasa de infección β y una tasa de recuperación γ (cuando la imagen sale de la cola de memoria).
Derivan una condición simple para que una defensa sea **demostrablemente** capaz de frenar la propagación: β ≤ 2γ, es decir, recuperar agentes más rápido de lo que se infectan.
Diseñar una defensa práctica que cumpla esa condición queda como pregunta abierta.
Los ataques base, con prompt visual o textual, no logran hacer jailbreak ni siquiera a un solo agente.
Muestran simulaciones de hasta un millón de agentes.

## Ataque o defensa que propone
- Ataque: una imagen adversaria "infecciosa" en la memoria de un agente, que se propaga por chats entre pares.
- Defensa: solo el principio teórico β ≤ 2γ. No implementan ninguna defensa práctica.

## Números que reporta
- Con un millón de agentes LLaVA-1.5, la tasa de infección llega a **~100% tras solo 27-31 rondas de chat** (Fig. 1, abstract).
- Formalización de la Sec. 3 (Ec. 6): con β > 2γ, la fracción infectada tiende a 1 − 2γ/β; con β ≤ 2γ, tiende a 0 para cualquier fracción inicial.
- Los ataques base (VP y TP) "cannot jailbreak any single agent" (Sec. 4).
- Hay más números de sensibilidad (largo de memoria |H| y |B|, ataques de borde o de píxel, N=256) en las figuras y tablas, que no transcribí en detalle.

## Conexión con MESH
- **Valida la dimensión "propagación":** un solo punto de entrada externo puede comprometer a todo el sistema solo a través de interacciones normales entre agentes. Es el caso extremo del nivel `systemic` de `levelOf()` en `apps/api/src/harness/risk-paths.ts`.
- **Diferencia grande y honesta:** Gu usa imágenes adversarias optimizadas con gradientes sobre un modelo abierto, y poblaciones enormes. MESH usa equipos chicos (3-4 agentes) de Claude, texto en lenguaje natural y BEC sin optimización. No es comparable en números. Sirve como marco conceptual, no como evidencia directa.
- **Idea conceptual útil:** la condición β ≤ 2γ se traduce a MESH como "una defensa tiene que bajar la probabilidad de que el pedido sobreviva a cada traspaso".
  - `provenance_tag` actúa sobre "β por salto": cuántos agentes siguen el pedido después de leerlo.
  - Una métrica por salto (cuántas veces el receptor reenvía o ejecuta contra cuántas veces frena), sacada de `observeRiskPaths()`, daría el "β empírico" de MESH con y sin fix.
  - Es más defendible que una sola tasa de éxito final, y conecta con el lenguaje epidemiológico que usan Gu y Lee.
- No recomiendo citarlo como prueba principal en el pitch. Sirve como "la propagación entre agentes ya se mostró a escala; MESH la mide en un flujo empresarial real".
