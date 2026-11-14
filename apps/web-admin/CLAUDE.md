# apps/web-admin — internal admin console (admin.mesita.ai)

> Read root [`CLAUDE.md`](../../CLAUDE.md) first. Package law only; Notion Docs › Apps describes every page.

- **Light theme, semantic tokens.** New UI takes its chrome from `src/components/admin-ui/`, never a route-local shim. Design map: Notion Docs › Design.
- **Edge Functions:** `admin-web-*` only, through the `Result`-style helper in `src/lib/supabase-ef.ts`.
- **Config pages** seed on the server, edit in a client form and save through their section's EF; Save waits on `loadError` (`admin-ui/use-config-editor.test.tsx`). A control that saves but changes nothing says so beside itself: `KnobState` reads Enforced, Fallback or Not wired.
- **Labels:** a label never repeats its section heading, and renaming a label never renames its route, config blob or EF.
- **Lists only; a place opens in the Business app** (MESITA-3104): every place page (profile, reviews, preview, Premier, internal facts) is `apps/web-business`, reached through `lib/business-url.ts`. Never rebuild a place page here.
- **Pinned by tests:** the rail (`components/Sidebar.test.ts`); Multiple Places' confirms before paid, visibility and delete writes, and Deep Enrich's skipped places (`manage-multiple/pipeline.test.ts`); Discovery as one page whose boxes each save only their own slices of `discovery-surface.ts` (`filters-config/PipelineBoxes.test.tsx`, `actions.test.ts`); banned words, Crenup, promo and membership included (`scripts/vocabulary-ratchet.ts`).
