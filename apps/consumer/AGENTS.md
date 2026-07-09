<!-- GENERATED — mesita-supabase/scripts/sync-rules.ts mirrors this file from CLAUDE.md. Edit CLAUDE.md (below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
<!-- RULES-QUICKSTART:START (generated — do not hand-edit; run: deno run -A mesita-supabase/scripts/sync-rules.ts) -->
# Mesita — agent quickstart (you're ~90% correct after this)

Stable mirror of the top of the Notion **Rules** page (the master — Notion wins on any conflict). Full page + appendix: https://www.notion.so/Rules-395a9bf37a528081b2c1dacc445bb6c8

Same rules, one Linear ledger, on every platform — only your **platform protocol** (isolation, branch naming, connectors) differs. Find yours: Rules appendix §K "Platform protocols".

| You're reading | You are |
| --- | --- |
| `CLAUDE.md` | Claude Code (local · cloud · subagent) or Claude Cowork |
| `AGENTS.md` | Cursor, Codex, or any open-standard agent — generated from `CLAUDE.md`; hand edits go there |

- **Alone + small fix?** → branch off fresh main, work, PR, merge it yourself, create the one-line issue at merge time (Ops & maintenance). That's the whole loop.
- **Other agents live on the repo?** → full SWARM: pick → claim (`claimed: <platform>:<session-slug> · branch:<actual-branch>`) → isolated checkout → merge.
- **One issue can span repos:** use the SAME branch name `agent/<ISSUE-ID>-<slug>` in every repo it touches, one squash PR per repo (each says `Closes <ID>` or `Part of <ID>`); the issue closes when the last PR merges. No child-issue ceremony for small cross-repo changes.
- **One agent = one isolated checkout = one branch.** Platform-native isolation counts (Desktop/Cursor worktrees, cloud clones). Canonical branch `agent/<ISSUE-ID>-<slug>`; if your platform forces another name (e.g. `cursor/*`), declare it in your claim.
- **Cowork never opens a live repo checkout** — `cowork`-label issues (docs/research/analysis) in non-repo folders only.
- **ALWAYS:** reply in English · clients call Edge Functions, never the DB · never push to `main` · mirror every Supabase cloud change into `mesita-supabase` same session · set terminal status same session · no local dev servers (verify via Vercel).
- **NEVER ask.** Reversible → decide, log a `decision:` comment, ship. Only two `needs-human` cases: a secret you can't enter, or one irreversible money/publish trigger.
- **When in doubt**, hierarchy wins: Pato's live instruction > the Linear issue > Notion > memory.

Where things live: **Linear** (team Mesita, `MESITA-`) = work state · **Notion** = knowledge · **GitHub Canzeco** = code.
<!-- RULES-QUICKSTART:END -->

## This repo — mesita-web-consumer (consumer app · consumer.mesita.ai)

- **Light theme + semantic tokens only** (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`) — never `bg-zinc-900`/`text-white` on app surfaces.
- **Consumer surfaces must read premium:** branded gradients on hero/promo, tinted icon circles, differentiated chip colors, calibrated copy. Plain wireframe stacks are a regression.
- **Parked building blocks:** unused feature components + mock data are deliberately parked for later un-park — knip/ts-prune "unused" here is usually NOT dead code. Check for a parking comment, a "coming soon" route, or a live `@modal` before deleting.
- **Overlay & loading primitives are mandatory:** route modals via `SlideOverShell`/`BottomSheetShell` mounted from the segment `layout.tsx` (never `page.tsx`); state overlays via `LocalSheet`/`LocalDialog` (never `fixed inset-0` / bare `absolute`); loading via `Spinner`/`Skeleton`. Z-scale: BottomNav 40 · @modal 120 · local 130 · Toaster 140. Lint baseline = **0**.
- Five bottom tabs (Home/Search/Rewards/Reservations/Profile). Consumers have a **class** (Free / Premium) on the flat **`/me`** page — Class & Settings open as modals, not sub-routes; legacy `/me/class`, `/me/settings`, `/me/plan`, and `/profile` all redirect to `/me`. Favorites = localStorage (`useSavedPlaces()`), not an EF. Referral page = `/share` (`/invite` redirects). AI persona = **Don Memo** (`/discover/ai`, Spanish-first — only the AI's own messages are Spanish).
- Clients never call the DB — everything via `consumer-web-*` Edge Functions. CI: `lint · typecheck · build` (Node 22+).