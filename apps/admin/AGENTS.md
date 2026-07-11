<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
# apps/admin — internal admin console

> Monorepo-wide rules: root [`CLAUDE.md`](../../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

- Light theme + semantic tokens; calm and high-density — don't ornament.
- Clients never call the DB — everything via `admin-web-*` Edge Functions. The EF-invoke wrapper here is the deliberate **`Result` variant** (consumer/business throw `EFError`) — keep the divergence; dedupe only the plumbing beneath it.
- "**Atlas**" is legacy branding for the place-intelligence subsystem (why `atlas-*` routes / `atlas_*` columns persist) — it is the **Enricher**. The `/atlas-config` page is Atlas Config (profile-spec) + Enricher Config (pipeline behavior).
- `database.types.ts` is hand-copied across the web apps (`apps/*/src`) and has drifted before — regenerate from cloud, don't hand-edit.
- CI: `admin.yml` — lint · typecheck · build (Node 22+), path-filtered to `apps/admin/**`.
