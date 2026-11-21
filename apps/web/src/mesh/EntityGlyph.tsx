export function EntityGlyph({ kind }: { kind: string }) {
  return <g className="entity-glyph" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {kind === "agent" ? <><rect x="-16" y="-12" width="32" height="25" rx="8" /><path d="M0 -12v-7m-5 0h10M-21 -4v10m42 -10v10M-6 7H6" /><circle cx="-6" cy="-2" r="2" /><circle cx="6" cy="-2" r="2" /></> : kind === "person" ? <><circle cy="-8" r="8" /><path d="M-16 16c0-18 32-18 32 0" /></> : kind === "external" ? <><rect x="-18" y="-12" width="36" height="26" rx="5" /><path d="m-16 -9 16 12L16 -9" /></> : <><ellipse cy="-12" rx="16" ry="6" /><path d="M-16 -12v25c0 8 32 8 32 0v-25M-16 0c0 8 32 8 32 0" /></>}
  </g>;
}
