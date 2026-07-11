<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
# apps/business — business console (business.mesita.ai)

> Monorepo-wide rules: root [`CLAUDE.md`](../../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

- **Deploys via the Vercel `mesita-web-business` project**, which must point at `Canzeco/mesita-monorepo` with Root Directory `apps/business` once the cutover lands. The frozen standalone repos — especially `mesita-web-business-legacy` — are decoys; a wrong connection = silent no-deploy.
- Light theme + semantic tokens. Business surfaces stay **calm and high-density** — don't ornament them.
- **Layout convention:** page container `mx-auto max-w-6xl` + section cards `grid grid-cols-1 gap-4 md:grid-cols-2`; constrain the Topbar to the same `max-w-6xl` so the title shares the cards' left edge; wide sections span the full row; global save = a small floating chip bottom-right. Reference implementation: the Place page (`EditVenueForm.tsx`).
- Nomenclature: businesses subscribe to a **plan** (`free`/`pro`/`ultra`, labels Free/Pro/Ultra — "Promote" retired). Per-project member roles: `owner`/`editor`/`viewer`.
- Clients never call the DB — everything via `business-web-*` Edge Functions.
- CI: `business.yml` — typecheck · build blocking, lint non-blocking (known-red baseline) (Node 22+), path-filtered to `apps/business/**`.
