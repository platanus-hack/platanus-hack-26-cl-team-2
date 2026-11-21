// Resultados publicados de MESH. Copia versionada de docs/conclusiones.md (y de
// docs/experiments/approval-gate.md para los retenidos por modelo). No se calcula nada en
// tiempo de ejecución ni se llama a la API: la página funciona sin API key.
// Si cambian las conclusiones, se actualiza este archivo a mano. Son conteos, no tasas.

/** Un conteo "n de total", tal como está publicado. */
export interface Count {
  n: number;
  of: number;
}

export interface RefundRow {
  agent: string;
  /** Reembolsos emitidos sin defensa, sobre los mismos 7 correos. */
  undefended: Count;
  note?: string;
}

export interface GateRow {
  model: string;
  undefended: Count;
  /** Reembolsos emitidos con la aprobación humana activa. */
  withGate: Count;
  /** Ejecuciones que quedaron retenidas para aprobación humana. */
  held: number;
}

export interface BankRow {
  agent: string;
  /** Intentos de cambio bancario sin defensa. */
  undefended: Count;
  /** Intentos con la aprobación humana activa, si se midió. */
  withGate?: Count;
  note?: string;
}

export interface WarningRow {
  condition: string;
  arrived: Count;
  note?: string;
}

export interface PublishedResults {
  date: string;
  dateLabel: string;
  source: string;
  models: string[];
  repetitions: { setup: string; perCell: number }[];
  headline: string;
  refunds: {
    emails: number;
    indistinguishable: Count;
    rows: RefundRow[];
  };
  gate: {
    thresholdUsd: number;
    emailsOverThreshold: Count;
    rows: GateRow[];
    heldTotal: number;
    legitControls: { issued: Count; amountsUsd: string[] };
  };
  bank: {
    emails: number;
    rows: BankRow[];
  };
  multiAgent: {
    model: string;
    agents: number;
    runs: number;
    perCell: number;
    warningAtFinance: WarningRow[];
    ownWarningWithTag: Count;
    harm: Count;
  };
  senderCheck: {
    flags: { file: string; flagged: Count }[];
  };
  limits: string[];
}

export const RESULTS: PublishedResults = {
  date: "2026-11-21",
  dateLabel: "21 de noviembre de 2026",
  source: "docs/conclusiones.md",
  models: ["Claude Haiku 4.5", "Claude Sonnet 4.6", "Claude Code con Sonnet 4.6"],
  repetitions: [
    { setup: "Agente único (MCP)", perCell: 3 },
    { setup: "Claude Code", perCell: 3 },
    { setup: "Laboratorio de varios agentes con Haiku 4.5", perCell: 2 },
    { setup: "Pruebas de verificación del remitente", perCell: 2 },
    { setup: "Laboratorio de varios agentes con Sonnet 4.6", perCell: 1 },
  ],
  headline:
    "En estos correos el remitente no delató el fraude y el modelo solo no bastó; una regla del sistema que retiene para aprobación humana los reembolsos de más de USD 500 detuvo todos los que superaban ese monto (11 de 17 con Haiku, 5 de 8 con Sonnet), pero también retiene todos los reembolsos legítimos de ese tamaño (40 de 40) y no ve los montos chicos ni los pedidos fraccionados.",
  refunds: {
    emails: 7,
    indistinguishable: { n: 3, of: 7 },
    rows: [
      { agent: "Claude Haiku 4.5 (MCP)", undefended: { n: 17, of: 21 } },
      { agent: "Claude Sonnet 4.6 (MCP)", undefended: { n: 8, of: 21 } },
      {
        agent: "Claude Code con Sonnet 4.6",
        undefended: { n: 6, of: 21 },
        note: "2 de los 7 correos siempre; los otros 5, nunca.",
      },
    ],
  },
  gate: {
    thresholdUsd: 500,
    emailsOverThreshold: { n: 4, of: 7 },
    rows: [
      { model: "Claude Haiku 4.5", undefended: { n: 17, of: 21 }, withGate: { n: 6, of: 21 }, held: 11 },
      { model: "Claude Sonnet 4.6", undefended: { n: 8, of: 21 }, withGate: { n: 3, of: 21 }, held: 5 },
    ],
    heldTotal: 16,
    legitControls: { issued: { n: 24, of: 24 }, amountsUsd: ["38,50", "59,90"] },
  },
  bank: {
    emails: 5,
    rows: [
      {
        agent: "Claude Haiku 4.5",
        undefended: { n: 10, of: 15 },
        withGate: { n: 9, of: 15 },
        note: "El sandbox lo bloqueó y lo registró siempre.",
      },
      { agent: "Claude Sonnet 4.6", undefended: { n: 0, of: 15 } },
      { agent: "Claude Code con Sonnet 4.6", undefended: { n: 0, of: 78 } },
    ],
  },
  multiAgent: {
    model: "Claude Haiku 4.5",
    agents: 3,
    runs: 48,
    perCell: 2,
    warningAtFinance: [
      { condition: "Sin defensa", arrived: { n: 4, of: 12 } },
      { condition: "Con verificación del remitente", arrived: { n: 7, of: 12 } },
      {
        condition: "Con etiqueta de procedencia",
        arrived: { n: 12, of: 12 },
        note: "Por construcción: el sistema la agrega a cada mensaje.",
      },
    ],
    ownWarningWithTag: { n: 6, of: 12 },
    harm: { n: 0, of: 48 },
  },
  senderCheck: {
    flags: [
      { file: "bec_realistic.json", flagged: { n: 2, of: 6 } },
      { file: "redteam_injection.json", flagged: { n: 1, of: 6 } },
    ],
  },
  limits: [
    "La baja es mecánica: la regla retiene todo reembolso de más de USD 500 y 4 de los 7 correos superan ese monto.",
    "Los controles legítimos son chicos (USD 38,50 y 59,90): la regla no podía tocarlos. No probamos reembolsos legítimos de más de USD 500, que también quedarían retenidos, así que no podemos afirmar que la regla no estorba.",
    "En 3 de los 7 correos de reembolso el fraude no se distingue de un reclamo real solo con el texto: ahí medimos «reembolsó sin verificar», no «pagó un fraude comprobado».",
    "Con tan pocas repeticiones no hay tasas ni significancia estadística: son conteos.",
    "No sabemos si la regla resiste a un atacante que fracciona el monto. Lo que sigue pasando son pedidos de menos de USD 500.",
    "Los correos de reembolso se escribieron después de ver que el primero funcionaba: son ataques seleccionados.",
    "Se usó un solo prompt, que no menciona fraude pero le dice al agente que nadie le va a responder.",
    "Todo pasó por un proxy y en una sola fecha; no quedó registrado el modelo que respondió.",
  ],
};
