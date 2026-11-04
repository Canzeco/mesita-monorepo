# apps/web-business — the place's own console

> Read root [`CLAUDE.md`](../../CLAUDE.md) first. Package law only; Notion Docs › Apps describes every page.

- **Who may open a place is the server's answer.** Every place door is a `business-web-*` EF that asks `_shared/place-access.ts` first (a live `place_managers` row, or `super_admins`); a stranger gets 404. Hiding a link is never the gate.
- **Edge Functions:** `business-web-*` only, through the `Result`-style `src/lib/supabase-ef.ts`.
- **The whole place page lives here** (`components/place-manage/`, moved from web-admin); staff also get Reviews and Internal. Admin only links here.
- **Google accounts only**, owners and staff; every Business door refuses any other session (`google_only`).
- **Premier is advertising:** guests see every paid level marked Ad; it never verifies a place. Money is computed by the server.
- **Light theme, semantic tokens.** Soon lists what is not on yet: copy only.
