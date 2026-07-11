# Mesita monorepo — agent quickstart (INTERIM · SWARM v5 rewrite pending)

One repo, one `.git`, the whole product. Assembled 2026-07-11 from the six standalone repos (full history, paths rewritten in-history). Decision: Pato, 2026-07-11 — supersedes the earlier "multi-repo is permanent" rule everywhere it appears.

> ⚠️ **Cutover status:** until the Vercel/deploy cutover step completes, production deploys still flow from the frozen standalone repos. Do not merge product changes here until the cutover is done and this banner is removed.

**Precedence:** this file supersedes the `RULES-QUICKSTART` blocks embedded in `apps/*/CLAUDE.md` and `supabase/CLAUDE.md` (stale multi-repo mirrors until the SWARM v5 rewrite lands). The package-specific sections *below* those blocks remain valid and binding for work inside that package.

## Layout

| Path | Was | What |
| --- | --- | --- |
| `apps/admin` | `mesita-web-admin` | Internal admin console (Next.js · Vercel) |
| `apps/business` | `mesita-web-business` | Business console · business.mesita.ai (Next.js · Vercel) |
| `apps/consumer` | `mesita-web-consumer` | Consumer app · consumer.mesita.ai (Next.js · Vercel) |
| `apps/landing` | `mesita-web-landing` | Marketing landing (Next.js · Vercel) |
| `apps/mobile` | `mesita-mobile-consumer` | Native consumer app (Expo SDK 57 · RN · NativeWind) |
| `supabase` | `mesita-supabase` | DB · RLS · Edge Functions — source of truth (Supabase CLI · Deno) |

## How to work (monorepo SWARM, interim)

- **One agent = one git worktree of this repo = one branch** `agent/<ISSUE-ID>-<slug>` = **one squash PR** (`Closes MESITA-…`). A change spanning several packages is now ONE atomic PR — the old "same branch name in every repo, one PR per repo" ceremony is dead.
- Never push to `main`. Claim Linear issues with `claimed: <platform>:<session-slug> · branch:<actual-branch>`; set terminal status same session; alone + small fix → branch, PR, merge yourself, one-line issue at merge time.
- Where things live: **Linear** (team Mesita, `MESITA-`) = work state · **Notion** Rules page = knowledge master (its multi-repo sections are being rewritten; where they conflict with this file, **this file wins** per the 2026-07-11 decision) · **GitHub Canzeco** = code, this repo.

## ALWAYS (product rules — unchanged by the migration)

- Reply in English · clients call **Edge Functions, never the DB** · mirror every Supabase cloud change into `supabase/` **same session** · comply with admin-console configs (Atlas / Enricher / Sourcing / Memo bind every EF, app & agent — unenforced config = bug).
- No local dev servers for verification: web apps verify via Vercel; mobile verifies via `pnpm typecheck` · `pnpm lint` · `npx expo export --platform web` (+ the `mobile` preview config, port 8081).
- **NEVER ask.** Reversible → decide, log a `decision:` comment, ship. Only two `needs-human` cases: a secret you can't enter, or one irreversible money/publish trigger.
- Hierarchy on conflict: Pato's live instruction > the Linear issue > Notion > memory.

## Packages

- `apps/*` — independent pnpm roots (own `pnpm-workspace.yaml` + lockfile; **no root workspace on purpose**: mobile needs `nodeLinker: hoisted`, web apps use the default isolated linker). `cd` in, `pnpm install`, same scripts as before (`lint` / `typecheck` / `build`).
- `supabase/` — Deno + Supabase CLI. Run every `supabase` command from `supabase/`. Tests: `cd supabase && deno task test`. All Supabase files live only here — kill stray `supabase/` config stubs anywhere else in the tree.
- CI: `.github/workflows/{admin,business,consumer,landing,mobile,supabase}.yml` — path-filtered; touch only what you change.
- `scripts/sync-rules.ts` (under `supabase/scripts/`) still assumes the retired sibling-repo layout — do not run it until the SWARM v5 rewrite retargets it.
