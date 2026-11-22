import { useState, type MouseEvent } from "react";
import type { FlowGraph, FlowGraphEdge } from "@sandbox/shared";
import { EntityGlyph } from "./EntityGlyph";

type Props = { graph: FlowGraph };

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

function placeLabels(nodes: { label: string; at: Point }[], obstacles: Point[]): LabelSlot[] {
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
        (slot.box.x1 > WIDTH - 8 ? slot.box.x1 - (WIDTH - 8) : 0) +
        (slot.box.y0 < 8 ? 8 - slot.box.y0 : 0) +
        (slot.box.y1 > HEIGHT - 8 ? slot.box.y1 - (HEIGHT - 8) : 0);
      const dx = dir === "e" ? 1 : dir === "w" ? -1 : 0;
      const dy = dir === "s" ? 1 : dir === "n" ? -1 : 0;
      const outward = (dx * outwardX + dy * outwardY) / (Math.hypot(outwardX, outwardY) || 1);
      const score = slotClear(slot, node.at, nodes, obstacles, placed) - off * 4 + outward * 18;
      if (score > bestScore) {
        bestScore = score;
        best = slot;
      }
    }
    placed.push(best.box);
    return best;
  });
}

export function FlowGraphView({ graph }: Props) {
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
  const labels = placeLabels(
    nodePoints,
    drawn.flatMap((edge) => edge.points),
  );

  function showTip(event: MouseEvent<SVGPathElement>, edge: FlowGraphEdge) {
    const box = event.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!box) return;
    setTip({
      x: event.clientX - box.left,
      y: event.clientY - box.top,
      text: `${edge.from} → ${edge.to} · peso ${edge.weight}`,
    });
  }

  return (
    <div className="demo-graph">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Grafo de conexiones entre agentes">
        <defs>
          <marker id="demo-flow-arrow" markerUnits="userSpaceOnUse" markerWidth="22" markerHeight="22" refX="18" refY="11" orient="auto">
            <path d="M1,1 L20,11 L1,21 Z" fill="var(--accent, currentColor)" />
          </marker>
        </defs>
        {drawn.map(({ edge, d }) => (
          <g key={`${edge.fromAgentId}-${edge.toAgentId}`}>
            <path d={d} className="demo-graph-hit" onMouseMove={(event) => showTip(event, edge)} onMouseLeave={() => setTip(null)} />
            <path d={d} className="demo-graph-edge" markerEnd="url(#demo-flow-arrow)" />
          </g>
        ))}
        {graph.nodes.map((node, index) => {
          const point = nodePoints[index]!.at;
          const label = labels[index]!;
          return (
            <g key={node.agentId} className="demo-graph-node">
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
      </svg>
      {tip ? (
        <div className="demo-graph-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}
