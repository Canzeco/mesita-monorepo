# apps/web-admin — internal admin console

> Monorepo-wide rules: root [`CLAUDE.md`](../../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

- Light theme + semantic tokens; calm and high-density — don't ornament. Design map: [`DESIGN.md`](./DESIGN.md) (canonical page templates, debt lakes, DO/DON'T). New admin UI follows its canonical paths; dualities are debt — do not copy.
- Clients never call the DB — everything via `admin-web-*` Edge Functions. The EF-invoke wrapper here is the deliberate **`Result` variant** (consumer/business throw `EFError`) — keep the divergence; dedupe only the plumbing beneath it.
- "**Atlas**" is legacy branding for the place-intelligence subsystem (why `atlas-*` routes / `atlas_*` columns persist) — it is the **Enricher**. The `/atlas-config` page is Atlas Config (profile-spec) + Enricher Config (pipeline behavior).
- `database.types.ts` is hand-copied across the web apps (`apps/*/src`) and has drifted before — regenerate from cloud, don't hand-edit.
- CI: `web-admin.yml` — lint · typecheck · build (Node 22+), path-filtered to `apps/web-admin/**`.
