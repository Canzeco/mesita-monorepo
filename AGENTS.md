<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
<!-- RULES-QUICKSTART:START (generated — do not hand-edit; run: deno task sync-rules) -->
# Mesita — agent quickstart (you're ~90% correct after this)

**Notion is the library; it wins on any conflict.** This block mirrors [**Rules**](https://www.notion.so/Rules-3d8a9bf37a5281d79b1fde154ad09ba1) §0. **Rules = the law** (how change is allowed). **📚 [Docs](https://www.notion.so/Docs-3bfa9bf37a52801e891ec3407d717273) = the knowledge**, one flat page per domain. **Code = this repo.** Linear is the ledger, not a source of truth. **Rules beat Docs.** Two lifecycles: Code → SADLC (monorepo). Docs → KADLC. Changing this Rules tree is not a third lifecycle — issue + Pato for constitution, then SADLC if boot or a gate changed. SADLC / KADLC = Software / Knowledge Agentic Development Life Cycle. Mixed completes every Integrate. Fetch this Rules URL only. Rules Don’t Read is archive.

**The repo.** `Canzeco/mesita-monorepo` is the whole product: `apps/{web-admin,web-business,web-consumer,web-landing,web-validate,mobile-consumer,mobile-business}` + `supabase/` + `assets/`. The six former standalone repos are frozen. Package-specific rules: that package's `CLAUDE.md`.

**The blackboard.** Agents never talk to each other. **Linear** (team Mesita, `MESITA-`) carries intent — issues + comments ONLY; Linear documents and Claude Artifacts are prohibited. **git/GitHub** carries the work — branches and squash PRs; `Closes MESITA-<id>` is the join.

**The lock.** Every repo, Notion, or cloud (schema/EF) write has an issue (I-1). Claim = In Progress + one claim line (I-6). Workspace = a checkout a live claim names: one per code issue, none for Rules/Docs-only.

**The loop.** `deno task boot` → pick unblocked, footprint-disjoint → `deno task worktree add MESITA-<id> <slug>` (`--adopt .` for the checkout you launched in) → enter the path → In Progress + the printed claim line → Docs first, small commits, push early → `deno task worktree pr` then `gh pr ready` then `gh pr merge --squash` with `Closes MESITA-<id>` → `deno task worktree remove` from a lobby → rewrite Docs. Never push to `main`. Never write in the shared checkout (I-4).

**The invariants**
- I-1 Every repo, Notion, or cloud (schema/EF) write has an issue, in a project. Pure Q&A needs none.
- I-2 `main` only by squash PR; every PR passes every check the ruleset requires on that PR.
- I-3 One code issue = one workspace (claimed checkout) = one PR.
- I-4 The shared checkout holds no work of its own; `repair-lobby` fixes it, `scripts/preflight.sh` refuses the write.
- I-5 Backend is a singleton: cloud == repo, same session.
- I-6 Claims are the only lock; stale after 24h idle, then `takeover:`.
- I-7 Reversible → `decision:`, ship; `needs-human` = secret, irreversible money, or constitution waiting on Pato.
- I-8 Read the domain's Docs page before writing code; rewrite it after what shipped.
- I-9 Finish clean at landing; verify by observed state.
- I-10 Landed = a merged PR for the tip; only landed, clean, inactive workspaces are swept.

**ALWAYS:** reply in English · clients call Edge Functions, never the DB · no local web dev servers (web: Vercel after merge; mobile: `npx expo export --platform web`) · admin-console configs bind · generated files are never hand-edited · the repo holds no knowledge markdown.

**Generated output is never hand-edited.** `AGENTS.md` ← sibling `CLAUDE.md` (`deno task sync-rules`) · brand outputs ← `assets/brand/brand.json`. Edit `scripts/rules-quickstart.md` or a `CLAUDE.md`, then `deno task sync-rules`.

**NEVER ask.** Reversible → decide, log `decision:`, ship (I-7).

**Hierarchy:** Pato's live instruction > the Linear issue > Rules > Docs > memory.
<!-- RULES-QUICKSTART:END -->
## This repo — mesita-monorepo (root)

| Path | What |
| --- | --- |
| `apps/web-admin` | Admin console · admin.mesita.ai (Next.js · Vercel) |
| `apps/web-business` | Business console · business.mesita.ai (Next.js · Vercel) |
| `apps/web-consumer` | Consumer app · consumer.mesita.ai (Next.js · Vercel) |
| `apps/web-landing` | Marketing landing · mesita.ai (Next.js · Vercel) |
| `apps/web-validate` | Mesita Validate, the staff ticket page · live host check.mesita.ai until DNS for validate.mesita.ai (Next.js · Vercel) — QRs encode `check.mesita.ai/<code>` |
| `apps/mobile-consumer` | Native consumer app (Expo SDK 57 · RN · NativeWind) |
| `apps/mobile-business` | Native business app (Expo SDK 57 · **scaffold only**) |
| `supabase` | DB · RLS · Edge Functions — source of truth (Supabase CLI · Deno) |
| `assets` | The brand: edit `assets/brand/brand.json`, run `deno task sync-brand` — it writes every brand output (guide: Notion Docs › Design) |

- **Packages are independent install roots** (own `pnpm-workspace.yaml` + lockfile; no root pnpm workspace — mobile needs `nodeLinker: hoisted`). `cd` into a package to work; run every `supabase` command from `supabase/`.
- **Vercel:** each `apps/web-*` is its own Vercel project (canzeco team) on this repo, Root Directory `apps/web-<app>`, "skip unaffected" on — a push to `main` deploys only what changed.
- **CI is path-filtered per package** (`.github/workflows/*.yml`) plus two repo-wide gates: `rules.yml` (instruction-file sync + markdown allowlist + word budgets + the forbidden-asset guard: no `.icns`/`.jxl`/`.heif`/`.heic` anywhere) and `brand.yml` (brand sync).
- **Instruction files:** root `CLAUDE.md` = generated quickstart block + this tail · package `CLAUDE.md` = package rules only (markers forbidden) · every `AGENTS.md` = generated, what Cursor and Codex read (never a `CODEX.md`). Edit `scripts/rules-quickstart.md` or a `CLAUDE.md`, then `deno task sync-rules`; strict `--check` gates CI.
- **Workspaces, every platform (ASDM I-3, I-4):** before a code issue's first repository write, one claimed workspace: `deno task worktree add MESITA-<id> <slug>` creates it under `.claude/worktrees/`; `--adopt .` claims the checkout you launched in (launch worktree, Cursor worktree, or the cloud clone itself); plain `add MESITA-<id>` resumes the live one, never a second. Work only from that path (Claude Code `EnterWorktree path=<printed>`; Cursor: open it; Codex: `cd`), confirmed by `deno task worktree preflight` before writing. Non-code issues claim nothing; the shared checkout stays on `main` and never receives issue work. **Enforced by `scripts/preflight.sh`:** Claude Code's `PreToolUse` hook (`.claude/settings.json`) refuses Edit/Write outside a claimed workspace, the git `pre-commit` hook `boot`/`add` install refuses commits (Cursor, Codex, humans), Cursor's shell hook (`.cursor/hooks.json`) refuses `git commit`. `.worktreeinclude` names the gitignored state a worktree receives (env files only). **Preview servers** (`.claude/launch.json`): web-admin :3001 · web-business :3002 · web-consumer :3003 · web-landing :3004 · web-validate :3005 · mobile-consumer :8081 · mobile-business :8082.
