<!-- RULES-QUICKSTART:START (generated — do not hand-edit; run: deno task sync-rules) -->
# Mesita — agent quickstart (you're ~90% correct after this)

**Notion is the library, and it is deep — it wins on any conflict.** This block mirrors [**Rules**](https://www.notion.so/Rules-395a9bf37a528081b2c1dacc445bb6c8) §0. **Rules = the law:** 🤖 **ASDM Rules** — the protocol (model, invariants `I-1`…`I-10`, loop, platform table) · 🏛️ **Product Rules** = WHAT Mesita is · ⚙️ **Development Rules** = tooling gotchas + the knowledge chain. **📚 [Docs](https://www.notion.so/Docs-3bfa9bf37a52801e891ec3407d717273) = the knowledge**, one flat page per domain: Apps, Atlas, Intake, Discovery, Passport, Rewards, Visits, Orders, Reservations, Events, Checkout, Credits, Vocabulary, Design. Read the matching doc first; mirror shipped changes back the same session. **Rules beat Docs.**

**The repo.** `Canzeco/mesita-monorepo` is the whole product: `apps/{web-admin,web-business,web-consumer,web-landing,web-validate,mobile-consumer,mobile-business}` + `supabase/` + `assets/`. The six former standalone repos are frozen — never work in them. Package-specific rules: that package's `CLAUDE.md`.

**The blackboard.** Agents never talk to each other. **Linear** (team Mesita, `MESITA-`) carries intent — issues + comments ONLY; **Linear documents and Claude Artifacts are prohibited**. **git/GitHub** carries the work — branches and squash PRs; `Closes MESITA-<id>` is the join.

**The model.** Issue = intent. Claim = In Progress + one claim line, the only lock. Workspace = a checkout a live claim names (worktree + branch, or a cloud clone): one per code issue, none for a non-code issue. PR = one per workspace, joined by `Closes`. Session = a visit (many issues per session, many sessions per issue). Lobby = a checkout with no live claim: the shared `main` checkout, or your launch worktree between claims.

**Boot card.** Needs `deno` and `gh auth`. `deno task boot` → pick → `deno task worktree add MESITA-<id> <slug>` (`--adopt .` for your launch worktree) → EnterWorktree the printed path, In Progress, paste the printed claim line → work → `deno task worktree pr` · `gh pr ready` · `gh pr merge --squash` → `deno task worktree remove MESITA-<id>` from a lobby (`leave` keeps your launch worktree) → terminal status, Docs mirrored.

**The invariants** (ASDM §B).
- I-1 Every repo or cloud write has an issue, in a project.
- I-2 `main` only by squash PR; every PR passes all seven required checks.
- I-3 One code issue = one branch = one worktree = one PR; a second issue, a second workspace.
- I-4 The shared checkout holds no work of its own; `repair-lobby` fixes it.
- I-5 The backend is a singleton: cloud == repo, same session.
- I-6 Claims are the only lock; stale after 24h idle, then `takeover:`.
- I-7 Reversible → decide, `decision:`, ship; `needs-human` only when physically blocked.
- I-8 Read the domain's Docs page before; mirror after.
- I-9 Finish clean at landing; verify by observed state.
- I-10 Landed = a merged PR for the tip; only landed, clean, inactive workspaces are swept.

**The loop.** BOOT (`deno task boot`, one Linear read) · PICK (unblocked, footprint-disjoint) · ISOLATE (`worktree add`, EnterWorktree path) · CLAIM (In Progress + the line) · WORK (Docs first, small commits, push early) · SHIP (`worktree pr`, ready, merge yourself, verify) · LEAVE (`worktree remove` from a lobby) · FINISH (statuses, Docs, decisions). Platform table: ASDM §D.

**The backend is a singleton.** One Supabase project, ONE live schema and EF set, branching unused; a merge to main auto-deploys every EF, so mirror every cloud change into `supabase/` the same session (Development Rules §B).

**ALWAYS:** reply in English · clients call Edge Functions, never the DB · never push to `main` · no local web dev servers: web verifies on Vercel, mobile via `npx expo export --platform web` · admin-console configs bind every EF, app and agent (General · Intake · Discovery · Visits · Orders · Reservations · Rewards); unenforced config = bug; routes never follow a label.

**Generated output is never hand-edited.** `AGENTS.md` ← its sibling `CLAUDE.md` (`deno task sync-rules`) · every brand output ← `assets/brand/brand.json` (`deno task sync-brand`); both CI-gated. **The repo holds no other markdown:** knowledge → Notion · task context → Linear · code notes → code comments. **Docs are rewritten, not amended**; word budgets CI-enforced (Development Rules §C).

**NEVER ask.** Reversible → decide, log a `decision:` comment, ship (I-7).

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
- **CI is path-filtered per package** (`.github/workflows/*.yml`) plus two repo-wide gates: `rules.yml` (instruction-file sync + markdown allowlist + word budgets + the forbidden-asset guard: no `.icns`/`.jxl`/`.heif`/`.heic` anywhere — `image-size`'s advisories are unpatched and those are the formats they parse) and `brand.yml` (brand sync).
- **Instruction files:** root `CLAUDE.md` = generated quickstart block + this tail · package `CLAUDE.md` = package rules only (markers forbidden) · every `AGENTS.md` = generated. Edit `scripts/rules-quickstart.md` or a `CLAUDE.md`, then `deno task sync-rules`; strict `--check` gates CI.
- **Worktrees:** `.worktreeinclude` lists the gitignored state every new worktree needs. **Preview servers** (`.claude/launch.json`): web-admin :3001 · web-business :3002 · web-consumer :3003 · web-landing :3004 · web-validate :3005 · mobile-consumer :8081 · mobile-business :8082.
