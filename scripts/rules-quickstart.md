# Mesita — agent quickstart (you're ~90% correct after this)

Stable mirror of the top of the Notion **Rules** page (the master — Notion wins on any conflict). Full page + appendix: https://www.notion.so/Rules-395a9bf37a528081b2c1dacc445bb6c8

This is **ASDM** — the Agentic Software Development Methodology: the one protocol every agent follows to know how to work. Same rules, one Linear ledger, on every platform — only your **platform protocol** (isolation, branch naming, connectors) differs. Find yours: **Development Rules §K**. What Mesita IS (product, schema, design): **Product Rules** (Pato owns it; mirror shipped architecture changes there same session).

| You're reading | You are |
| --- | --- |
| `CLAUDE.md` | Claude Code (local · cloud · subagent) or Claude Cowork |
| `AGENTS.md` | Cursor, Codex, or any open-standard agent — generated from `CLAUDE.md`; hand edits go there |

- **ONE repo (since 2026-07-11): `Canzeco/mesita-monorepo`** — the whole product, one `.git`, one history: `apps/{web-admin,web-business,web-consumer,web-landing,mobile-consumer}` + `supabase/`. The six former standalone repos are frozen read-only history — never work in them. Package rules: each package's `CLAUDE.md`.
- **ASDM mode — solo (alone + small fix)?** → branch off fresh main, work, squash-PR, merge it yourself, create the one-line issue at merge time (Ops & maintenance). That's the whole loop.
- **ASDM mode — multi-agent (other agents live on the repo)?** → same loop, plus coordinate: pick → claim (`claimed: <platform>:<session-slug> · branch:<actual-branch>`) → isolated worktree → merge.
- **One agent = one worktree = one branch = ONE squash PR** (`Closes <ID>`), even when the change spans packages — the old same-branch-across-repos / PR-per-repo ceremony is dead. Canonical branch `agent/<ISSUE-ID>-<slug>`; plain CLI: `git worktree add ../mesita-monorepo-<ISSUE-ID> -b agent/<ISSUE-ID>-<slug> origin/main`, then copy the gitignored local state listed in `.worktreeinclude` (Claude Code and Cursor do this automatically). Platform-forced names (e.g. `cursor/*`): declare the real branch in your claim.
- **Cowork never opens a live repo checkout** — `cowork`-label issues (docs/research/analysis) in non-repo folders only.
- **ALWAYS:** reply in English · clients call Edge Functions, never the DB · never push to `main` · mirror every Supabase cloud change into `supabase/` same session · set terminal status same session · no local dev servers (web verifies via Vercel; mobile via `npx expo export --platform web` + the `mobile-consumer` preview config) · comply with admin-console configs (Atlas / Enricher / Sourcing / Memo bind every EF, app & agent — unenforced config = bug).
- **NEVER ask.** Reversible → decide, log a `decision:` comment, ship. Only two `needs-human` cases: a secret you can't enter, or one irreversible money/publish trigger.
- **When in doubt**, hierarchy wins: Pato's live instruction > the Linear issue > Notion > memory.

Where things live: **Linear** (team Mesita, `MESITA-`) = work state · **Notion** = knowledge · **GitHub** = code (`Canzeco/mesita-monorepo`).
