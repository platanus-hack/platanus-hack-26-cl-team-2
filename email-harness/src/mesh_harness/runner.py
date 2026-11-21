"""Runs every scenario through A -> B -> C inside the sandbox, traces it, evaluates it.

Usage:  python -m mesh_harness.runner [--agents llm|stub] [--scenarios FILE] [--out DIR]
                                      [--fix sender_check] [--only id1,id2]
        (src/ and vendor/ on PYTHONPATH; --agents llm needs ANTHROPIC_API_KEY)
"""
from __future__ import annotations
import argparse
import json
import logging
from pathlib import Path

from .agents import agent_a, agent_b, agent_c
from .evaluator import evaluate
from .sandbox import Sandbox, SandboxPolicy
from .tools import DEFAULT_ALLOWED, TOOLS
from .tracing import Recorder, make_tracer, snoop_to_edges

ROOT = Path(__file__).resolve().parents[2]
TRACES = ROOT / "traces"


def run_scenario(tracer, scenario: dict, mode: str, out: Path = TRACES,
                 fixes: frozenset = frozenset()) -> dict:
    run_id = scenario["id"]
    with tracer.trace(input=scenario["ticket"], metadata={"run_id": run_id, "fixes": sorted(fixes)},
                      tags=[scenario["kind"]]) as h:
        rec = Recorder(h)
        sandbox = Sandbox(SandboxPolicy(allowed=set(DEFAULT_ALLOWED)), TOOLS, rec)
        if mode == "llm":
            from .llm_agents import run_chain
            status = run_chain(scenario["ticket"], rec, sandbox, fixes)
        else:
            summary = agent_a(scenario["ticket"], rec)
            request = agent_b(summary, rec) if summary else None
            agent_c(request, sandbox) if request else None
            status = "completed"
        h.set_output(status)
    snoop = json.loads((out / f"{run_id}.snoop.json").read_text(encoding="utf-8"))
    edges = snoop_to_edges(snoop)
    checks = {s["metadata"]["check"]: s["output"] for s in snoop["steps"]
              if (s.get("metadata") or {}).get("check")}
    result = {"run_id": run_id, "kind": scenario["kind"], "technique": scenario["technique"],
              "snoop_trace_id": snoop["trace_id"], "status": status, "fixes": sorted(fixes),
              "checks": checks, "events": edges, **evaluate(edges)}
    (out / f"{run_id}.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def run_suite(scenarios: list[dict], mode: str, out: Path, fixes: frozenset = frozenset(),
              label: str = "", extra_index: dict | None = None) -> dict:
    """Run scenarios, write traces + index.json into `out`, return the index."""
    out.mkdir(parents=True, exist_ok=True)
    tracer = make_tracer(out)
    results = []
    for s in scenarios:
        print(f"running {s['id']} ...", flush=True)
        results.append(run_scenario(tracer, s, mode, out, fixes))
    attacks = [r for r in results if r["kind"] == "attack"]
    asr = sum(r["attack_success"] for r in attacks) / len(attacks) if attacks else 0.0
    model = None
    if mode == "llm":
        from .llm_agents import EFFORT, MODEL
        model = f"{MODEL} (effort {EFFORT})"
    reached = {}
    for r in results:
        reached[r["reached"]] = reached.get(r["reached"], 0) + 1
    index = {"agents": mode, "model": model, "label": label, "fixes": sorted(fixes),
             "reached_counts": reached, "asr": round(asr, 4), "attacks": len(attacks),
             "successes": sum(r["attack_success"] for r in attacks),
             "runs": [{k: r[k] for k in ("run_id", "kind", "technique", "attack_success", "reached", "status")}
                      for r in results],
             **(extra_index or {})}
    (out / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    for r in results:
        flag = "ATTACK OK " if r["attack_success"] else "          "
        print(f"{flag} {r['run_id']:<30} {r['technique']:<28} reached={r['reached']}  {r['status']}")
    print("\nwhere each one ended:", reached)
    if attacks:
        print(f"ASR = {index['successes']}/{index['attacks']} = {asr:.0%}")
    return index


def load_scenarios(path: str, only: str | None = None) -> list[dict]:
    scenarios = json.loads((ROOT / path).read_text(encoding="utf-8"))
    if only:
        keep = set(only.split(","))
        scenarios = [s for s in scenarios if s["id"] in keep]
    return scenarios


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--agents", choices=["llm", "stub"], default="stub")
    ap.add_argument("--only", help="comma-separated scenario ids to run")
    ap.add_argument("--scenarios", default="scenarios/ticket_injection.json")
    ap.add_argument("--out", default="traces", help="output folder (frontend: ?dir=<out>)")
    ap.add_argument("--fix", action="append", default=[], help="enable a fix, e.g. sender_check")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="  %(name)s: %(message)s")
    if args.fix and args.agents != "llm":
        ap.error("--fix only applies to --agents llm")
    run_suite(load_scenarios(args.scenarios, args.only), args.agents, ROOT / args.out,
              frozenset(args.fix), extra_index={"scenarios": args.scenarios})


if __name__ == "__main__":
    main()
