# apps/web-admin — internal admin console

> Monorepo-wide rules: root [`CLAUDE.md`](../../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

- Light theme + semantic tokens; calm and high-density — don't ornament. Design map: [`DESIGN.md`](./DESIGN.md) (canonical page templates, debt lakes, DO/DON'T). New admin UI follows its canonical paths; dualities are debt — do not copy.
- Clients never call the DB — everything via `admin-web-*` Edge Functions. The EF-invoke wrapper here is the deliberate **`Result` variant** (consumer/business throw `EFError`) — keep the divergence; dedupe only the plumbing beneath it.
- "**Atlas**" is legacy branding for the place-intelligence subsystem (why `atlas-*` routes / `atlas_*` columns persist) — the Enricher is the pipeline. **Atlas Config** (`/atlas-config`, profile-spec) and **Enricher Config** (`/enricher-config`, pipeline behavior) are separate sidebar parents — never treat them as one page.
- Consumer **class** ladder (canonical order, MESITA-972): `standard < influencer < premium < aura` (labels Standard · Influencer · Premium · Aura). Manage roster for the invite-only top rung: `/aura-consumers` (legacy `/aura-users` redirects there if present).
- `database.types.ts` is hand-copied across the web apps (`apps/*/src`) and has drifted before — regenerate from cloud, don't hand-edit.
- CI: `web-admin.yml` — lint · typecheck · build (Node 22+), path-filtered to `apps/web-admin/**`.
