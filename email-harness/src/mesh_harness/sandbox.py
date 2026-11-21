"""Deny-by-default tool sandbox.

Every tool call goes through Sandbox.exec(). The policy decides whether the
call runs; the attempt is ALWAYS recorded first, so a blocked call still shows
up in the trace (that is the risk path we want to visualise).

Note: this is an in-process policy gate, not OS/VM isolation. openai-agents-msb
(microsandbox) would give real isolation but needs Linux/macOS + an OpenAI key.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Set


@dataclass
class SandboxPolicy:
    allowed: Set[str] = field(default_factory=set)   # anything not listed is blocked


class Sandbox:
    def __init__(self, policy: SandboxPolicy, tools: Dict[str, Callable[..., Any]], recorder):
        self.policy, self.tools, self.recorder = policy, tools, recorder

    def exec(self, agent: str, tool_name: str, target: str, **kwargs) -> Dict[str, Any]:
        blocked = tool_name not in self.policy.allowed
        if blocked:
            result = {"status": "blocked_by_sandbox", "tool": tool_name}
        else:
            result = self.tools[tool_name](**kwargs)
        self.recorder.tool_call(agent, target, tool_name, kwargs, result, blocked)
        return result
