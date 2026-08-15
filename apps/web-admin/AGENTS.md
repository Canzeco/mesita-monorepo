<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
# apps/web-admin — internal admin console

> Monorepo-wide rules: root [`CLAUDE.md`](../../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

- Light theme + semantic tokens; calm and high-density — don't ornament. Design map: [`DESIGN.md`](./DESIGN.md). Brand reference (marks, pink ramp with measured contrast, lockup rules) is the `/brand` page — a read-only surface rendered from the shipped tokens; its source is `assets/brand/brand.json` + [`BRAND.md`](../../assets/brand/BRAND.md). Shared chrome: [`src/components/admin-ui/`](./src/components/admin-ui/) (`config` · `manage` · `lineup`). New admin UI imports from there; do not grow the route-local shims.
- Clients never call the DB — everything via `admin-web-*` Edge Functions. The EF-invoke wrapper here is the deliberate **`Result` variant** (consumer/business throw `EFError`) — keep the divergence; dedupe only the plumbing beneath it.
- "**Atlas**" is legacy branding for the place-intelligence subsystem (why `atlas-*` routes / `atlas_*` columns persist) — the Enricher is the pipeline. **Atlas Config** (`/atlas-config`, profile-spec) and **Enricher Config** (`/enricher-config`, pipeline behavior) are separate sidebar parents — never treat them as one page.
- Consumer **class** ladder (canonical order, MESITA-972): `standard < influencer < premium < aura` (labels Standard · Influencer · Premium · Aura). Manage roster for the invite-only top rung: `/aura-consumers` (legacy `/aura-users` redirects there if present).
- `database.types.ts` is hand-copied across the web apps (`apps/*/src`) and has drifted before — regenerate from cloud, don't hand-edit.
- CI: `web-admin.yml` — lint · typecheck · build (Node 22+), path-filtered to `apps/web-admin/**`.
