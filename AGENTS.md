<!-- GENERATED — scripts/sync-rules.ts mirrors this file from its sibling CLAUDE.md. Edit CLAUDE.md (root: below its END marker) or scripts/rules-quickstart.md — NEVER this file. -->
<!-- RULES-QUICKSTART:START (generated — do not hand-edit; run: deno task sync-rules) -->
# Mesita — agent quickstart (you're ~90% correct after this)

**Notion is the library; it wins on any conflict.** **📜 [Rules](https://www.notion.so/Rules-3d9a9bf37a5280aaab2ed8af665485f7) = the law** (how change is allowed). **📚 [Docs](https://www.notion.so/Docs-3bfa9bf37a52801e891ec3407d717273) = the knowledge**, one flat page per domain. **Code = this repo.** **Linear = the ledger**, not a source of truth. Boot cards (the root `CLAUDE.md`, every `AGENTS.md`, package `CLAUDE.md`, skills) carry §0 and package law, never knowledge.

**Routing.** Code → [SADLC](https://www.notion.so/3d9a9bf37a52800986a7f7f1363e2700), Docs → [KADLC](https://www.notion.so/3d9a9bf37a5280f18aa3f73ed6ab8edf) (Software / Knowledge Agentic Development Life Cycle). Mixed completes every Integrate. Changing the Rules tree is not a third lifecycle: an issue; Pato for constitution, §2 constraints and I-1…I-10; `decision:` for adapter rows; then SADLC the same session if §0 or a gate changed. Fetch Rules, SADLC, KADLC and [Markdowns](https://www.notion.so/3d9a9bf37a52803ebe4cf73bf300f1a3) only; the Map is Rules §4. The retired law pages are in the Trash; never fetch them.

**The repo.** `Canzeco/mesita-monorepo` is the whole product: `apps/{web-admin,web-consumer,web-landing}` + `packages/place-profile` + `supabase/` + `render/` + `assets/`. Package law: that package's `CLAUDE.md`.

**The blackboard.** Agents never talk to each other. **Linear** (team Mesita, `MESITA-`) carries intent — issues + comments ONLY; Linear documents and Claude Artifacts are prohibited. **git/GitHub** carries the work — branches and squash PRs; `Closes MESITA-<id>` is the join.

**The lock.** Claim = In Progress + one claim line (I-6). Workspace = a checkout a live claim names: one per code issue, none for Rules/Docs-only. Issue header: Domain (Rules · Code · Docs · Mixed, also the label) · Footprint (paths, schema/EF, or `notion:<32hex>`) · Done (the named Integrates).

**The loop.** `deno task boot` → pick unblocked, footprint-disjoint → `deno task worktree add MESITA-<id> <slug>` (`--adopt .` for the checkout you launched in) → enter the path → In Progress + the printed claim line → Docs first, small commits, push early → `deno task worktree pr` then `gh pr ready` then `gh pr merge --squash` with `Closes MESITA-<id>` once the required checks pass → `deno task worktree remove` from a lobby (`leave` for a launch checkout) → rewrite Docs. Never push to `main`. Never write in the shared checkout (I-4).

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

**ALWAYS:** reply in English · clients call Edge Functions, never the DB · the EF name is the ACL · no local web dev servers (Vercel after merge) · admin-console configs bind · generated files are never hand-edited (`AGENTS.md` ← its `CLAUDE.md` via `deno task sync-rules`; brand outputs ← `assets/brand/brand.json` via `deno task sync-brand`) · the repo holds no knowledge markdown.

**NEVER ask.** Reversible → decide, log `decision:`, ship (I-7).

**Redeye.** A prompt from Pato that begins with `activate Redeye` arms mode 6 for 24 hours; a cloud session arms it at start. Then obey `scripts/redeye.md` until he says stop: no question of any kind, every change committed and merged at once, then the next issue.

**Hierarchy:** Pato's live instruction > the Linear issue > Rules > Docs > memory. Pato is the only human.

**Mirror.** Rules §0 and `scripts/rules-quickstart.md` below its title are one text, at most 700 words, copied by hand; `deno task sync-rules` then writes it into the root `CLAUDE.md`. Both carry `stamp: v6 2026-10-18`; unequal stamps are drift.
<!-- RULES-QUICKSTART:END -->
## This repo — mesita-monorepo (root)

- **Packages**, each its own install root (`cd` into it): the three apps (Next.js, one Vercel project each) and `packages/place-profile`, the place screen both render, use pnpm; `supabase/`, the source of truth, uses Deno and the Supabase CLI, run from there; `render/`, the Enricher's workflow, uses npm.
- **Preview** on the PR's Vercel deployment: the Vercel bot's PR comment links it (`gh pr view <n> --comments`); deployment protection needs a share link from the Vercel tool.
- **CI:** every PR job is a required check, named in `.github/required-checks.json`: `PR closes its issue` · `instruction files in sync` · `brand assets in sync` · `deno lint · test` · `deno check` · `pgTAP · schema invariants` · `<app> · lint · typecheck · test · build` per web app · `place-profile · typecheck · test` · `render · test`. A check with nothing in scope reports SKIPPED, which merges. Weekly, `pipeline-audit.yml` sweeps what no PR can see.
- **Workspaces:** `worktree add` files one in `../worktrees/<platform>/`; enter the printed path. `scripts/preflight.sh` refuses writes outside a claimed one (Claude Code's `PreToolUse` hook, the git `pre-commit` hook, Cursor's shell hook). `.worktreeinclude` seeds env files and `supabase/supabase/.temp/`.
