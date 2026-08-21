# apps/web-landing — marketing landing

> Read root [`CLAUDE.md`](../../CLAUDE.md) first — the quickstart; Notion holds the deep docs. Package-specific rules only below.

- Light theme. **The word "venue" is prohibited** → use "place" / "business"; keep the package grep-clean (`grep -rin venue apps/web-landing/src` = 0).
- Static marketing site — needs no Supabase env vars.
- CI: `web-landing.yml` — lint · typecheck · build (Node 22+), path-filtered to `apps/web-landing/**`.
