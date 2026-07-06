<!-- RULES-QUICKSTART:START (generated — do not hand-edit; run: deno run -A mesita-supabase/scripts/sync-rules.ts) -->
# Mesita — agent quickstart (you're ~90% correct after this)

Stable mirror of the top of the Notion **Rules** page (the master — Notion wins on any conflict). Full page + appendix: https://www.notion.so/Rules-395a9bf37a528081b2c1dacc445bb6c8

- **Alone + small fix?** → branch off fresh main, work, PR, merge it yourself, create the one-line issue at merge time (Ops & maintenance). That's the whole loop.
- **Other agents live on the repo?** → full SWARM: pick → claim → worktree → merge.
- **ALWAYS:** reply in English · clients call Edge Functions, never the DB · never push to `main` · mirror every Supabase cloud change into `mesita-supabase` same session · set terminal status same session · no local dev servers (verify via Vercel).
- **NEVER ask.** Reversible → decide, log a `decision:` comment, ship. Only two `needs-human` cases: a secret you can't enter, or one irreversible money/publish trigger.
- **When in doubt**, hierarchy wins: Pato's live instruction > the Linear issue > Notion > memory.

Where things live: **Linear** (team Mesita, `MESITA-`) = work state · **Notion** = knowledge · **GitHub Canzeco** = code.
<!-- RULES-QUICKSTART:END -->

## This repo — mesita-web-landing (marketing landing)

- Light theme. **The word "venue" is prohibited** → use "place" / "business"; keep the repo grep-clean (`grep -rin venue src` = 0).
- Static marketing site — needs no Supabase env vars. CI: `lint · typecheck · build` (Node 22+).