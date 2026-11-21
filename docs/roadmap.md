# Roadmap: from graphs you look at to an org that improves itself

Status as of 2026-11-21. Step 0 and step −1 are merged into `main` (`35fc381`, `757cae6`). Step 1 is
built on `luciano/comm-weights` (not committed yet; see its status below). Steps 2 and 3 are still to do.

The goal, in one line: use the communication patterns we see in production as real weights in the
graph, attack the org through those weighted routes, get concrete fixes, and prove that a fixed
version of the org has a smaller attack surface than the old one.

---

## Done: Step 0, evaluate my agents with one click

On the **Evaluaciones** page, the **"Evaluar mis agentes"** panel runs the 6 vulnerability attacks
(design → solo runs → scoring) on every ticked agent, 2 at a time, and saves the batch with each
agent's scores before and after.

- The browser runs each agent through the existing steps (`vuln-design`, `vuln-run-one`,
  `vuln-finalize`), so no request runs past Vercel's 300 s limit. The server only keeps the
  record: `vuln_eval_batches` and `vuln_eval_batch_results` (`apps/api/src/vuln-batches/routes.ts`).
- Each agent now records its **origin**: `manual` (agent creator), `enterprise` (company generator),
  `seed` or `test`. By default the panel and the API only evaluate `manual` agents. Agents saved
  before this change are classified by their name (the generator names them "CSM 1",
  "Engineering 12", …).
- First real batch (5 manual agents, 1 round, `claude-haiku-5-5`): 30/30 runs completed, mean scores
  6–10 out of 100. Social engineering was the highest category for 3 of the 5 agents (up to 18).

### Still open for step 0

| # | Task | Why |
|---|---|---|
| 0.1 | Run `db:push` against production Postgres | The new tables and `agents.origin` don't exist there yet; the panel fails without them. |
| 0.2 | Check the panel once on the deployed app | Postgres code paths compile but have only run on SQLite. |
| 0.3 | Add Claude 5 prices to `apps/api/src/security/spend.ts` | Unknown models get the highest price on purpose, so the cost estimate **and the daily spend cap** are inflated (about US$ 31 shown for a run that cost far less). Needs the real prices; don't guess. |
| 0.4 | Default to 2–3 rounds before comparing batches | One round is a small sample; small differences are noise. |

---

## Step −1: Merge `vicente/demo` (½ day, do before step 1)

`origin/vicente/demo` already has the pieces steps 1 and 2 build on:

- `apps/api/src/harness/demo-comm-learn.ts`: the LLM works out who talks to whom
  (`DemoCommEdge { from, to, about, frequencyHint }`).
- `apps/api/src/harness/demo-chain-attack.ts`: chained attacks with steps, and an evaluation that
  returns `actionableRemediations`.

It changes 25 files (+4,072 lines), including the ones steps 1 and 2 edit most: `agent-runner.ts`,
`orchestrator.ts`, `RealWorkspace.tsx`, `mockDbGraph.ts`, `MeshApp.tsx`, `app.ts` and the DB
schemas. Vicente already merged `origin/main` into it, so merging now should be close to clean.
Each extra day of parallel work makes it harder.

- [ ] Confirm with Vicente that the branch is ready for `main`. (Merged without an explicit confirmation.)
- [x] Merge, resolve conflicts with step 0 (`757cae6`). Every conflict kept both sides; `MeshApp.tsx`
      takes demo's layout with the evaluation batch panel put back on Evaluaciones.
- [x] Run the tests: typecheck clean, everything passes except `persistent-runs.test.ts`, which
      fails the same way on `main` (Windows can't delete its temp folder in cleanup).
- [ ] Click through DEMO mode. Its pages load and its API answers, but nobody has used it end to end.

---

## Step 1: Real weights on the graph and a bias in each agent (2–3 days)

Today the graph only draws edges. On `vicente/demo`, `frequencyHint` is free text ("habitual",
"ocasional"). When two batches disagree, the code keeps whichever hint is longer, and the patterns
reach the agents only as a markdown block in their prompt.

1. **A structured data model.**
   - New table `comm_edges`: `from, to, weight (0–1), count, topics[], source (llm | observed | manual), updatedAt`.
   - Change the comm-learn output to an enum: `frequency: rare | occasional | habitual | constant`,
     mapped to a number.
   - Replace "keep the longer string" with a sum or a moving average.
2. **Two sources, combined.**
   - Prior: what the LLM inferred from production data.
   - Observed: `observedConnections()` in `apps/web/src/mesh/RealWorkspace.tsx` already counts
     `agent.message_sent` events in the browser. Move that count to the server and save it after
     every run.
   - `weight = α·prior + (1−α)·observed`, with α adjustable.
3. **Draw the weights.** Edge thickness and opacity follow the weight; the tooltip shows the topics.
4. **Bias, not a rule.** In `peerDirectory()` / `systemPrompt()` (`apps/api/src/harness/agent-runner.ts`),
   sort peers by weight and add a line like "you usually talk to X about Y (habitual)". Agents can
   still message anyone. Add a switch to turn the bias off, so its effect can be measured.
5. **Weighted risk paths.** `apps/api/src/harness/risk-paths.ts` treats every route the same today.
   Score each path by the product of its edge weights times its severity, so the panel shows likely
   paths, not only possible ones.

**Done when:** the graph shows weights, they reach the prompt (with a switch to turn them off),
risk paths are ranked by likelihood, and a bias on vs off batch has been run and recorded.

The bias stays **soft on purpose**: it may tip open choices toward usual contacts, but it must not
override the route a task clearly needs. (The original goal, "the message pattern really changes",
was dropped after the batches below: a stronger wording would show a change, but it would build in
a behaviour real teams may not have and change how attacks spread in the simulations.)

### Status (2026-11-21, branch `luciano/comm-weights`, not committed)

| # | Item | Status |
|---|---|---|
| 1 | Data model | Partial. `comm_observations` stores messages per (run, from, to); no topics and no `source` column yet. |
| 2 | Two sources | Observed only: counted on the server after every run (`recordRunComms`), plus `POST /api/comm-graph/rebuild` to recount old runs. No LLM prior and no α blend yet. |
| 3 | Draw the weights | Done. Thickness and opacity follow message counts; the agent panel lists who it talks to. No topics in the tooltip (no topics stored). |
| 4 | Bias, not a rule | Done. Usual contacts are sorted first and marked in the peer list; switch in Simulaciones (`commBias`). |
| 5 | Weighted risk paths | Done. Hop likelihood = smoothed share of what A sent to the run's agents (add-½); path likelihood = product of hops; ranked by likelihood × severity (1 / 0.5 / 0.1). Each run snapshots its counts at start. |

Bias on vs off batches (`pnpm --filter @sandbox/api comm-bias-batch`, `claude-haiku-5-5`, 5 runs per
side, weights frozen during the batch; raw results in `apps/api/data/comm-bias-*.json`):

- **Habit and task agree** (Camila, Tomás, Mateo, IT 10; finance: Tomás, Mateo). Share of messages
  to the sender's #1 contact: 67% with the bias, 53% without. Suggestive, but 5 runs per side.
- **Habit and task disagree** (Camila, Mateo, Engineering 30, Bruno; finance: Bruno, whom Camila
  had never messaged). Camila's first message went to Bruno in 10/10 runs, bias on or off; never to
  her usual contact Mateo. The bias was in her prompt (checked in `run.started`).

Still open for step 1:

- [ ] LLM prior + α blend, and topics per edge (items 1–2).
- [ ] Evaluations don't feed the weights: they run one agent alone, so there are no messages. Pick
      an approach first (a contact-a-colleague tool, real peers, or an opt-in switch).
- [ ] The bias switch is **on by default** in Simulaciones, and those runs feed the weights, so
      habits can reinforce themselves. Decide whether biased runs should count, or be tagged.
- [ ] Commit the branch.

---

## Step 2: User-driven iteration and a final analysis you can act on (2–3 days)

1. **One context builder.** A `buildOrgContext(orgVersion)` that reads the company, flows, agents and
   weighted graph from the DB. Use it everywhere a prompt describes the org: `designScenarios`,
   `designChainAttack`, comm-learn and `judge.ts`. Drop the duplicated "Tendencias de comunicación"
   block, so the graph is the only source.
2. **Iteration in steps.** Each `DemoChainAction` is one step. The user can pause, edit or add the
   next step. Record `stepsReached / totalSteps` for every attack (step 3 needs it).
3. **A final analysis with a fixed structure.** Extend the output of `evaluateChainAttack` and the judge:
   - `objectives[]`: `{ criterion, met, evidenceEventIds }`, saying what was met and what wasn't, with evidence.
   - `remediations[]`: `{ target: agent | edge | tool | fix, change, expectedEffect, patch }`.

   The `patch` must be machine-readable, for example: turn on `approval_gate`, take `issue_refund`
   away from X, cut edge A→B, change a line in X's prompt. That is what lets step 3 apply fixes on
   its own instead of a person retyping them.

**Done when:** a finished attack shows met/unmet objectives with links to the trace, and every
remediation has a patch that can be applied without editing by hand.

---

## Step 3: Self-improvement with version comparison (3–4 days)

1. **Org versions.** Table `org_versions`. Cloning copies agents, edges and fixes into v(N+1), then
   applies the `patch`es from step 2.
2. **Same test, both versions, in parallel.** Same seed, at least 3 repetitions each. Compare step by
   step: "v1 reached step 26 of 40, v2 reached step 2."
3. **Attack surface, defined precisely.** For example the number of vulnerable steps, or
   Σ(path likelihood × severity) from step 1. Report the drop: "26 → 10 vulnerable steps, about 62% less."
4. **Guard individual scores.** Re-run step 0 only on the agents that changed; the batch history
   from step 0 already holds the "before" scores. Accept the new version only if the attack surface
   drops by at least X% **and** no agent's individual score rises by more than Δ. Example of an
   acceptable trade-off: one agent goes from 10 to 11, but the attack surface halves.
5. **A human decides.** Same pattern as `email-harness/src/mesh_harness/improve.py`: propose,
   approve, re-run, compare, keep only if it helped and nothing regressed.

**Done when:** one screen shows v1 vs v2 side by side (steps reached, attack surface, per-agent
score changes) with an accept/reject button.

---

## Throughout

- **Cost.** Steps 0 and 3 multiply model calls. Always show the estimate first and respect the
  spend cap (fix 0.3 first, or the cap will block runs early).
- **Statistics.** Report counts with n ("8/21"), not rates, as the README already does.
- **Tests without model calls.** Mock the LLM for patch application, weight blending and the
  step-by-step comparison.
- **Serverless limits.** Anything long (batches, version comparisons) must be split into requests
  under 300 s, as step 0 does, or run outside Vercel.

## Suggested order for the demo

1. Step 0 open items 0.1–0.3 (production DB, deployed check, prices)
2. Step −1 (merge `vicente/demo`)
3. Step 1, visual weights + weighted risk paths first
4. Step 3, the v1 vs v2 comparison table

Step 2 can stay partly manual for the demo; the side-by-side comparison is what makes it land.
