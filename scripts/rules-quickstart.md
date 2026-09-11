# Mesita — agent quickstart (you're ~90% correct after this)

**Notion is the library; it wins on any conflict.** This block mirrors [**Rules**](https://www.notion.so/Rules-3d8a9bf37a5281d79b1fde154ad09ba1) §0. **Rules = the law** (how change is allowed). **📚 [Docs](https://www.notion.so/Docs-3bfa9bf37a52801e891ec3407d717273) = the knowledge**, one flat page per domain. **Code = this repo.** Linear is the ledger, not a source of truth. **Rules beat Docs.** Changing Rules → RDLC. Code → SDLC. Docs → KDLC. Mixed completes every Integrate. Fetch this Rules URL only. Rules Don’t Read is archive.

**The repo.** `Canzeco/mesita-monorepo` is the whole product: `apps/{web-admin,web-business,web-consumer,web-landing,web-validate,mobile-consumer,mobile-business}` + `supabase/` + `assets/`. The six former standalone repos are frozen. Package-specific rules: that package's `CLAUDE.md`.

**The blackboard.** Agents never talk to each other. **Linear** (team Mesita, `MESITA-`) carries intent — issues + comments ONLY; Linear documents and Claude Artifacts are prohibited. **git/GitHub** carries the work — branches and squash PRs; `Closes MESITA-<id>` is the join.

**The lock.** Every repo, Notion, or cloud (schema/EF) write has an issue (I-1). Claim = In Progress + one claim line (I-6). Workspace = a checkout a live claim names: one per code issue, none for Rules/Docs-only.

**The loop.** `deno task boot` → pick unblocked, footprint-disjoint → `deno task worktree add MESITA-<id> <slug>` (`--adopt .` for the checkout you launched in) → enter the path → In Progress + the printed claim line → Docs first, small commits, push early → `deno task worktree pr` then `gh pr ready` then `gh pr merge --squash` with `Closes MESITA-<id>` → `deno task worktree remove` from a lobby → rewrite Docs. Never push to `main`. Never write in the shared checkout (I-4).

**The invariants**
- I-1 Every repo, Notion, or cloud (schema/EF) write has an issue, in a project. Pure Q&A needs none.
- I-2 `main` only by squash PR; every PR passes every check the ruleset requires on that PR.
- I-3 One code issue = one workspace (claimed checkout) = one PR.
- I-4 The shared checkout holds no work of its own; `repair-lobby` fixes it, `scripts/preflight.sh` refuses the write.
- I-5 Backend is a singleton: cloud == repo, same session.
- I-6 Claims are the only lock; stale after 24h idle, then `takeover:`.
- I-7 Reversible → `decision:`, ship; `needs-human` = secret, irreversible money, or constitution waiting on Pato.
- I-8 Read the domain's Docs page before writing code; rewrite it after what shipped.
- I-9 Finish clean at landing; verify by observed state.
- I-10 Landed = a merged PR for the tip; only landed, clean, inactive workspaces are swept.

**ALWAYS:** reply in English · clients call Edge Functions, never the DB · no local web dev servers (web: Vercel after merge; mobile: `npx expo export --platform web`) · admin-console configs bind · generated files are never hand-edited · the repo holds no knowledge markdown.

**Generated output is never hand-edited.** `AGENTS.md` ← sibling `CLAUDE.md` (`deno task sync-rules`) · brand outputs ← `assets/brand/brand.json`. Edit `scripts/rules-quickstart.md` or a `CLAUDE.md`, then `deno task sync-rules`.

**NEVER ask.** Reversible → decide, log `decision:`, ship (I-7).

**Hierarchy:** Pato's live instruction > the Linear issue > Rules > Docs > memory.
