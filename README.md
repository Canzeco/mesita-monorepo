# mesita-monorepo

One repository for the whole Mesita product — assembled 2026-07-11 from the six standalone repos with **full git history** (1,696 imported commits; every historical path rewritten to its new prefix, so `git log` / `git blame` work natively across the whole tree).

| Path | Was | What |
| --- | --- | --- |
| `apps/web-admin` | `mesita-web-admin` | Internal admin console · admin.mesita.ai (Next.js · Vercel) |
| `apps/web-business` | `mesita-web-business` | Business console · business.mesita.ai (Next.js · Vercel) |
| `apps/web-consumer` | `mesita-web-consumer` | Consumer app · consumer.mesita.ai (Next.js · Vercel) |
| `apps/web-landing` | `mesita-web-landing` | Marketing landing · mesita.ai (Next.js · Vercel) |
| `apps/web-check` | — | Mesita Check, the staff check page · check.mesita.ai (Next.js · Vercel) |
| `apps/mobile-consumer` | `mesita-mobile-consumer` | Native consumer app (Expo SDK 57 · React Native) |
| `apps/mobile-business` | — | Native business app (Expo SDK 57 · scaffold only) |
| `supabase` | `mesita-supabase` | DB · RLS · Edge Functions — source of truth (Supabase CLI · Deno) |
| `assets` | workspace `logos/` | Brand source of truth — `brand.json` tokens + generated SVG/PNG/PDF marks ([assets/brand](./assets/brand)); regenerate with `deno task sync-brand` |

## Working in it

- Each app is an **independent install root** (own `pnpm-workspace.yaml` + own lockfile). There is deliberately **no root pnpm workspace** — the mobile app requires `nodeLinker: hoisted` (Metro/RN) while the web apps use pnpm's default isolated linker. `cd` into an app and use it exactly as before.
- `supabase/` is the Supabase CLI project — run every `supabase` command from `supabase/` (config lives at `supabase/supabase/config.toml`).
- CI: path-filtered per-package workflows in `.github/workflows/` — a PR only runs the pipelines of the packages it touches.
- Agent rules: root [`CLAUDE.md`](./CLAUDE.md) / [`AGENTS.md`](./AGENTS.md).

The six standalone repos are frozen as of the cutover and kept read-only for reference; their PR history remains on GitHub.
