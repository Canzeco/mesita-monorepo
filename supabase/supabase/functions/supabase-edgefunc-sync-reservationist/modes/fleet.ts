// supabase-edgefunc-sync-reservationist · mode "fleet".
//
// Make the four live agents match _shared/reservationist/ on EVERY run:
// upsert the nine tools, then push each agent's name, first message, prompt,
// tools, settings (voice, LLM, ASR, turn, conversation) and guardrails
// (platform_settings.guardrails, MESITA-4136) onto its Main
// branch, read it back, and store the repo hash in
// agents_config.agents.<key>.hash. A console edit is overwritten by the next
// run and shows up as drift in mode "inspect" until then.

import { failedVerification, type WorkspaceCtx } from "./context.ts";
import {
  type AgentShape,
  elFetch,
  ensureVoice,
  resolveMainBranchId,
  upsertTool,
  type VersionedAgentShape,
} from "../el-client.ts";
import { json } from "../../_shared/http.ts";
import {
  agentConversationConfig,
  agentHash,
  FLEET,
  GUARDRAILS,
  guardrailsDrift,
  toolConfigs,
} from "../../_shared/reservationist/index.ts";
import { TTS, TTS_VOICE_NAME } from "../../_shared/reservationist/settings.ts";

export async function fleet(ctx: WorkspaceCtx): Promise<Response> {
  const { key, mode, env, agentsConfig, configuredAgents, toolIdByName, toolSecret, listedAgents, saveAgentsConfig } =
    ctx;

  // 1 · The nine webhook tools.
  const toolReport: Array<{ name: string; id: string; action: string }> = [];
  for (const def of toolConfigs(env.url, env.anonKey, toolSecret)) {
    const up = await upsertTool(key, toolIdByName, def.name, def.config);
    if (!up.ok) return json({ ok: false, error: `tool ${def.name}: ${up.error}` }, 502);
    toolIdByName.set(def.name, up.id);
    toolReport.push({ name: def.name, id: up.id, action: up.action });
  }

  // A rerun adopts agents by exact name even if a previous config write failed.
  const agentIdByName = new Map<string, string>();
  for (const a of listedAgents) if (a.agent_id && a.name) agentIdByName.set(a.name, a.agent_id);

  // 1b · Mesita's voice is in the workspace before any agent names it (MESITA-4624).
  const voice = await ensureVoice(key, TTS.voice_id, TTS_VOICE_NAME);
  if (!voice.ok) return json({ ok: false, error: voice.error }, 502);

  // 2 · Each agent, whole.
  const agentsOut: Record<string, { id: string; name: string; hash: string }> = {};
  const agentReport: Array<Record<string, unknown>> = [];
  for (const spec of FLEET) {
    const toolIds = spec.toolNames.map((n) => toolIdByName.get(n)).filter((v): v is string => !!v);
    const conversationConfig = agentConversationConfig(spec, toolIds);
    const hash = await agentHash(spec.prompt, spec.firstMessage);
    let id = configuredAgents[spec.key]?.id?.trim() || agentIdByName.get(spec.name) || null;

    if (id) {
      const before = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`);
      if (!before.ok) id = null; // deleted in the console — create below
      else {
        // Versioned agents: target Main via ?branch_id — a bare PATCH can land
        // on a draft while Main keeps serving the old config.
        const tip = before.body as AgentShape & VersionedAgentShape;
        const branch = await resolveMainBranchId(key, id, tip);
        const path = `/v1/convai/agents/${encodeURIComponent(id)}` +
          (branch.ok ? `?branch_id=${encodeURIComponent(branch.branchId)}` : "");
        // Guardrails merge into the agent's platform_settings so a PATCH that
        // replaced the object whole would still keep everything else there.
        const livePlatform = ((before.body as { platform_settings?: Record<string, unknown> } | null)
          ?.platform_settings) ?? {};
        const patchBody: Record<string, unknown> = {
          name: spec.name,
          conversation_config: conversationConfig,
          platform_settings: { ...livePlatform, guardrails: GUARDRAILS },
        };
        if (branch.ok) patchBody.version_description = `Mesita fleet sync ${spec.key} ${hash.slice(0, 12)}`;
        const patch = await elFetch(key, path, { method: "PATCH", body: patchBody });
        if (!patch.ok) return json({ ok: false, error: `agent ${spec.key}: ${patch.error}` }, 502);
        const after = await elFetch(key, path);
        const liveAgent = after.ok ? (after.body as AgentShape).conversation_config?.agent : undefined;
        const liveHash = await agentHash(
          typeof liveAgent?.prompt?.prompt === "string" ? liveAgent.prompt.prompt : "",
          typeof liveAgent?.first_message === "string" ? liveAgent.first_message : "",
        );
        const liveTools = [...(liveAgent?.prompt?.tool_ids ?? [])].sort();
        const guardrailIssues = guardrailsDrift(
          after.ok ? (after.body as { platform_settings?: { guardrails?: unknown } }).platform_settings?.guardrails : null,
        );
        agentsOut[spec.key] = { id, name: spec.name, hash };
        agentReport.push({
          key: spec.key,
          id,
          action: "updated",
          branch_id: branch.ok ? branch.branchId : null,
          hash,
          live_hash: liveHash,
          tool_ids: toolIds,
          guardrail_drift: guardrailIssues,
          ok: liveHash === hash && JSON.stringify(liveTools) === JSON.stringify([...toolIds].sort()) &&
            guardrailIssues.length === 0,
        });
        continue;
      }
    }

    const created = await elFetch(key, "/v1/convai/agents/create", {
      method: "POST",
      body: { name: spec.name, conversation_config: conversationConfig, platform_settings: { guardrails: GUARDRAILS } },
    });
    if (!created.ok) return json({ ok: false, error: `agent ${spec.key}: ${created.error}` }, 502);
    const newId = (created.body as { agent_id?: string } | null)?.agent_id ?? null;
    if (!newId) return json({ ok: false, error: `agent ${spec.key} created but no agent_id` }, 502);
    agentsOut[spec.key] = { id: newId, name: spec.name, hash };
    agentReport.push({ key: spec.key, id: newId, action: "created", hash, tool_ids: toolIds, ok: true });
  }

  // 3 · The call engine reads agents.a1/.a2 ids from here.
  const { error: saveErr } = await saveAgentsConfig({
    ...agentsConfig,
    agents: agentsOut,
    fleetSyncedAt: new Date().toISOString(),
  });
  const result = { mode, tools: toolReport, agents: agentReport, config_saved: !saveErr };
  if (saveErr) return json({ ok: false, error: `config_save: ${saveErr.message}`, ...result }, 500);
  const failed = failedVerification(agentReport);
  if (failed) return json({ ok: false, error: failed, ...result }, 502);
  return json({ ok: true, ...result });
}
