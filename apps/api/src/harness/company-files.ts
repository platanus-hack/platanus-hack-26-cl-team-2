import { nanoid } from "nanoid";
import { getAgent, listAgents, upsertAgent } from "../db/agents-repo.js";
import { getCompanyTxtFiles, saveCompanyTxtFiles, type CompanyTxtFile } from "../db/company-files-repo.js";
import {
  normalizeDemoFilename,
  slugFromFilename,
  syncDemoFiles,
  toolsForDemoFile,
} from "./demo-files.js";

const TXT_TOOL = /_txt_(read|write)$/;

export type CompanyTxtInput = {
  id?: string;
  filename: string;
  content?: string;
  label?: string;
  readAgentIds?: string[];
  writeAgentIds?: string[];
};

function keepIds(ids: string[] | undefined, allowed: Set<string>): string[] {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter((id) => allowed.has(id)))];
}

/** Persist the company's .txt files and put the matching read/write tools on its agents. */
export async function applyCompanyTxtFiles(companyName: string, input: CompanyTxtInput[]): Promise<CompanyTxtFile[]> {
  const name = companyName.trim();
  if (!name) throw new Error("Falta la empresa");
  const roster = (await listAgents()).filter((agent) => agent.orgHints?.companyName?.trim() === name);
  const allowed = new Set(roster.map((agent) => agent.id));
  const usedNames = new Set<string>();
  const usedSlugs = new Set<string>();
  const files: CompanyTxtFile[] = [];

  for (const file of input) {
    let filename: string;
    try {
      filename = normalizeDemoFilename(file.filename);
    } catch {
      throw new Error("El nombre del archivo tiene que ser un .txt simple, sin carpetas.");
    }
    const key = filename.toLowerCase();
    if (usedNames.has(key)) throw new Error(`Archivo repetido: ${filename}`);
    const slug = slugFromFilename(filename);
    if (usedSlugs.has(slug)) throw new Error(`Dos archivos generarían la misma tool: ${filename}`);
    usedNames.add(key);
    usedSlugs.add(slug);
    files.push({
      id: file.id?.trim() || `txt_${nanoid(8)}`,
      filename,
      content: file.content ?? "",
      label: file.label?.trim() || filename,
      readAgentIds: keepIds(file.readAgentIds, allowed),
      writeAgentIds: keepIds(file.writeAgentIds, allowed),
    });
  }

  await saveCompanyTxtFiles(name, files);
  syncDemoFiles(files);

  for (const agent of roster) {
    const tools = new Set(agent.harnessTools.filter((tool) => !TXT_TOOL.test(tool)));
    for (const file of files) {
      const pair = toolsForDemoFile(file.filename);
      if (file.readAgentIds.includes(agent.id)) tools.add(pair.read);
      if (file.writeAgentIds.includes(agent.id)) tools.add(pair.write);
    }
    await upsertAgent(agent, {
      harnessTools: [...tools],
      harnessModel: agent.harnessModel,
      orgHints: agent.orgHints ?? null,
    });
  }
  return files;
}

/** Load this company's files into the tool registry before a run. A company without files is left alone. */
export async function ensureCompanyTxtFiles(companyName: string): Promise<void> {
  const files = await getCompanyTxtFiles(companyName);
  if (files) syncDemoFiles(files);
}

export async function ensureTxtFilesForAgents(agentIds: string[]): Promise<void> {
  const first = agentIds[0] ? await getAgent(agentIds[0]) : null;
  const company = first?.orgHints?.companyName?.trim();
  if (company) await ensureCompanyTxtFiles(company);
}
