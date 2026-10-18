# apps/web-landing — marketing landing (mesita.ai)

> Read root [`CLAUDE.md`](../../CLAUDE.md) first. Package law only; the tests named here pin the rest.

- A static site: light theme, no Supabase, no env vars.
- `/terms` and `/privacy` are an unreviewed draft (MESITA-1888): describe only what the code does, name no regulator, promise no retention period. `src/lib/__tests__/legal-routes.test.ts` pins the draft banner on both and that `src/app/sitemap.ts` lists every static route.
- Banned words ("venue": say "place") fail `scripts/vocabulary-ratchet.ts`; the list lives on Notion Docs › Vocabulary.
