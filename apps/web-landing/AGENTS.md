<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
# apps/web-landing — marketing landing

> Read root [`CLAUDE.md`](../../CLAUDE.md) first — the quickstart; Notion holds the deep docs. Package-specific rules only below.

- Light theme. **The word "venue" is prohibited** → use "place" / "business"; keep the package grep-clean (`grep -rin venue apps/web-landing/src` = 0).
- Static marketing site — needs no Supabase env vars.
- CI: `web-landing.yml` — lint · typecheck · test · build (Node 22+), path-filtered to `apps/web-landing/**`.
- `/terms` and `/privacy` are an **unreviewed draft** (MESITA-1888) and say so in a banner on both pages: describe only what the code does, name no regulator, promise no retention period. Their shell is `src/components/landing/legal.tsx`; every static route must also appear in `src/app/sitemap.ts` — `src/lib/__tests__/legal-routes.test.ts` asserts the two are the same set.
