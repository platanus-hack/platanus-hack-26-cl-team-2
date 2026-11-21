"""Repo-root .env loading and the model client's base_url (no model calls, no real .env read)."""
from __future__ import annotations

import pytest

from mesh_harness import env
from mesh_harness.env import load_repo_env, parse_env


def test_repo_env_is_the_repo_root_file():
    assert env.REPO_ENV.name == ".env"
    assert (env.REPO_ENV.parent / "email-harness").is_dir()


def test_parse_env():
    text = "\n".join([
        "# comment",
        "",
        "ANTHROPIC_API_KEY=sk-test",
        'ANTHROPIC_BASE_URL="https://proxy.example/v1"',
        "export MESH_MODEL='claude-haiku-5-5'",
        "PORT=8787 # inline comment",
        "HASH=abc#def",
        "not a line",
        "EMPTY=",
    ])
    assert parse_env(text) == {
        "ANTHROPIC_API_KEY": "sk-test",
        "ANTHROPIC_BASE_URL": "https://proxy.example/v1",
        "MESH_MODEL": "claude-haiku-5-5",
        "PORT": "8787",
        "HASH": "abc#def",
        "EMPTY": "",
    }


def test_load_repo_env_does_not_override(tmp_path, monkeypatch):
    f = tmp_path / ".env"
    f.write_text("MESH_TEST_A=from-file\nMESH_TEST_B=from-file\n", encoding="utf-8")
    monkeypatch.setenv("MESH_TEST_A", "exported")
    monkeypatch.delenv("MESH_TEST_B", raising=False)
    assert load_repo_env(f) == ["MESH_TEST_B"]
    import os
    assert os.environ["MESH_TEST_A"] == "exported"
    assert os.environ["MESH_TEST_B"] == "from-file"
    monkeypatch.delenv("MESH_TEST_B")


def test_missing_env_file_is_fine(tmp_path):
    assert load_repo_env(tmp_path / "nope.env") == []


@pytest.fixture
def fake_anthropic(monkeypatch):
    llm_agents = pytest.importorskip("mesh_harness.llm_agents")
    calls = []

    class FakeAnthropic:
        def __init__(self, **kwargs):
            calls.append(kwargs)

    monkeypatch.setattr(llm_agents.anthropic, "Anthropic", FakeAnthropic)
    monkeypatch.setattr(llm_agents, "_client", None)
    yield llm_agents, calls
    llm_agents._client = None


def test_client_passes_base_url_when_set(fake_anthropic, monkeypatch):
    llm_agents, calls = fake_anthropic
    monkeypatch.setenv("ANTHROPIC_BASE_URL", " https://proxy.example ")
    c = llm_agents.client()
    assert calls == [{"base_url": "https://proxy.example"}]
    assert llm_agents.client() is c, "one shared client"


def test_client_without_base_url(fake_anthropic, monkeypatch):
    llm_agents, calls = fake_anthropic
    monkeypatch.delenv("ANTHROPIC_BASE_URL", raising=False)
    llm_agents.client()
    assert calls == [{}]
