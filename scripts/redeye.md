**Redeye — mode 6.** The picker stops at *Bypass permissions*, which only takes the prompts away: it does not stop you asking in prose, and it does not stop you stopping. Redeye is that mode plus both of those. Any agent, local or cloud. On when Pato's prompt begins with `activate Redeye`, off when he says stop — finishing something does not turn it off. Arming lasts 24 hours.

Boot: `deno task redeye` (prompts off, write gate on, this card) · `deno task boot` (where you are, the fleet, every live claim) · Rules §0, then the domain's Docs page before you write it (I-8).

## Asking is prohibited

Nobody is awake. A question is not caution here, it is the rest of the night. Every question you would ask, you answer yourself:

- **Reversible** — naming, layout, copy, file placement, two green designs: decide, comment `decision: <what> — <why>`, ship. Pato reverts what he dislikes in a minute; he cannot get the night back.
- **Ambiguous scope** — take the narrower reading, ship it, file the wider one as its own issue.
- **Genuinely blocked, and only these three (I-7)** — a secret you do not hold, money that moves for real, a Rules change. Label `needs-human`, comment what you need in one line, leave the issue, **take the next one**.
- Never write "should I", "would you like", "confirm", "let me know". Never end a turn on a question mark. A turn that ends without a next action is a stall.

## Never stop

The unit of work is the QUEUE, not the issue. A merge does not finish you.

1. `deno task boot`. The top unblocked, footprint-disjoint issue. Resume a live claim with `deno task worktree add MESITA-<id>` and no `--adopt`.
2. A new issue: `deno task worktree add MESITA-<id> <slug>`. `--adopt .` only for a cloud lobby already off `main`. In Progress, paste the claim line. That branch carries `MESITA-<id>`. One checkout, one claim.
3. Docs first. Small commits. Push early, once CI should judge the commit. `bash scripts/preflight.sh pre-commit` when `core.hooksPath` skips `.git/hooks`.
4. `deno task worktree pr` adopts the open PR and writes `Closes MESITA-<id>` and a `Docs:` line. `gh pr ready` if it is a draft. `gh pr merge --squash` when every required check is green or SKIPPED. A Vercel Ready comment is not that ruleset.
5. Rewrite the Docs page. Close the issue. `deno task worktree remove` from a lobby. `deno task worktree leave` for a launch checkout.
6. Back to 1, same breath. Announcing the loop is not running it.

## What the bypass does not buy

The prompts are gone; the law is not. `preflight.sh` still refuses every write outside a claimed workspace, and the pre-commit hook still refuses the commit — the prompt was never the lock, the claim is (I-3, I-6). Never `--no-verify`. Never push to `main`. Never write in the shared checkout (I-4). Every repo, Notion or cloud write still has an issue (I-1).
