import type { AreaId, Motivation, Proactivity, Seniority } from "@sandbox/shared";

/**
 * Spanish DISPLAY labels for the web UI only.
 * The agents' personas and system prompts are built in packages/shared from the
 * English prototypes; these strings never reach a model, so changing them does not
 * change the experiment.
 */
export const AREA_LABELS: Record<AreaId, string> = {
  gtm: "Comercial (Ventas)",
  csm: "Éxito del cliente (CSM)",
  cs: "Soporte al cliente",
  engineering: "Ingeniería",
  product_design: "Producto y diseño",
  data: "Datos",
  it: "TI",
  finance: "Finanzas",
};

export const AREA_TEXT: Record<AreaId, { purpose: string; how: string; why: string }> = {
  gtm: {
    purpose: "Genera oportunidades y cierra ventas mediante prospección, demostraciones, negociación y un seguimiento ordenado.",
    how: "Trabaja prospectos y oportunidades, califica el encaje, hace descubrimiento y demos, coordina objeciones con Producto y Soporte, y mantiene el CRM al día.",
    why: "Sin un proceso comercial disciplinado, el crecimiento se estanca y las proyecciones dejan de ser reales.",
  },
  csm: {
    purpose: "Impulsa la adopción, la renovación y la expansión, a cargo de la relación con el cliente después de la venta.",
    how: "Hace revisiones trimestrales, sigue la salud de las cuentas, escala brechas de producto y coordina los riesgos con Soporte.",
    why: "La retención y la expansión sostienen el crecimiento; perder clientes destruye el retorno de la inversión comercial.",
  },
  cs: {
    purpose: "Resuelve rápido los problemas de los clientes y recoge señales para mejorar el producto y los procesos.",
    how: "Clasifica tickets por severidad, sigue los procedimientos, escala con contexto a Ingeniería o CSM y cierra el ciclo con el cliente.",
    why: "Un mal soporte quema la confianza; uno bueno convierte los problemas en retención y aprendizaje de producto.",
  },
  engineering: {
    purpose: "Diseña, construye y entrega software confiable que aporta valor sin generar deuda operativa.",
    how: "Trabaja desde tickets y propuestas técnicas, divide el trabajo en cambios revisables, revisa código y coordina riesgos con Producto, TI y Datos.",
    why: "Protege la velocidad de entrega y la integridad de los sistemas: un mal cambio termina en caídas, pérdida de datos o daño a clientes.",
  },
  product_design: {
    purpose: "Define qué construir y por qué: resultados, experiencia de usuario, prioridades y especificaciones claras para Ingeniería.",
    how: "Descubre problemas de usuarios, redacta requisitos y flujos, prioriza el backlog, valida con clientes y negocia el alcance con Ingeniería y Ventas.",
    why: "Construir lo equivocado consume capacidad de Ingeniería y confunde el discurso de Ventas y Soporte.",
  },
  data: {
    purpose: "Prepara a la empresa para decidir con métricas, flujos de datos y análisis confiables.",
    how: "Define las métricas, construye flujos y tableros, investiga anomalías y acompaña a Producto, Ventas y Soporte en la medición.",
    why: "Los malos datos dan una confianza falsa: los equipos optimizan el número equivocado.",
  },
  it: {
    purpose: "Mantiene a las personas productivas y los sistemas seguros: accesos, equipos, aplicaciones y herramientas internas.",
    how: "Crea cuentas, aplica la política de accesos, atiende incidentes y coordina con Ingeniería los controles de cambios.",
    why: "Un error de acceso o una caída de herramientas detiene a toda la empresa.",
  },
  finance: {
    purpose: "Protege la caja, paga correctamente a proveedores y solo ejecuta reembolsos y cambios de cuenta con autorización clara y registro.",
    how: "Revisa pagos y reembolsos contra la política, verifica contrapartes, coordina disputas con Soporte, CSM y TI, y rechaza movimientos irreversibles sin evidencia.",
    why: "Un solo cambio de cuenta bancaria o reembolso indebido puede causar pérdidas directas y fraude; Finanzas es el último control antes de mover dinero.",
  },
};

export const SENIORITY_LABELS: Record<Seniority, string> = {
  junior: "Inicial",
  mid: "Intermedio",
  senior: "Avanzado",
  staff: "Especialista",
};

export const MOTIVATION_LABELS: Record<Motivation, string> = {
  quality: "Calidad",
  speed: "Rapidez",
  compliance: "Cumplimiento",
  impact: "Impacto",
  recognition: "Reconocimiento",
};

export const PROACTIVITY_LABELS: Record<Proactivity, string> = {
  low: "Proactividad baja",
  medium: "Proactividad media",
  high: "Proactividad alta",
};

/** Area label for any string id (falls back to the raw value for unknown ids). */
export function areaLabel(id: string): string {
  return (AREA_LABELS as Record<string, string>)[id] ?? id;
}
