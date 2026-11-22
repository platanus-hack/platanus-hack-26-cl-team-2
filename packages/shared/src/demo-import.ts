export type DemoImport = {
  companyName: string;
  context: string;
  agents: Array<{ name: string; prompt: string }>;
  files: Array<{ filename: string; content: string; label: string; readAgentNames: string[]; writeAgentNames: string[] }>;
};

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field}: debe ser un objeto.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string, max: number, required = true): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error(`${field}: debe ser texto${required ? " no vacío" : ""} de hasta ${max} caracteres.`);
  return value;
}

export function parseDemoImport(text: string): DemoImport {
  let json: unknown;
  try { json = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error("El archivo no contiene JSON válido. Revisa comillas, comas y llaves."); }
  const data = record(json, "Documento");
  const companyName = string(data.companyName ?? "Empresa DEMO", "companyName", 120);
  const context = string(data.context, "context", 20000);
  if (!Array.isArray(data.agents) || data.agents.length < 1 || data.agents.length > 24) throw new Error("agents: incluye entre 1 y 24 agentes con name y prompt.");
  const names = new Set<string>();
  const agents = data.agents.map((value, index) => {
    const agent = record(value, `agents[${index}]`);
    const name = string(agent.name, `agents[${index}].name`, 64).trim();
    const prompt = string(agent.prompt, `agents[${index}].prompt`, 12000);
    if (names.has(name.toLowerCase())) throw new Error(`Nombre de agente duplicado: ${name}.`);
    names.add(name.toLowerCase());
    return { name, prompt };
  });
  const fileValues = data.files ?? [];
  if (!Array.isArray(fileValues) || fileValues.length > 24) throw new Error("files: debe ser una lista de hasta 24 archivos.");
  const filenames = new Set<string>();
  const files = fileValues.map((value, index) => {
    const file = record(value, `files[${index}]`);
    const filename = string(file.filename, `files[${index}].filename`, 120).trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.txt$/i.test(filename)) throw new Error(`${filename}: usa un nombre .txt sin carpetas ni espacios.`);
    if (filenames.has(filename.toLowerCase())) throw new Error(`Archivo duplicado: ${filename}.`);
    filenames.add(filename.toLowerCase());
    function access(field: "readAgentNames" | "writeAgentNames") {
      const entries = file[field] ?? [];
      if (!Array.isArray(entries) || entries.length > 24) throw new Error(`${filename}.${field}: debe ser una lista de hasta 24 nombres.`);
      return [...new Set(entries.map(entry => {
        const name = string(entry, `${filename}.${field}`, 64).trim();
        const canonical = agents.find(agent => agent.name.toLowerCase() === name.toLowerCase());
        if (!canonical) throw new Error(`${filename}.${field}: el agente «${name}» no existe en agents.`);
        return canonical.name;
      }))];
    }
    return { filename, content: string(file.content, `${filename}.content`, 200000, false), label: string(file.label ?? filename, `${filename}.label`, 120, false), readAgentNames: access("readAgentNames"), writeAgentNames: access("writeAgentNames") };
  });
  return { companyName, context, agents, files };
}

export const DEMO_IMPORT_TEMPLATE: DemoImport = {
  companyName: "NexusB1",
  context: "Empresa ficticia que conecta SAP Business One con tiendas digitales. Usa únicamente datos sintéticos en esta demo.",
  agents: [
    { name: "Soporte", prompt: "Diagnostica tickets y consulta a Implementación cuando necesites revisar un conector." },
    { name: "Implementación", prompt: "Revisa la configuración de conectores y responde las consultas de Soporte." },
  ],
  files: [{ filename: "conectores.txt", label: "Conectores de prueba", content: "Cliente DEMO-001: Shopify → SAP B1; estado: prueba.", readAgentNames: ["Soporte", "Implementación"], writeAgentNames: ["Implementación"] }],
};
