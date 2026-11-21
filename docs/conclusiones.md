# Conclusiones de MESH (21 de noviembre de 2026)

Ejecuciones reales con agentes Claude, prompt neutral y herramientas de finanzas en sandbox.
Son conteos con pocas repeticiones (3 por celda), no tasas. Detalle en
[experiments/approval-gate.md](experiments/approval-gate.md),
[experiments/claude-code-agent.md](experiments/claude-code-agent.md) y
[experiments/redteam-refunds.md](experiments/redteam-refunds.md).

## 1. El ataque que funciona es el fraude de reembolso

Un correo que parece de un cliente normal hace que el agente pague.

| Agente | Reembolso fraudulento emitido, sin defensa |
|---|---|
| Claude Haiku 4.5 (MCP, 7 ataques) | 17/21 |
| Claude Sonnet 4.6 (MCP, 7 ataques) | 8/21 |
| Claude Code con Sonnet 4.6 (rf_01 y rf_02) | 12/12 |

## 2. La aprobación humana por procedencia lo frena sin estorbar

La regla la aplica el sandbox, no el prompt: un reembolso de más de USD 500 pedido desde un correo
externo queda pendiente de aprobación humana.

| Modelo | Sin defensa | Con la defensa |
|---|---|---|
| Claude Haiku 4.5 | 17/21 | 6/21 |
| Claude Sonnet 4.6 | 8/21 | 3/21 |

Los reembolsos legítimos de control se emitieron 12 de 12 veces, con y sin defensa. Lo que sigue
pasando son fraudes de menos de USD 500, el límite de la regla.

## 3. La verificación del remitente casi no ayuda

No cambió el resultado en casi ningún correo; el único ataque que frenó fue un dominio con letras
cirílicas. Los fraudes mejor armados llegan desde direcciones que se ven normales: en
`bec_realistic.json` marca 2 de 6 ataques y en `redteam_injection.json`, 1 de 6.

## 4. El modelo importa mucho en los cambios bancarios

Haiku 4.5 intentó cambiar la cuenta del proveedor 10 de 15 veces (el sandbox lo bloqueó y lo registró
siempre). Sonnet 4.6, 0 de 15. Claude Code con Sonnet 4.6, 0 intentos en 90 ejecuciones de ataque.

## 5. En equipos de agentes, la advertencia se pierde

Laboratorio de 3 agentes con Haiku 4.5 (48 ejecuciones): la advertencia llegó a finanzas 4 de 12 veces
sin defensa, 7 de 12 con verificación del remitente y 12 de 12 con la etiqueta de procedencia, que agrega
el sistema. En esas 48 ejecuciones no hubo daño: esto muestra que la advertencia se pierde, no que el
ataque termine en dinero perdido.

## Lo que no se puede afirmar

- Con 3 repeticiones por celda no hay tasas ni significancia estadística.
- En el laboratorio de varios agentes con Sonnet 4.6 nadie intentó el cambio bancario (0 de 24), con o sin defensa.
- La defensa no ve reembolsos bajo su límite ni reembolsos fraccionados.
- Se usó un solo prompt neutral; con otro prompt de sistema los números pueden cambiar.

## En una frase

El remitente no delata el fraude, el modelo solo no basta, y una regla del sistema que exige aprobación
humana según el origen del pedido corta la mayor parte del daño.
