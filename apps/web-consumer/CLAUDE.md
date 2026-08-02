# apps/web-consumer — consumer app (consumer.mesita.ai)

> Monorepo-wide rules: root [`CLAUDE.md`](../../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

- **Light theme + semantic tokens only** (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`) — never `bg-zinc-900`/`text-white` on app surfaces.
- **Consumer surfaces must read premium:** branded gradients on hero/promo, tinted icon circles, differentiated chip colors, calibrated copy. Plain wireframe stacks are a regression.
- **Parked building blocks:** unused feature components + mock data are deliberately parked for later un-park — knip/ts-prune "unused" here is usually NOT dead code. Check for a parking comment, a "coming soon" route, or a live `@modal` before deleting.
- **Overlay & loading primitives are mandatory:** route modals via `SlideOverShell`/`BottomSheetShell` mounted from the segment `layout.tsx` (never `page.tsx`); state overlays via `LocalSheet`/`LocalDialog` (never `fixed inset-0` / bare `absolute`); loading via `Spinner`/`Skeleton`. Z-scale: BottomNav 40 · @modal 120 · local 130 · Toaster 140. Lint baseline = **0**.
- Five bottom tabs (Home/Search/Rewards/Reservations/Profile). Consumers have a **class** (Standard / Premium / Influencer / Aura — segments v6, mutually exclusive; `magnetic` and `free` are retired keys) on the flat **`/me`** page — Class & Settings open as modals, not sub-routes; legacy `/me/class`, `/me/settings`, `/me/plan`, and `/profile` all redirect to `/me`. Favorites = localStorage (`useSavedPlaces()`), not an EF. Referral page = `/share` (`/invite` redirects). AI persona = **Don Memo** (`/discover/ai`, Spanish-first — only the AI's own messages are Spanish).
- Clients never call the DB — everything via `consumer-web-*` Edge Functions.
- CI: `web-consumer.yml` — typecheck · build blocking, lint non-blocking (MESITA-145) (Node 22+), path-filtered to `apps/web-consumer/**`.
