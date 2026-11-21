# Agent Sandbox (MVP)

Local monorepo to run **two real Claude agents**, each with its own harness, and watch how they think, call tools, and message each other.

## Stack

- `apps/api` — Hono + `@anthropic-ai/sdk` agent harness + SSE traces
- `apps/web` — Vite + React live monitor
- `packages/shared` — shared types

## Setup

```bash
# 1) Install deps
pnpm install

# 2) API key (hackathon Claude credits)
cp .env.example .env
# edit .env → ANTHROPIC_API_KEY=sk-ant-...

# 3) Run both apps
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:8787/health

## What each agent can do

Real Messages API tool loop with only:

| Tool | Purpose |
|------|---------|
| `send_message` | Talk to the peer agent |
| `read_inbox` | Read unread peer messages |
| `done` | Finish with a summary |

Scheduler: round-robin (one Claude turn per agent at a time) so interactions stay readable and cheap on credits.

## Production path

This sandbox is the first environment. The same event shape (`TraceEvent`) is what a later collector would ingest from distributed real agents — swap the in-process `MessageBus` for a queue, and the harness emits the same traces.
