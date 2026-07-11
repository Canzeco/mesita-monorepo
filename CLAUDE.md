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
- **ALWAYS:** reply in English · clients call Edge Functions, never the DB · never push to `main` · mirror every Supabase cloud change into `supabase/` same session · set terminal status same session · no local dev servers (web verifies via Vercel; mobile via `npx expo export --platform web` + the `mobile-consumer` preview config) · comply with admin-console configs (Atlas / Enricher / Sourcing / Memo bind every EF, app & agent — unenforced config = bug).
- **NEVER ask.** Reversible → decide, log a `decision:` comment, ship. Only two `needs-human` cases: a secret you can't enter, or one irreversible money/publish trigger.
- **When in doubt**, hierarchy wins: Pato's live instruction > the Linear issue > Notion > memory.

Where things live: **Linear** (team Mesita, `MESITA-`) = work state · **Notion** = knowledge · **GitHub** = code (`Canzeco/mesita-monorepo`). Instruction files chain to their master: package `CLAUDE.md`/`AGENTS.md` (package rules only) → root `CLAUDE.md` (this quickstart) → Notion; every `AGENTS.md` is generated from its sibling `CLAUDE.md` — never hand-edit; `deno task sync-rules` regenerates, CI enforces (Development Rules §C).
<!-- RULES-QUICKSTART:END -->
## This repo — mesita-monorepo (root)

> ⚠️ **CUTOVER IN PROGRESS** (temporary banner, 2026-07-11): Vercel still deploys the web apps from the frozen standalone repos. Until the deploy cutover lands and this banner is removed, do not merge product changes here — docs/tooling only.

| Path | Was | What |
| --- | --- | --- |
| `apps/web-admin` | `mesita-web-admin` | Internal admin console (Next.js · Vercel) |
| `apps/web-business` | `mesita-web-business` | Business console · business.mesita.ai (Next.js · Vercel) |
| `apps/web-consumer` | `mesita-web-consumer` | Consumer app · consumer.mesita.ai (Next.js · Vercel) |
| `apps/web-landing` | `mesita-web-landing` | Marketing landing (Next.js · Vercel) |
| `apps/mobile-consumer` | `mesita-mobile-consumer` | Native consumer app (Expo SDK 57 · RN · NativeWind) |
| `supabase` | `mesita-supabase` | DB · RLS · Edge Functions — source of truth (Supabase CLI · Deno) |
| `assets` | — | Shared brand assets (`assets/brand` = canonical marks; update here first, propagate to apps same PR) |

- **Packages are independent install roots** (own `pnpm-workspace.yaml` + lockfile; **no root pnpm workspace on purpose** — mobile needs `nodeLinker: hoisted`, web apps use the default isolated linker). `cd` into a package and use it as before; `supabase/` is Deno + the Supabase CLI (run every `supabase` command from `supabase/`).
- **CI is path-filtered per package** (`.github/workflows/{web-admin,web-business,web-consumer,web-landing,mobile-consumer,supabase}.yml` + `rules.yml`) — a PR only runs the pipelines of what it touches.
- **Instruction files are generated:** root `CLAUDE.md` = quickstart block (markers) + this tail; package `CLAUDE.md` = package rules only (no quickstart block); every `AGENTS.md` = generated mirror — never hand-edit one. Edit `scripts/rules-quickstart.md` (quickstart) or a `CLAUDE.md` tail, then run `deno task sync-rules`; strict `--check` runs in CI (`rules.yml`).
- **Worktrees:** `.worktreeinclude` lists the gitignored local state every new worktree needs (Claude Code copies it automatically; Cursor via `.cursor/worktrees.json`; otherwise copy those paths manually).
- **Preview servers** (`.claude/launch.json`): web-admin :3001 · web-business :3002 · web-consumer :3003 · web-landing :3004 · mobile-consumer :8081 (`expo start --web`).

## Cursor Cloud specific instructions

Durable, non-obvious notes for cloud agents (the startup update script already ran `pnpm install` in every app root). Standard commands live in each package's `package.json`, `.claude/launch.json`, and `.github/workflows/*.yml` — use those; only the caveats below aren't obvious.

- **Toolchain (pre-installed, persisted in the VM image):** Node 22, `pnpm@11.1.2` (via corepack; the mobile package pins it in `packageManager`), and **Deno 2.9.1** at `~/.deno/bin` (added to `PATH` in `~/.bashrc`). The Supabase CLI is intentionally NOT installed — cloud agents never deploy; Deno alone covers the `supabase/` lint + test suite.
- **Required env files are gitignored — recreate if missing.** The web apps read env at call time and throw on the root/authed routes without it. Values are the **public publishable** Supabase pair (already committed in `apps/mobile-consumer/.env.example`), safe to write:
  - `apps/{web-consumer,web-business,web-admin}/.env.local` → `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `apps/mobile-consumer/.env` → `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `apps/web-landing` needs no env (fully static).
- **The consumer app is behind a hard phone-OTP wall.** `apps/web-consumer/src/app/(shell)/layout.tsx` calls `getUser()` and redirects anonymous visitors to `/?next=…`, so `/`, `/home`, `/search`, etc. render the sign-in page in a browser even though the server component *does* fetch real places first (the middleware "public browsing" comment is superseded by this layout gate). A logged-in browse therefore needs a phone-OTP sign-in. **Consumer test login (hardcoded, no real SMS): phone `+52 444 549 9597`, fixed code `123456`** — an existing onboarded account ("Patricio", Free tier), so it lands straight in the app (no onboarding). The **live backend is also reachable with the public key** (e.g. `POST https://<ref>.supabase.co/functions/v1/consumer-web-list-places`) to smoke-test discovery without auth.
- **Lint baselines differ per app (matches CI):** `web-consumer` and `web-business` lint is **known-red and non-blocking** — `typecheck` + `build` are the blocking gates. `web-admin` and `web-landing` lint is clean/blocking. Mobile gates on `pnpm typecheck` + `pnpm lint` + `npx expo export --platform web` (the export catches Metro/NativeWind breaks `tsc` misses).
- **Supabase checks run offline from `supabase/`:** `deno task test` (154 tests, no DB/network) and `deno lint --rules-exclude=no-unversioned-import,no-import-prefix supabase/functions`.
- **Running a web app to verify** (the repo convention is Vercel previews, but a local `next dev` works): use the `.claude/launch.json` commands/ports — the apps' own `package.json` `dev` scripts have colliding ports (e.g. web-consumer `-p 3001`, web-admin bare→3000).
