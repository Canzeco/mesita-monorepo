# apps/web-admin — internal admin console (admin.mesita.ai)

> Read root [`CLAUDE.md`](../../CLAUDE.md) first. Package law only; Notion Docs › Apps describes every page.

- **Light theme, semantic tokens.** New UI takes its chrome from `src/components/admin-ui/`, never a route-local shim. Design map: Notion Docs › Design.
- **Edge Functions:** `admin-web-*` only, through the `Result`-style helper in `src/lib/supabase-ef.ts`.
- **Config pages** seed on the server, edit in a client form and save through their section's EF; Save waits on `loadError` (`admin-ui/use-config-editor.test.tsx`). A control that saves but changes nothing says so beside itself: `KnobState` reads Enforced, Fallback or Not wired.
- **Labels:** a label never repeats its section heading, and renaming a label never renames its route, config blob or EF.
- **Preview renders `packages/place-profile`** (Rules §2): change the place screen there, never copy it here.
- **Pinned by tests:** the rail (`components/Sidebar.test.ts`); Multiple Places' Create · Enrich · Edit boxes (`manage-multiple/pipeline.test.ts`, `MultiplePlacesClient.test.tsx`); Discovery as one page whose boxes each save only their own slices of `discovery-surface.ts` (`filters-config/PipelineBoxes.test.tsx`, `actions.test.ts`); Single Place's tabs (`PlaceTabStrip.test.ts`); banned words, Crenup, promo and membership included (`scripts/vocabulary-ratchet.ts`).
