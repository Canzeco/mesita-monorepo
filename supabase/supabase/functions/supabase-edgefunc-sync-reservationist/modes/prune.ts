// supabase-edgefunc-sync-reservationist · mode "prune".
//
// Delete the agents that LEFT the fleet (MESITA-3986): a key that
// app_config.agents_config.agents still names but FLEET no longer has (a4,
// merged into a3 by MESITA-3974). Its agent is deleted in ElevenLabs and its
// key dropped from agents_config. Every other agent in the workspace is left
// alone, and fleet tools are never deleted here. Run by hand.

import type { WorkspaceCtx } from "./context.ts";
import { elFetch } from "../el-client.ts";
import { json } from "../../_shared/http.ts";
import { FLEET } from "../../_shared/reservationist/index.ts";

/** Keys agents_config still names that the fleet no longer has. */
export function retiredKeys(configured: Record<string, unknown>, fleetKeys: string[]): string[] {
  return Object.keys(configured).filter((k) => !fleetKeys.includes(k));
}

export async function prune(ctx: WorkspaceCtx): Promise<Response> {
  const { key, mode, configuredAgents, agentsConfig, saveAgentsConfig } = ctx;
  const retired = retiredKeys(configuredAgents, FLEET.map((a) => a.key));
  const deleted: Array<{ key: string; id: string | null; action: string }> = [];
  for (const k of retired) {
    const id = configuredAgents[k]?.id?.trim() ?? "";
    if (id) {
      const del = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
      // Already gone (404) counts as done; anything else stops the run.
      if (!del.ok && !/HTTP 404/.test(del.error)) {
        return json({ ok: false, error: `delete agent ${k} (${id}): ${del.error}`, deleted }, 502);
      }
      deleted.push({ key: k, id, action: del.ok ? "deleted" : "already gone" });
    } else {
      deleted.push({ key: k, id: null, action: "no id; key dropped" });
    }
  }
  if (retired.length > 0) {
    const agents = { ...configuredAgents };
    for (const k of retired) delete agents[k];
    const { error } = await saveAgentsConfig({ ...agentsConfig, agents });
    if (error) return json({ ok: false, error: `config_save: ${error.message}`, deleted }, 500);
  }
  const afterList = await elFetch(key, "/v1/convai/agents?page_size=100");
  const remaining = afterList.ok
    ? ((afterList.body as { agents?: Array<{ agent_id?: string; name?: string }> } | null)?.agents ?? [])
      .map((a) => ({ id: a.agent_id, name: a.name }))
    : null;
  return json({ ok: true, mode, deleted, remaining });
}
