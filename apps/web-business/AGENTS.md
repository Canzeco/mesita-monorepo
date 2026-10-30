<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
# apps/web-business — the place's console (business.mesita.ai)

> Read root [`CLAUDE.md`](../../CLAUDE.md) first. Package law only.

- **Mock only.** Every screen reads `src/lib/mock.ts`; no Supabase, no env vars, no Edge Function calls yet, and the `MOCK` banner stays until real data replaces it. A save changes only the screen.
- **Phone first.** Four tabs (Visits, Rewards, Payments, Credits) plus More below `lg`; the dark rail above it. Both read `src/lib/nav.ts`, the one menu.
- **Money math lives in `src/lib/rewards.ts`**: max 2 rewards a visit, the peso cap, tip on the bill before rewards, 10% prepayment bonus. Screens and mock data compute through it; `rewards.test.ts` pins it.
- **Light work area, semantic tokens** (`bg-card`, `text-muted-foreground`); only the rail is dark (`bg-rail`).
- Banned words fail `scripts/vocabulary-ratchet.ts`.
