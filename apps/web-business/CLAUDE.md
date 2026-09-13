# apps/web-business — business console (business.mesita.ai)

> Read root [`CLAUDE.md`](../../CLAUDE.md) first — the quickstart; Notion holds the deep docs. Package-specific rules only below.

- **Deploys** via Vercel `mesita-web-business`, Root Directory `apps/web-business`. `mesita-web-business-legacy` is a decoy.
- Light theme + semantic tokens. Calm, high-density — don't ornament.
- **Routes** (`lib/console-routes.ts`; org in the PATH, never `?org=`): `/` → last place → org → Create · `/account` · `/orgs/new` · `/orgs/<id>` ONE page (Stripe · Partner · Members · Places) · `/places` (ONE list; `?owned=` filters) · `/orgs/<id>/places/new` (Add place: search; on Mesita claim; else create then claim) · `/places/<id>/<view>` — Profile · Reviews · Activity · Settings (was Capabilities; old segment forwards) · Admin (super-admin; `admin-web-*`). `orgs/[orgId]/layout.tsx` 404s foreign and missing ids. `next.config.ts` forwards old `?org=`. **Never rebuild ticket UI** — Mesita Validate is the staff ticket surface; leave `business-web-*-ticket*` alone.
- **Nav:** LEFT RAIL, SEVEN ROWS and nothing else: Account · Organization · Place Profile · Reviews · Activity · Settings · Admin. No switcher, Plus, chip, seam, box or eyebrow in the rail; "Place " quieted by weight, never alpha; with no place the five rows stay, muted, as doors to Add place (owner) or the list. The switchers ("change organization, change place") are the Organization PAGE's: `ScopeSwitchers.tsx` under its heading, reading `RailScopeContext` that `AppShell.tsx` (`fixed inset-0` + `overflow-clip`) provides after resolving scope once (`lib/rail-scope.ts`); `main` is the only scroller; one breakpoint `lg`. `Sidebar.tsx`: `--sidebar`, `w-60`/`w-16`, zero indents, one ink pill. Every page has `loading.tsx`. `ConsoleHeader.tsx`: crumb + route.
- **Place heading, not a bar.** `PlaceHeading.tsx` is the `h1`. Rail learns a pool place from `OpenPlace.tsx`; unsaved-edits from `PlaceNavBridge.tsx` — the only console component that may read `PlaceContext`. Values travel up.
- **Layout:** fluid, no max-width. `(shell)/layout.tsx` sets `SHELL_GUTTER`; rail sits outside. Full-bleed uses `SHELL_BLEED`. `PlaceStatesTable` must never set `w-full`. Pages return a fragment. Forms cap at `FORM_COLUMN_CLASS`. Save = `PlaceSaveBar`.
- Plan SKUs: **Free** + **Verified** (`plan=pro`). Partnership is free. **"Membership" banned.** Roles: `owner`/`editor`/`viewer`.
- Clients never call the DB — `business-web-*` Edge Functions.
- CI: `web-business.yml` — lint · typecheck · test · build (Node 22+), path-filtered.
