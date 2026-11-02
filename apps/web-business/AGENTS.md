<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
# apps/web-business — the place's own console

> Read root [`CLAUDE.md`](../../CLAUDE.md) first. Package law only; Notion Docs › Apps describes every page.

- **Who may open a place is the server's answer.** Every place door is a `business-web-*` EF that asks `_shared/place-access.ts` first (a live `place_managers` row, or `super_admins`); a stranger gets 404. Hiding a link is never the gate.
- **Edge Functions:** `business-web-*` only, through the `Result`-style `src/lib/supabase-ef.ts`.
- **The whole place page lives here** (`components/place-manage/`, moved from web-admin): Profile, Preview, Premier, Settings for owners; Reviews and Internal for staff. Admin keeps the lists and links here.
- **Owners sign in by phone** (an owner is a guest account); staff by Google.
- **Premier is advertising:** every plan is tagged Ad; it never verifies a place. Money is computed by the server.
- **Light theme, semantic tokens.** Payments, Prepayments and Rewards are Coming soon pages with no forms.
