# Agent Sandbox — corporate behavior lab

The product value is **not** the sandbox UI. It is what you learn by simulating
enterprise agents **before** production:

- How an area-role behaves under seniority / motivation / proactivity
- What it decides, escalates, skips, or invents as “done”
- Comparable traces across profiles on the same scenario

## Stack

- `apps/api` — Hono + Anthropic harness + **Postgres (Drizzle)** agent store
- `apps/web` — Vite + React (profile generator + multi-agent lab)
- `packages/shared` — area prototypes, compose, projection

## Setup

```bash
pnpm install
cp .env.example .env
# set ANTHROPIC_API_KEY

pnpm run dev
```

- Web: http://localhost:5173
- API: http://localhost:8787/health
- **Local DB default: SQLite** at `apps/api/data/sandbox.sqlite` (auto-created)

### Databases

| Env | Driver | How |
|-----|--------|-----|
| Local (default) | **SQLite** | Leave `DATABASE_URL` unset, or `file:./data/sandbox.sqlite` |
| Production / Vercel | **Postgres** | Neon / Vercel Postgres → `DATABASE_URL=postgresql://…` then `pnpm --filter @sandbox/api db:push` |
| Optional local PG | Postgres | `docker compose up -d` + postgresql URL |

Schema stores agents (knobs + harness context), harness tools/model, and
`agent_context_files` for policies/playbooks used at invoke time.

## Persist & invoke

| Method | Purpose |
|--------|---------|
| `PUT /api/agents` | Upsert agent profile + knobs + harness |
| `GET /api/agents` | List stored agents |
| `GET /api/agents/:id` | Load one agent |
| `GET /api/agents/:id/invoke` | Projection ready to run (system prompt + context files + tools) |
| `GET /api/agents/:id/vuln-assessment` | Latest vulnerability scores/summary (or null) |
| `POST /api/agents/:id/vuln-assess` | Design + run solo exploit evals; upsert assessment |
| `POST /api/agents/:id/context-files` | Attach markdown/policy file |
| `POST /api/profiles/compose` | Generate profile (no DB write) |
| `POST /api/profiles/save` | Persist generated profile to Postgres |

Vulnerability taxonomy + scoring rules: [`docs/agentic-exploit-evals.md`](docs/agentic-exploit-evals.md). Stored runs may use **1–8** agents (`from-stored`); solo runs omit peer messaging tools.

## Profile generator

1. Choose area → set knobs → Generate (+ optional Haiku refine)  
2. Edit context / style / goal  
3. **Save agent**  
4. Attach context files  
5. Later: solo sandbox loads via `/invoke`

## Enterprise generator (no AI)

Tab **Enterprise generator** — bulk fleet from templates only (`usedAi: false`).

Areas: GTM, CSM, CS, Engineering, Product+Design, Data, IT.

Presets = exact agent totals (100 / 200 / 400) distributed by area, or Custom / “1 per area”.

Seniority default ≈ 25% junior · 50% mid · 25% senior (editable %).

APIs: `GET /api/enterprise/presets`, `POST /api/enterprise/generate`

## Roadmap

| Iter | Capability |
|------|------------|
| 1 | Prototypes + generator + **Postgres persistence** |
| 2 | Solo sandbox from stored agent |
| 3 | Multi-agent with stored profiles |
| 4 | Same traces → prod monitor |
