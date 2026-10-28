// supabase-edgefunc-sync-reservationist · mode "prune".
//
// Delete every workspace agent that is not a1–a4. Fleet tools are never
// deleted here.

import type { WorkspaceCtx } from "./context.ts";
import { elFetch } from "../el-client.ts";
import { json } from "../../_shared/http.ts";

export async function prune(ctx: WorkspaceCtx): Promise<Response> {
  const { key, mode, configuredAgents, listedAgents } = ctx;
  const keep = new Set<string>();
  for (const k of ["a1", "a2", "a3", "a4"] as const) {
    const id = configuredAgents[k]?.id?.trim();
    if (id) keep.add(id);
  }
  if (keep.size < 4) {
    return json({
      ok: false,
      error: "agents_config.agents must hold a1–a4 before prune",
      keep: [...keep],
      configured_fleet: configuredAgents,
    }, 400);
  }
  const deleted: Array<{ id: string; name: string | null }> = [];
  for (const a of listedAgents) {
    const id = a.agent_id?.trim();
    if (!id || keep.has(id)) continue;
    const del = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!del.ok) {
      return json({
        ok: false,
        error: `delete agent ${id} (${a.name ?? "?"}): ${del.error}`,
        deleted,
      }, 502);
    }
    deleted.push({ id, name: a.name ?? null });
  }
  const afterList = await elFetch(key, "/v1/convai/agents?page_size=100");
  const remaining = afterList.ok
    ? ((afterList.body as {
      agents?: Array<{ agent_id?: string; name?: string }>;
    } | null)?.agents ?? []).map((a) => ({ id: a.agent_id, name: a.name }))
    : null;
  return json({
    ok: true,
    mode,
    deleted,
    remaining,
    configured_fleet: configuredAgents,
  });
}
