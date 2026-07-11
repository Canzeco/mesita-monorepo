# apps/landing — marketing landing

> Monorepo-wide rules: root [`CLAUDE.md`](../../CLAUDE.md) (the quickstart) — read it first. This file adds only package-specific rules.

- Light theme. **The word "venue" is prohibited** → use "place" / "business"; keep the package grep-clean (`grep -rin venue apps/landing/src` = 0).
- Static marketing site — needs no Supabase env vars.
- CI: `landing.yml` — lint · typecheck · build (Node 22+), path-filtered to `apps/landing/**`.
