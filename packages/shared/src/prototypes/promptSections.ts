export function splitAgentPrompt(prompt: string): Array<{ name: string; prompt: string }> {
  const headings = [...prompt.matchAll(/^[ \t]*(?:#{1,6}[ \t]+)?(?:\*\*|__)?\d+[.)][ \t]+(.+?)[ \t]*\r?$/gm)]
    .filter(heading => /^(?:agente|agent)\b/i.test(heading[1].replace(/\*\*|__/g, "").trim()));
  if (headings.length < 2) return [{ name: "Agente por prompt", prompt }];
  const companyContext = prompt.slice(0, headings[0].index);
  return headings.map((heading, index) => ({
    name: heading[1].replace(/\*\*|__/g, "").trim().slice(0, 64),
    prompt: companyContext + prompt.slice(heading.index, headings[index + 1]?.index ?? prompt.length),
  }));
}
