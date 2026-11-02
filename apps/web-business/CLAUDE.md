# apps/web-business — the place's own console

> Read root [`CLAUDE.md`](../../CLAUDE.md) first. Package law only; Notion Docs › Apps describes every page.

- **Who may open a place is the server's answer.** Every place door is a `business-web-*` EF that asks `_shared/place-access.ts` first (a live `place_managers` row, or `super_admins`); a stranger gets 404. Hiding a link is never the gate.
- **Edge Functions:** `business-web-*` only, through the `Result`-style `src/lib/supabase-ef.ts`.
- **The profile editor lives here** (`components/place-manage/`, moved from web-admin). There is one editor; admin links to it.
- **Owners sign in by phone** (an owner is a guest account); staff by Google.
- **Premier is advertising:** every plan is tagged Ad; it never verifies a place. Money is computed by the server.
- **Light theme, semantic tokens.** Payments, Prepayments and Rewards are Coming soon pages with no forms.
