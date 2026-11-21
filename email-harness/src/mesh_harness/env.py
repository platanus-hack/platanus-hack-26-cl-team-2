"""Loads the repo-root .env (same file apps/api reads), without adding a dependency.

Only fills variables that are not already set, so an exported ANTHROPIC_API_KEY or
ANTHROPIC_BASE_URL still wins. Values are never printed or logged.
"""
from __future__ import annotations

import os
from pathlib import Path

# email-harness/src/mesh_harness/env.py -> repo root
REPO_ENV = Path(__file__).resolve().parents[3] / ".env"


def parse_env(text: str) -> dict[str, str]:
    """Minimal .env parser: KEY=VALUE lines, optional 'export ', quotes, '#' comments."""
    out: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].lstrip()
        key, sep, value = line.partition("=")
        key = key.strip()
        if not sep or not key or not key.replace("_", "").isalnum():
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()
        out[key] = value
    return out


def load_repo_env(path: Path | str = REPO_ENV) -> list[str]:
    """Set variables from `path` that are missing from os.environ. Returns the names set."""
    p = Path(path)
    if not p.is_file():
        return []
    set_names = []
    for key, value in parse_env(p.read_text(encoding="utf-8")).items():
        if key not in os.environ:
            os.environ[key] = value
            set_names.append(key)
    return set_names
