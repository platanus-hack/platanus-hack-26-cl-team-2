import { useState, type MouseEvent } from "react";
import type { FlowGraph } from "@sandbox/shared";
import type { CompanyTxtFile } from "../api";
import { EntityGlyph } from "./EntityGlyph";

export type FlowLive =
  | { kind: "flow"; fromAgentId: string; toAgentId: string }
  | { kind: "file"; agentId: string; slug: string };

type Props = { graph: FlowGraph; files?: CompanyTxtFile[]; live?: FlowLive | null };

type Point = { x: number; y: number };

const WIDTH = 1280;
const HEIGHT = 1120;
const CX = 640;
const CY = 560;
const NODE_R = 188;
const NODE_DISC = 48;
const NODE_RIM = NODE_DISC;

function polar(angle: number, radius: number): Point {
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

function nudge(center: Point, toward: Point, dist: number): Point {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: center.x + (dx / len) * dist, y: center.y + (dy / len) * dist };
}

type Drawn = { d: string; points: Point[] };

/** Short hop around the outside of the circle. The return trip uses a wider ring. */
function exteriorPath(fromAngle: number, toAngle: number, clockwise: boolean, laneRadius: number): Drawn {
  const tau = Math.PI * 2;
  const span = clockwise
    ? (toAngle - fromAngle + tau) % tau || tau
    : (fromAngle - toAngle + tau) % tau || tau;
  const steps = 28;
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = clockwise ? fromAngle + span * t : fromAngle - span * t;
    const bow = Math.sin(Math.PI * t);
    const radius = NODE_R + (laneRadius - NODE_R) * bow;
    if (i === 0 || i === steps) {
      const neighborT = i === 0 ? 1 / steps : (steps - 1) / steps;
      const neighborAng = clockwise ? fromAngle + span * neighborT : fromAngle - span * neighborT;
      const neighborBow = Math.sin(Math.PI * neighborT);
      const toward = polar(neighborAng, NODE_R + (laneRadius - NODE_R) * neighborBow);
      pts.push(nudge(polar(i === 0 ? fromAngle : toAngle, NODE_R), toward, NODE_RIM));
    } else {
      pts.push(polar(ang, radius));
    }
  }
  return {
    points: pts,
    d: pts.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" "),
  };
}

/** Opposite nodes. Each direction bows to a different side of the interior, so the two strokes never meet. */
function interiorPath(fromAngle: number, toAngle: number, side: 1 | -1): Drawn {
  const from = polar(fromAngle, NODE_R);
  const to = polar(toAngle, NODE_R);
  const start = nudge(from, to, NODE_RIM);
  const end = nudge(to, from, NODE_RIM);
  // Perpendicular of the center chord, fixed from the first angle, so reversing the trip flips the side.
  const chordX = Math.cos(toAngle) - Math.cos(fromAngle);
  const chordY = Math.sin(toAngle) - Math.sin(fromAngle);
  const len = Math.hypot(chordX, chordY) || 1;
  const bulge = 150;
  const control = {
    x: (start.x + end.x) / 2 + (-chordY / len) * bulge * side,
    y: (start.y + end.y) / 2 + (chordX / len) * bulge * side,
  };
  const points: Point[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const u = 1 - t;
    points.push({
      x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
      y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
    });
  }
  return {
    points,
    d: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
  };
}

function edgePath(fromIndex: number, toIndex: number, count: number, angles: number[]): Drawn {
  const step = (toIndex - fromIndex + count) % count;
  const fromAngle = angles[fromIndex]!;
  const toAngle = angles[toIndex]!;
  if (step === count / 2) {
    return interiorPath(fromAngle, toAngle, 1);
  }
  const clockwise = step < count / 2;
  const hop = Math.min(step, count - step);
  const laneRadius = NODE_R + 58 + (hop - 1) * 150 + (clockwise ? 0 : 175);
  return exteriorPath(fromAngle, toAngle, clockwise, laneRadius);
}

type Box = { x0: number; y0: number; x1: number; y1: number };
type LabelSlot = {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  baseline: "auto" | "hanging" | "middle";
  box: Box;
};

const LABEL_CHAR = 22;
const LABEL_H = 58;
const LABEL_GAP = 28;

function labelSlot(text: string, node: Point, dir: "n" | "s" | "w" | "e", gap: number): LabelSlot {
  const w = Math.max(text.length * LABEL_CHAR, 120);
  const h = LABEL_H;
  const edge = NODE_DISC + gap;
  if (dir === "n") {
    return {
      x: node.x,
      y: node.y - edge,
      anchor: "middle",
      baseline: "auto",
      box: { x0: node.x - w / 2, y0: node.y - edge - h, x1: node.x + w / 2, y1: node.y - edge },
    };
  }
  if (dir === "s") {
    return {
      x: node.x,
      y: node.y + edge,
      anchor: "middle",
      baseline: "hanging",
      box: { x0: node.x - w / 2, y0: node.y + edge, x1: node.x + w / 2, y1: node.y + edge + h },
    };
  }
  if (dir === "w") {
    return {
      x: node.x - edge,
      y: node.y,
      anchor: "end",
      baseline: "middle",
      box: { x0: node.x - edge - w, y0: node.y - h / 2, x1: node.x - edge, y1: node.y + h / 2 },
    };
  }
  return {
    x: node.x + edge,
    y: node.y,
    anchor: "start",
    baseline: "middle",
    box: { x0: node.x + edge, y0: node.y - h / 2, x1: node.x + edge + w, y1: node.y + h / 2 },
  };
}

function pointGap(point: Point, box: Box): number {
  const dx = Math.max(box.x0 - point.x, 0, point.x - box.x1);
  const dy = Math.max(box.y0 - point.y, 0, point.y - box.y1);
  return Math.hypot(dx, dy);
}

function boxGap(a: Box, b: Box): number {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0);
  const dy = Math.max(a.y0 - b.y1, b.y0 - a.y1, 0);
  if (dx > 0 || dy > 0) return Math.hypot(dx, dy);
  const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return -Math.min(overlapX, overlapY);
}

function slotClear(
  slot: LabelSlot,
  node: Point,
  nodes: { at: Point }[],
  obstacles: Point[],
  placed: Box[],
): number {
  const edgeClear = obstacles.reduce((min, point) => Math.min(min, pointGap(point, slot.box)), Infinity);
  const nodeClear = nodes.reduce((min, other) => {
    if (other.at === node) return min;
    return Math.min(min, pointGap(other.at, slot.box) - NODE_DISC);
  }, Infinity);
  const labelClear = placed.reduce((min, box) => Math.min(min, boxGap(slot.box, box)), Infinity);
  return Math.min(edgeClear, nodeClear, labelClear);
}

function placeLabels(
  nodes: { label: string; at: Point }[],
  obstacles: Point[],
  bounds: { width: number; height: number } = { width: WIDTH, height: HEIGHT },
  blocked: Point[] = [],
): LabelSlot[] {
  const placed: Box[] = [];
  const dirs = ["n", "s", "w", "e"] as const;
  return nodes.map((node) => {
    let best = labelSlot(node.label, node.at, "n", LABEL_GAP);
    let bestScore = -Infinity;
    const outwardX = node.at.x - CX;
    const outwardY = node.at.y - CY;
    for (const dir of dirs) {
      const slot = labelSlot(node.label, node.at, dir, LABEL_GAP);
      const off =
        (slot.box.x0 < 8 ? 8 - slot.box.x0 : 0) +
        (slot.box.x1 > bounds.width - 8 ? slot.box.x1 - (bounds.width - 8) : 0) +
        (slot.box.y0 < 8 ? 8 - slot.box.y0 : 0) +
        (slot.box.y1 > bounds.height - 8 ? slot.box.y1 - (bounds.height - 8) : 0);
      const dx = dir === "e" ? 1 : dir === "w" ? -1 : 0;
      const dy = dir === "s" ? 1 : dir === "n" ? -1 : 0;
      const outward = (dx * outwardX + dy * outwardY) / (Math.hypot(outwardX, outwardY) || 1);
      const hitsDb = blocked.some((point) => pointGap(point, slot.box) < 16);
      const score = slotClear(slot, node.at, nodes, obstacles, placed) - off * 4 + outward * 18 - (hitsDb ? 800 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = slot;
      }
    }
    placed.push(best.box);
    return best;
  });
}

function dbStem(filename: string): string {
  return filename.trim().replace(/\.txt$/i, "").trim() || filename.trim();
}

function toolSlug(filename: string): string {
  const base = filename.trim().toLowerCase().replace(/\.txt$/i, "");
  return base.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "file";
}

function permissionLine(agentLabel: string, filename: string, read: boolean, write: boolean): string {
  const slug = toolSlug(filename);
  const parts: string[] = [];
  if (read) parts.push(`leer · ${slug}_txt_read`);
  if (write) parts.push(`escribir · ${slug}_txt_write`);
  return `${agentLabel} · ${dbStem(filename)} · ${parts.join(" · ")}`;
}

function straight(from: Point, to: Point, fromR: number, toR: number): string {
  const start = nudge(from, to, fromR);
  const end = nudge(to, from, toR);
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

function flowIsLive(
  edge: { fromAgentId: string; toAgentId: string },
  live: FlowLive | null | undefined,
  exact: boolean,
): boolean {
  if (live?.kind !== "flow") return false;
  if (edge.fromAgentId === live.fromAgentId && edge.toAgentId === live.toAgentId) return true;
  return !exact && edge.fromAgentId === live.toAgentId && edge.toAgentId === live.fromAgentId;
}

export function FlowGraphView({ graph, files = [], live = null }: Props) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const order = new Map(graph.nodes.map((node, index) => [node.agentId, index]));
  const count = Math.max(graph.nodes.length, 1);
  const angles = graph.nodes.map((_, index) => -Math.PI / 2 + (index * 2 * Math.PI) / count);

  const drawn = graph.edges.flatMap((edge) => {
    const fromIndex = order.get(edge.fromAgentId);
    const toIndex = order.get(edge.toAgentId);
    if (fromIndex === undefined || toIndex === undefined || fromIndex === toIndex) return [];
    return [{ edge, ...edgePath(fromIndex, toIndex, count, angles) }];
  });
  const nodePoints = graph.nodes.map((node, index) => ({ label: node.label, at: polar(angles[index]!, NODE_R) }));
  const agentAt = new Map(graph.nodes.map((node, index) => [node.agentId, nodePoints[index]!.at]));
  const databases = files.flatMap((file) => {
    const links = graph.nodes.flatMap((node) => {
      const read = file.readAgentIds.includes(node.agentId);
      const write = file.writeAgentIds.includes(node.agentId);
      if (!read && !write) return [];
      return [{ agentId: node.agentId, read, write, label: node.label }];
    });
    if (links.length === 0) return [];
    return [{ file, links, name: dbStem(file.filename) }];
  });
  const width = databases.length > 0 ? 1500 : WIDTH;
  const dbGap = 250;
  const dbSpan = Math.max(0, databases.length - 1) * dbGap;
  const dbNodes = databases.map((db, index) => ({
    ...db,
    at: { x: 1288, y: CY - dbSpan / 2 + index * dbGap },
  }));
  const dbEdges = dbNodes.flatMap((db) =>
    db.links.flatMap((link) => {
      const at = agentAt.get(link.agentId);
      if (!at) return [];
      return [{
        key: `${db.file.id}-${link.agentId}`,
        agentId: link.agentId,
        slug: toolSlug(db.file.filename),
        d: straight(at, db.at, NODE_RIM, NODE_DISC),
        text: permissionLine(link.label, db.file.filename, link.read, link.write),
      }];
    }),
  );
  const dbBlock = dbNodes.flatMap((db) =>
    Array.from({ length: 10 }, (_, index) => {
      const angle = (index / 10) * Math.PI * 2;
      return { x: db.at.x + Math.cos(angle) * 92, y: db.at.y + Math.sin(angle) * 92 };
    }),
  );
  const exactFlow = drawn.some((item) =>
    live?.kind === "flow" && item.edge.fromAgentId === live.fromAgentId && item.edge.toAgentId === live.toAgentId,
  );
  const liveAgents = new Set<string>();
  if (live?.kind === "flow") {
    liveAgents.add(live.fromAgentId);
    liveAgents.add(live.toAgentId);
  } else if (live?.kind === "file") {
    liveAgents.add(live.agentId);
  }
  const labels = placeLabels(
    nodePoints,
    [...drawn.flatMap((edge) => edge.points), ...dbNodes.map((db) => db.at)],
    { width, height: HEIGHT },
    dbBlock,
  );

  function showTip(event: MouseEvent<SVGPathElement>, text: string) {
    const box = event.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!box) return;
    setTip({
      x: event.clientX - box.left,
      y: event.clientY - box.top,
      text,
    });
  }

  return (
    <div className={["demo-graph", databases.length > 0 ? "has-dbs" : "", live ? "has-live" : ""].filter(Boolean).join(" ")}>
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label="Grafo de conexiones entre agentes y bases">
        <defs>
          <marker id="demo-flow-arrow" markerUnits="userSpaceOnUse" markerWidth="22" markerHeight="22" refX="18" refY="11" orient="auto">
            <path d="M1,1 L20,11 L1,21 Z" fill="var(--accent, currentColor)" />
          </marker>
        </defs>
        {[...drawn].sort((a, b) => Number(flowIsLive(a.edge, live, exactFlow)) - Number(flowIsLive(b.edge, live, exactFlow))).map(({ edge, d }) => (
          <g key={`${edge.fromAgentId}-${edge.toAgentId}`}>
            <path
              d={d}
              className="demo-graph-hit"
              onMouseMove={(event) => showTip(event, `${edge.from} → ${edge.to} · peso ${edge.weight}`)}
              onMouseLeave={() => setTip(null)}
            />
            <path
              d={d}
              className={flowIsLive(edge, live, exactFlow) ? "demo-graph-edge is-live" : "demo-graph-edge"}
              markerEnd="url(#demo-flow-arrow)"
            />
          </g>
        ))}
        {dbEdges.map((edge) => {
          const lit = live?.kind === "file" && edge.agentId === live.agentId && edge.slug === live.slug;
          return (
            <g key={edge.key}>
              <path d={edge.d} className="demo-graph-hit" onMouseMove={(event) => showTip(event, edge.text)} onMouseLeave={() => setTip(null)} />
              <path d={edge.d} className={lit ? "demo-graph-db-edge is-live" : "demo-graph-db-edge"} />
            </g>
          );
        })}
        {graph.nodes.map((node, index) => {
          const point = nodePoints[index]!.at;
          const label = labels[index]!;
          return (
            <g key={node.agentId} className={liveAgents.has(node.agentId) ? "demo-graph-node is-live" : "demo-graph-node"}>
              <circle cx={point.x} cy={point.y} r={NODE_DISC} />
              <g className="demo-graph-bot" transform={`translate(${point.x} ${point.y}) scale(1.5)`}>
                <EntityGlyph kind="agent" />
              </g>
              <text x={label.x} y={label.y} textAnchor={label.anchor} dominantBaseline={label.baseline}>
                {node.label}
              </text>
            </g>
          );
        })}
        {dbNodes.map((db) => (
          <g key={db.file.id} className={live?.kind === "file" && toolSlug(db.file.filename) === live.slug ? "demo-graph-node demo-graph-db is-live" : "demo-graph-node demo-graph-db"}>
            <circle cx={db.at.x} cy={db.at.y} r={NODE_DISC} />
            <g className="demo-graph-bot" transform={`translate(${db.at.x} ${db.at.y}) scale(1.5)`}>
              <EntityGlyph kind="database" />
            </g>
            <text x={db.at.x} y={db.at.y + NODE_DISC + 22} textAnchor="middle" dominantBaseline="hanging">
              {db.name}
            </text>
          </g>
        ))}
      </svg>
      {tip ? (
        <div className="demo-graph-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}
