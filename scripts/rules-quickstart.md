# Mesita — agent quickstart (you're ~90% correct after this)

Stable mirror of Notion **Rules** §0 — the master; Notion wins on any conflict: https://www.notion.so/Rules-395a9bf37a528081b2c1dacc445bb6c8

**ASDM** is the one protocol for all agent work — full text: 🤖 **ASDM Rules**; your platform's ramp (isolation, branch naming, connectors): **ASDM Rules §K**. 🏛️ **Product Rules** = WHAT Mesita is. ⚙️ **Development Rules** = engineering law: tooling gotchas + the knowledge chain. Domain knowledge — one page per subsystem — lives in 📚 **Docs**: mirror shipped changes there same session, and **Rules beat Docs on any conflict**.

| You're reading | You are |
| --- | --- |
| `CLAUDE.md` | Claude Code (local · cloud · subagent) or Claude Cowork |
| `AGENTS.md` | Cursor, Codex, or any open-standard agent — generated from `CLAUDE.md`; hand edits go there |

**The repo.** `Canzeco/mesita-monorepo` is the whole product: `apps/{web-admin,web-business,web-consumer,web-landing,web-check,mobile-consumer,mobile-business}` + `supabase/` + `assets/`. The six former standalone repos are frozen read-only history — never work in them. Package-specific rules: that package's `CLAUDE.md`.

**The blackboard.** Agents never talk to each other. **Linear** (team Mesita, `MESITA-`) carries intent — issues, claims, `decision:` comments, statuses; issues + comments ONLY, Linear documents are prohibited. **git/GitHub** carries the work — branches and squash PRs; `Closes <ID>` is the join. Chat is ephemeral: durable state → Linear, durable knowledge → Notion, same session.

**The loop.**

- Solo (no other live claim on the repo): branch off fresh main → work → squash-PR → merge it yourself → one-line issue at merge time (Ops & maintenance).
- Multi-agent (anyone else live, or in doubt): PICK an unblocked issue whose footprint doesn't overlap an active claim → CLAIM (`claimed: <platform>:<session-slug> · branch:<actual-branch>`) → work isolated → squash-merge yourself.
- **One issue = one branch = one worktree = one squash PR**, however many packages it spans. Parallelism = child issues + subagents (≤5), each in its own worktree. Branch `agent/<ISSUE-ID>-<slug>`: `git worktree add ../mesita-monorepo-<ISSUE-ID> -b agent/<ISSUE-ID>-<slug> origin/main`, then copy the gitignored state in `.worktreeinclude` (Claude Code and Cursor do this automatically). Platform-forced names: declare the real branch in your claim.
- Capability follows connectors, not location. Local Mac = full peer. Cloud VM = full peer when claude.ai connectors ride the session — probe at BOOT (one Linear read). A missing connector demotes only that surface: hand off the residue (pushed branch + PR; the dispatching session finishes it, noted in the claim). Secrets never travel.
- Cowork never opens a live repo checkout — `cowork` issues in non-repo folders only.

**The backend is a singleton.** One Supabase project, ONE live schema and EF set — Supabase branching deliberately unused; schema/EF surface is claimed footprint. Merging to main auto-deploys every EF, so a cloud-only edit dies at the next merge: mirror every cloud change into `supabase/` the same session; migrations apply via MCP/CLI, then reconcile the ledger (Development Rules §B).

**ALWAYS:** reply in English · clients call Edge Functions, never the DB · never push to `main` (enforced: a ruleset requires squash PRs and blocks force-push) · terminal statuses same session · no local web dev servers — web verifies on Vercel, mobile via `npx expo export --platform web` + the Metro web preview (:8081 consumer · :8082 business) · admin-console configs bind every EF, app and agent (Admin · Models · Sourcing · Enrichment · Verification · Discover · Reservations · Visits · Orders · Promos · Ojo — unenforced config = bug; staged knobs are labeled staged).

**Generated output is never hand-edited.** `AGENTS.md` ← its sibling `CLAUDE.md` (`deno task sync-rules`) · brand assets, `BRAND-TOKENS` blocks, `src/components/brand/*`, favicons ← `assets/brand/brand.json` (`deno task sync-brand`; guide: 🎨 Docs › Design). Both CI-gated. **The repo holds no other markdown:** knowledge → Notion Rules · task context → Linear · code notes → code comments; the allowlist (`CLAUDE.md`/`AGENTS.md` pairs, `scripts/rules-quickstart.md`, `.claude/` `.cursor/` `.codex/` `.github/`) is CI-enforced. **Docs are rewritten, not amended** — present law only, no history trails; word budgets CI-enforced (Development Rules §C).

**NEVER ask.** Reversible → decide, log a `decision:` comment, ship. `needs-human` = only a secret you can't enter, or one irreversible money/publish trigger.

**Hierarchy:** Pato's live instruction > the Linear issue > Rules > Docs > memory.
