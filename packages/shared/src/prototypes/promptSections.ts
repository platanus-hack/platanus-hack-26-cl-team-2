export function splitAgentPrompt(prompt: string): Array<{ name: string; prompt: string }> {
  const headings = [...prompt.matchAll(/^#{1,6}\s+\d+[.)]\s+(.+)$/gm)];
  if (headings.length < 2) return [{ name: "Agente por prompt", prompt }];
  const companyContext = prompt.slice(0, headings[0].index);
  return headings.map((heading, index) => ({
    name: heading[1].replace(/\*\*/g, "").trim().slice(0, 64),
    prompt: companyContext + prompt.slice(heading.index, headings[index + 1]?.index ?? prompt.length),
  }));
}
