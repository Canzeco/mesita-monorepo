<!-- RULES-QUICKSTART:START (generated — do not hand-edit; run: deno task sync-rules) -->
# Mesita — agent quickstart (you're ~90% correct after this)

**Notion is the library, and it is deep — it wins on any conflict.** This block mirrors [**Rules**](https://www.notion.so/Rules-395a9bf37a528081b2c1dacc445bb6c8) §0. **Rules = the law:** 🤖 **ASDM Rules** — the one protocol for all agent work, your platform's ramp (isolation, branch naming, connectors) in **§K** · 🏛️ **Product Rules** = WHAT Mesita is · ⚙️ **Development Rules** = tooling gotchas + the knowledge chain. **📚 [Docs](https://www.notion.so/Docs-3bfa9bf37a52801e891ec3407d717273) = the knowledge**, one flat page per domain: Apps, Atlas, Intake, Discovery, Passport, Promos, Visits, Orders, Reservations, Checkout, Credits, Vocabulary, Design. Read the matching doc first; mirror shipped changes back the same session. **Rules beat Docs.**

**The repo.** `Canzeco/mesita-monorepo` is the whole product: `apps/{web-admin,web-business,web-consumer,web-landing,web-validate,mobile-consumer,mobile-business}` + `supabase/` + `assets/`. The six former standalone repos are frozen — never work in them. Package-specific rules: that package's `CLAUDE.md`.

**The blackboard.** Agents never talk to each other. **Linear** (team Mesita, `MESITA-`) carries intent — issues + comments ONLY (claims, `decision:` comments, statuses); **Linear documents and Claude Artifacts are prohibited**. **git/GitHub** carries the work — branches and squash PRs; `Closes <ID>` is the join. Chat is ephemeral: durable state → Linear, durable knowledge → Notion, same session.

**The loop.**

- Solo (no other live claim on the repo): branch off fresh main → work → squash-PR → merge it yourself → one-line issue at merge time (Ops & maintenance).
- Multi-agent (anyone else live, or in doubt): PICK an unblocked issue whose footprint doesn't overlap an active claim → CLAIM (`claimed: <platform>:<session-slug> · branch:<actual-branch>`) → work isolated → squash-merge yourself.
- **One issue = one branch = one worktree = one squash PR**, however many packages it spans. Parallelism = child issues + subagents (≤5), each in its own worktree off fresh `origin/main`.
- The harness prefixes your branch (`claude/*`, local and cloud) and auto-opens a remote PR as a **draft**: declare the real branch in your claim; adopt that PR — `Closes <ID>` in the body, `gh pr ready` — never a second.
- Capability follows connectors, not location — a cloud VM is a full peer when claude.ai connectors ride the session; probe at BOOT with one Linear read. A missing connector demotes only that surface: hand the residue (pushed branch + PR) to the dispatcher, noted in the claim. Secrets never travel.
- Cowork never opens a live repo checkout — `cowork` issues in non-repo folders only.

**The backend is a singleton.** One Supabase project, ONE live schema and EF set — Supabase branching deliberately unused; schema/EF surface is claimed footprint. Merging to main auto-deploys every EF, so a cloud-only edit dies at the next merge: mirror every cloud change into `supabase/` the same session; migrations apply via MCP/CLI, then reconcile the ledger (Development Rules §B).

**ALWAYS:** reply in English · clients call Edge Functions, never the DB · never push to `main` (enforced: a ruleset requires squash PRs and blocks force-push) · terminal statuses same session · no local web dev servers — web verifies on Vercel, mobile via `npx expo export --platform web` + the Metro web preview · admin-console configs bind every EF, app and agent — General · **Intake** · Discovery · Visits · Orders · Reservations · Promos. **Those are labels; the directories are frozen and a rename never follows them** (Discovery = `/filters-config`, Promos = `/rewards-config`, Intake = `/enricher-config`). Unenforced config = bug; a page whose engine is unbuilt shows Soon, not knobs.

**Generated output is never hand-edited.** `AGENTS.md` ← its sibling `CLAUDE.md` (`deno task sync-rules`): Claude reads `CLAUDE.md`, Cursor and Codex `AGENTS.md`; always edit `CLAUDE.md` · every brand output ← `assets/brand/brand.json` (`deno task sync-brand`; guide: 🎨 Docs › Design). Both CI-gated. **The repo holds no other markdown:** knowledge → Notion · task context → Linear · code notes → code comments; the allowlist (`CLAUDE.md`/`AGENTS.md` pairs, `scripts/rules-quickstart.md`, `.claude/` `.cursor/` `.codex/` `.github/`) is CI-enforced. **Docs are rewritten, not amended** — present law only, no history trails; word budgets CI-enforced (Development Rules §C).

**NEVER ask.** Reversible → decide, log a `decision:` comment, ship. `needs-human` = only a secret you can't enter, or one irreversible money/publish trigger.

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
