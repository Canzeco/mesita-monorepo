// supabase-edgefunc-sync-reservationist · mode "version" (MESITA-3968).
//
// Read-only and cheap: the spec hash of the code THIS deploy runs. GitHub's
// agents-deploy.yml polls it until it equals main's, so the sync that follows
// pushes the agents that were just merged. `tests_filter` says run_tests
// honours { tests }: an older deploy ignores it and would run every call, so
// sync-agents.sh runs nothing until it reads true (MESITA-4134).

import type { BaseCtx } from "./context.ts";
import { json } from "../../_shared/http.ts";
import { specHash } from "../../_shared/reservationist/index.ts";

export async function version(ctx: BaseCtx): Promise<Response> {
  return json({ ok: true, mode: ctx.mode, spec_hash: await specHash(), tests_filter: true });
}
