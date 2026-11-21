export function splitAgentPrompt(prompt: string): Array<{ name: string; prompt: string }> {
  const headings = [...prompt.matchAll(/(?:#{1,6}[ \t]+)?(?:\*\*|__)?\b\d{1,2}[.)][ \t]*(?:\*\*|__)?(?:agente|agent)\b/gi)];
  if (headings.length < 2) return [{ name: "Agente por prompt", prompt }];
  const companyContext = prompt.slice(0, headings[0].index);
  return headings.map((heading, index) => {
    const section = prompt.slice(heading.index, headings[index + 1]?.index ?? prompt.length);
    const titleStart = heading[0].search(/agente|agent/i);
    const title = section.slice(titleStart).split(/\r?\n|(?:\*\*|__)?(?:área|area|rol|role)\s*(?:\*\*|__)?\s*:/i)[0];
    return {
      name: title.replace(/\*\*|__/g, "").trim().slice(0, 64),
      prompt: companyContext + section,
    };
  });
}
