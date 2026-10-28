// supabase-edgefunc-sync-reservationist · mode "fleet".
//
// Upsert the fleet tools and the four agents; store their ids in agents_config.

import type { DonorCtx } from "./context.ts";
import {
  elFetch,
  resolveMainBranchId,
  upsertTool,
  type VersionedAgentShape,
  type AgentShape,
} from "../el-client.ts";
import { json } from "../../_shared/http.ts";
import {
  FLEET_AGENTS,
  FLEET_BUILT_IN_TOOLS,
  fleetToolConfigs,
} from "../../_shared/reservationist-fleet.ts";

export async function fleet(ctx: DonorCtx): Promise<Response> {
  const writePrompts = ctx.body.write_prompts === true;
  const {
    key,
    mode,
    env,
    agentsConfig,
    configuredAgents,
    toolIdByName,
    toolSecret,
    donorId,
    donor,
    donorCc,
    donorPrompt,
    saveAgentsConfig,
  } = ctx;
  // 1 · Upsert the 7 family tools.
  const toolReport: Array<{ name: string; id: string; action: string }> = [];
  for (const def of fleetToolConfigs(env.url, env.anonKey, toolSecret)) {
    const up = await upsertTool(key, toolIdByName, def.name, def.config);
    if (!up.ok) return json({ ok: false, error: `tool ${def.name}: ${up.error}` }, 502);
    toolIdByName.set(def.name, up.id);
    toolReport.push({ name: def.name, id: up.id, action: up.action });
  }

  // 2 · List workspace agents so a rerun adopts fleet agents by exact name
  // even if a previous config write failed.
  const listRes = await elFetch(key, "/v1/convai/agents?page_size=100");
  if (!listRes.ok) return json({ ok: false, error: listRes.error }, 502);
  const agentIdByName = new Map<string, string>();
  const listed = (listRes.body as {
    agents?: Array<{ agent_id?: string; name?: string }>;
  } | null)?.agents ?? [];
  for (const a of listed) {
    if (a.agent_id && a.name) agentIdByName.set(a.name, a.agent_id);
  }

  // Donor scaffold: voice/model/ASR/turn/conversation + LLM settings — the
  // fleet speaks with the proven production setup; language stays es.
  const promptScaffold: Record<string, unknown> = {};
  if (typeof donorPrompt.llm === "string") promptScaffold.llm = donorPrompt.llm;
  if (typeof donorPrompt.temperature === "number") {
    promptScaffold.temperature = donorPrompt.temperature;
  }
  if (donorPrompt.built_in_tools && typeof donorPrompt.built_in_tools === "object") {
    promptScaffold.built_in_tools = donorPrompt.built_in_tools;
  }
  const language = typeof donorCc.agent?.language === "string" && donorCc.agent.language
    ? donorCc.agent.language
    : "es";
  const donorSections: Record<string, unknown> = {};
  for (const section of ["tts", "asr", "turn", "conversation"] as const) {
    const v = donorCc[section];
    if (v && typeof v === "object") donorSections[section] = v;
  }

  // 3 · Create each missing agent / re-attach tools on existing ones.
  const agentsOut: Record<string, { id: string; name: string }> = {};
  const agentReport: Array<Record<string, unknown>> = [];
  for (const spec of FLEET_AGENTS) {
    const toolIds = spec.toolNames
      .map((n) => toolIdByName.get(n))
      .filter((v): v is string => !!v);
    let id = configuredAgents[spec.key]?.id?.trim() || agentIdByName.get(spec.name) || null;
    let action: string;

    if (id) {
      // Existing agent: PATCH name + tool_ids — the prompt is console
      // territory after creation UNLESS write_prompts opts into pushing the
      // repo spec (a deliberate prompt upgrade). Versioned agents: target
      // Main via ?branch_id — a bare PATCH can land on a draft while the
      // Main tip keeps serving the old config (same lesson as workflows).
      const before = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`);
      if (!before.ok) {
        id = null; // deleted in console — fall through to create
      } else {
        const tip = before.body as AgentShape & VersionedAgentShape;
        const branch = await resolveMainBranchId(key, id, tip);
        const agentPath = branch.ok
          ? `/v1/convai/agents/${encodeURIComponent(id)}?branch_id=${
            encodeURIComponent(branch.branchId)
          }`
          : `/v1/convai/agents/${encodeURIComponent(id)}`;
        const prevPrompt = tip.conversation_config?.agent?.prompt ?? {};
        const prevChars = typeof prevPrompt.prompt === "string" ? prevPrompt.prompt.length : 0;
        // built_in_tools rides EVERY fleet run, not just write_prompts: the
        // agents came back from the API with every system tool null (=off),
        // so end_call was unavailable and they could never hang up.
        const agentPatch: Record<string, unknown> = writePrompts
          ? {
            first_message: spec.firstMessage,
            prompt: {
              prompt: spec.prompt,
              tool_ids: toolIds,
              built_in_tools: FLEET_BUILT_IN_TOOLS,
            },
          }
          : { prompt: { tool_ids: toolIds, built_in_tools: FLEET_BUILT_IN_TOOLS } };
        const patchBody: Record<string, unknown> = {
          name: spec.name,
          conversation_config: { agent: agentPatch },
        };
        if (branch.ok) {
          patchBody.version_description = `Mesita fleet agent sync ${spec.key} (ASDM)`;
        }
        const patch = await elFetch(key, agentPath, { method: "PATCH", body: patchBody });
        if (!patch.ok) return json({ ok: false, error: `agent ${spec.key}: ${patch.error}` }, 502);
        const after = await elFetch(key, agentPath);
        const afterPrompt = after.ok
          ? (after.body as AgentShape).conversation_config?.agent?.prompt ?? {}
          : {};
        const afterChars = typeof afterPrompt.prompt === "string" ? afterPrompt.prompt.length : 0;
        action = writePrompts ? "updated+prompt" : "updated";
        agentsOut[spec.key] = { id, name: spec.name };
        agentReport.push({
          key: spec.key,
          id,
          name: spec.name,
          action,
          branch_id: branch.ok ? branch.branchId : null,
          tool_ids: toolIds,
          prompt_chars_before: prevChars,
          prompt_chars_after: afterChars,
          prompt_untouched: prevChars === afterChars,
        });
        continue;
      }
    }

    // Create — full donor clone first, minimal payload as fallback.
    const agentSection = {
      first_message: spec.firstMessage,
      language,
      prompt: { ...promptScaffold, prompt: spec.prompt, tool_ids: toolIds },
    };
    let created = await elFetch(key, "/v1/convai/agents/create", {
      method: "POST",
      body: {
        name: spec.name,
        conversation_config: { ...donorSections, agent: agentSection },
      },
    });
    let cloned = "donor";
    if (!created.ok) {
      created = await elFetch(key, "/v1/convai/agents/create", {
        method: "POST",
        body: { name: spec.name, conversation_config: { agent: agentSection } },
      });
      cloned = "minimal";
    }
    if (!created.ok) {
      return json({ ok: false, error: `agent ${spec.key}: ${created.error}` }, 502);
    }
    const newId = ((created.body as { agent_id?: string } | null)?.agent_id) ?? null;
    if (!newId) {
      return json({
        ok: false,
        error: `agent ${spec.key} created but no agent_id in response`,
      }, 502);
    }
    agentsOut[spec.key] = { id: newId, name: spec.name };
    agentReport.push({
      key: spec.key,
      id: newId,
      name: spec.name,
      action: "created",
      clone: cloned,
      tool_ids: toolIds,
    });
  }

  // 4 · Persist the fleet ids — the call engine reads agents.a1/.a2 from here.
  const newConfig = {
    ...agentsConfig,
    agents: agentsOut,
    fleetSyncedAt: new Date().toISOString(),
  };
  const { error: saveErr } = await saveAgentsConfig(newConfig);

  const result = {
    mode,
    donor: { id: donorId, name: donor.name ?? null, language, sections: Object.keys(donorSections) },
    tools: toolReport,
    agents: agentReport,
    config_saved: !saveErr,
    config_error: saveErr?.message ?? null,
  };
  // The agents exist but the call engine cannot find them: a failure, not ok.
  if (saveErr) {
    return json({ ok: false, error: `config_save: ${saveErr.message}`, ...result }, 500);
  }
  return json({ ok: true, ...result });
}
