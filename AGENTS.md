<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
<!-- RULES-QUICKSTART:START (generated — do not hand-edit; run: deno task sync-rules) -->
# Mesita — agent quickstart (you're ~90% correct after this)

Stable mirror of the top of the Notion **Rules** page (the master — Notion wins on any conflict). Full page + appendix: https://www.notion.so/Rules-395a9bf37a528081b2c1dacc445bb6c8

This is **ASDM** — the Agentic Software Development Methodology: one protocol, two domains. **Product Rules** define WHAT Mesita is (Pato owns it; mirror shipped architecture changes there same session) · **ASDM (the Development Rules)** defines HOW agents build it. Same rules, one Linear ledger, on every platform and in every environment — local or cloud; only your **platform protocol** (isolation, branch naming, connectors) differs. Find yours: **Development Rules §K**.

| You're reading | You are |
| --- | --- |
| `CLAUDE.md` | Claude Code (local · cloud · subagent) or Claude Cowork |
| `AGENTS.md` | Cursor, Codex, or any open-standard agent — generated from `CLAUDE.md`; hand edits go there |

- **ONE repo (since 2026-07-11): `Canzeco/mesita-monorepo`** — the whole product, one `.git`, one history: `apps/{web-admin,web-business,web-consumer,web-landing,mobile-consumer}` + `supabase/`. The six former standalone repos are frozen read-only history — never work in them. Package rules: each package's `CLAUDE.md`.
- **Agents never talk to each other.** Coordination is written state on two surfaces: **Linear** carries intent (issues, claims, `decision:` comments, statuses) · **git/GitHub** carries the work (branches, squash PRs; `Closes <ID>` is the join). Commits document code, they don't coordinate; chat is ephemeral — durable things land in the ledger or the docs, same session.
- **ASDM mode — solo (alone + small fix)?** → branch off fresh main, work, squash-PR, merge it yourself, create the one-line issue at merge time (Ops & maintenance). That's the whole loop.
- **ASDM mode — multi-agent (other agents live on the repo)?** → same loop, plus coordinate: pick → claim (`claimed: <platform>:<session-slug> · branch:<actual-branch>`) → isolated worktree → merge.
- **Local vs cloud — same ledger, different powers.** Local (Pato's Mac) = full peer: personal connectors, secrets, Supabase deploys. Cloud (fresh VM clone) = launch-supervised: repo-committed config only — no ledger writes, no deploys; deliver a pushed branch + PR and the dispatching session does the rest. Mixed local/cloud fleets are normal.
- **The backend is a singleton.** One Supabase project, ONE live version of the schema and every Edge Function — Supabase branching deliberately unused. Git isolates code, never the cloud: schema/EF changes are claimed footprint; deploy at merge time; keep cloud == repo same session.
- **One issue = one branch = one worktree = ONE squash PR** (`Closes <ID>`), even when the change spans packages — worktrees scale with issues, never per whim (parallelism = child issues + subagents, ≤5, each in its own; the old same-branch-across-repos / PR-per-repo ceremony is dead). Canonical branch `agent/<ISSUE-ID>-<slug>`; plain CLI: `git worktree add ../mesita-monorepo-<ISSUE-ID> -b agent/<ISSUE-ID>-<slug> origin/main`, then copy the gitignored local state listed in `.worktreeinclude` (Claude Code and Cursor do this automatically). Platform-forced names (e.g. `cursor/*`): declare the real branch in your claim.
- **Cowork never opens a live repo checkout** — `cowork`-label issues (docs/research/analysis) in non-repo folders only.
- **ALWAYS:** reply in English · clients call Edge Functions, never the DB · never push to `main` · mirror every Supabase cloud change into `supabase/` same session · set terminal status same session · no local dev servers (web verifies via Vercel; mobile via `npx expo export --platform web` + the `mobile-consumer` preview config) · comply with admin-console configs (Atlas / Enricher / Sourcing / Memo / Reservations / Scoring bind every EF, app & agent — unenforced config = bug).
- **NEVER ask.** Reversible → decide, log a `decision:` comment, ship. Only two `needs-human` cases: a secret you can't enter, or one irreversible money/publish trigger.
- **When in doubt**, hierarchy wins: Pato's live instruction > the Linear issue > Notion > memory.

Where things live: **Linear** (team Mesita, `MESITA-`) = work state · **Notion** = knowledge · **GitHub** = code (`Canzeco/mesita-monorepo`). Instruction files chain to their master: package `CLAUDE.md`/`AGENTS.md` (package rules only) → root `CLAUDE.md` (this quickstart) → Notion; every `AGENTS.md` is generated from its sibling `CLAUDE.md` — never hand-edit; `deno task sync-rules` regenerates, CI enforces (Development Rules §C).
<!-- RULES-QUICKSTART:END -->
## This repo — mesita-monorepo (root)

| Path | Was | What |
| --- | --- | --- |
| `apps/web-admin` | `mesita-web-admin` | Internal admin console · admin.mesita.ai (Next.js · Vercel) |
| `apps/web-business` | `mesita-web-business` | Business console · business.mesita.ai (Next.js · Vercel) |
| `apps/web-consumer` | `mesita-web-consumer` | Consumer app · consumer.mesita.ai (Next.js · Vercel) |
| `apps/web-landing` | `mesita-web-landing` | Marketing landing · mesita.ai (Next.js · Vercel) |
| `apps/mobile-consumer` | `mesita-mobile-consumer` | Native consumer app (Expo SDK 57 · RN · NativeWind) |
| `supabase` | `mesita-supabase` | DB · RLS · Edge Functions — source of truth (Supabase CLI · Deno) |
| `assets` | — | Shared brand assets (`assets/brand` = canonical marks; update here first, propagate to apps same PR) |

- **Packages are independent install roots** (own `pnpm-workspace.yaml` + lockfile; **no root pnpm workspace on purpose** — mobile needs `nodeLinker: hoisted`, web apps use the default isolated linker). `cd` into a package and use it as before; `supabase/` is Deno + the Supabase CLI (run every `supabase` command from `supabase/`).
- **All four web apps deploy from this one monorepo** — each `apps/web-*` is its own Vercel project (canzeco team) linked to `Canzeco/mesita-monorepo` with **Root Directory `apps/web-<app>`**; a push to `main` auto-deploys only the app(s) that changed (Vercel "skip unaffected" on). One repo → four Vercel projects → four domains: web-landing→mesita.ai · web-admin→admin.mesita.ai · web-business→business.mesita.ai · web-consumer→consumer.mesita.ai. The frozen standalone `mesita-web-*` repos no longer deploy anything.
- **CI is path-filtered per package** (`.github/workflows/{web-admin,web-business,web-consumer,web-landing,mobile-consumer,mobile-business,supabase}.yml` + `rules.yml`) — a PR only runs the pipelines of what it touches.
- **Instruction files are generated:** root `CLAUDE.md` = quickstart block (markers) + this tail; package `CLAUDE.md` = package rules only (no quickstart block); every `AGENTS.md` = generated mirror — never hand-edit one. Edit `scripts/rules-quickstart.md` (quickstart) or a `CLAUDE.md` tail, then run `deno task sync-rules`; strict `--check` runs in CI (`rules.yml`).
- **Worktrees:** `.worktreeinclude` lists the gitignored local state every new worktree needs (Claude Code copies it automatically; Cursor via `.cursor/worktrees.json`; otherwise copy those paths manually).
- **Preview servers** (`.claude/launch.json`): web-admin :3001 · web-business :3002 · web-consumer :3003 · web-landing :3004 · mobile-consumer :8081 · mobile-business :8082 (`expo start --web`).
