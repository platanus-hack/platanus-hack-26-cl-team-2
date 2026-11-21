"""agent-snoop instrumentation with a local JSON backend (no network, no MongoDB)."""
from __future__ import annotations
import json
from pathlib import Path

from agent_snoop import AgentTracer, Step, StepType, TokenUsage, ToolCall
from agent_snoop.storage.base import StorageBackend


class JsonFileBackend(StorageBackend):
    def __init__(self, directory: Path):
        self.dir = Path(directory)
        self.dir.mkdir(parents=True, exist_ok=True)

    def save_trace(self, trace) -> None:
        (self.dir / f"{trace.metadata['run_id']}.snoop.json").write_text(
            trace.model_dump_json(indent=2), encoding="utf-8")


class Recorder:
    """Writes agent hops and tool calls as agent-snoop Steps on the open trace."""

    def __init__(self, handle):
        self.h = handle

    def hop(self, src: str, dst: str, action: str, payload=None):
        self.h.add_step(Step(step_type=StepType.AGENT_ACTION, node_name=dst, input=payload,
                             metadata={"from": src, "to": dst, "action": action}))

    def llm_call(self, agent: str, resp):
        """Record one Messages API call (no from/to, so it never draws an edge)."""
        u = resp.usage
        text = " ".join(getattr(b, "text", "") for b in resp.content if b.type == "text").strip()
        self.h.add_step(Step(
            step_type=StepType.LLM_CALL, node_name=agent, model=resp.model, output=text or None,
            token_usage=TokenUsage(prompt_tokens=u.input_tokens, completion_tokens=u.output_tokens,
                                   total_tokens=u.input_tokens + u.output_tokens),
            metadata={"agent": agent, "stop_reason": resp.stop_reason}))

    def check(self, name: str, result: dict):
        """Record a deterministic pre-check (no from/to, so no edge)."""
        self.h.add_step(Step(step_type=StepType.OTHER, node_name=name, output=result,
                             metadata={"check": name, **{k: result[k] for k in ("verdict",)}}))

    def tool_call(self, agent, target, tool, args, result, blocked):
        self.h.add_step(Step(
            step_type=StepType.TOOL_CALL, node_name=agent,
            tool_calls=[ToolCall(tool_name=tool, tool_input=args, tool_output=result,
                                 error="blocked_by_sandbox" if blocked else None)],
            metadata={"from": agent, "to": target, "action": "tool_call",
                      "tool": tool, "blocked": blocked}))


def make_tracer(trace_dir: Path) -> AgentTracer:
    return AgentTracer(storage=JsonFileBackend(trace_dir), agent_name="mesh_A_B_C")


def snoop_to_edges(snoop_trace: dict) -> list[dict]:
    """Convert an agent-snoop trace into the edge list the frontend draws."""
    edges = []
    for s in snoop_trace["steps"]:
        m = s.get("metadata") or {}
        if "from" in m:
            edges.append({"seq": len(edges) + 1, **m})
    return edges
