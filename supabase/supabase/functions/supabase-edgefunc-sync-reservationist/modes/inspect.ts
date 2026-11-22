// supabase-edgefunc-sync-reservationist · mode "inspect".
//
// Read-only: each fleet agent read back from ElevenLabs and compared with
// _shared/reservationist/ — prompt hash (repo, stored, live), attached tools,
// knowledge doc, system tools and workflow shape. `in_sync` is true only when
// all of them match.

import type { WorkspaceCtx } from "./context.ts";
import { type AgentShape, elFetch, readWorkflow, summarizeWorkflow, type VersionedAgentShape } from "../el-client.ts";
import { json } from "../../_shared/http.ts";
import { agentHash, FLEET, kbDocName } from "../../_shared/reservationist/index.ts";
import { TTS } from "../../_shared/reservationist/settings.ts";

export async function inspect(ctx: WorkspaceCtx): Promise<Response> {
  const { key, mode, configuredAgents, listedAgents, toolRows, toolIdByName } = ctx;
  const toolNameById = new Map([...toolIdByName].map(([n, id]) => [id, n]));
  const agents: Array<Record<string, unknown>> = [];
  for (const spec of FLEET) {
    const id = configuredAgents[spec.key]?.id?.trim();
    if (!id) {
      agents.push({ key: spec.key, error: "missing agents_config id", in_sync: false });
      continue;
    }
    const got = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`);
    if (!got.ok) {
      agents.push({ key: spec.key, id, error: got.error, in_sync: false });
      continue;
    }
    const body = got.body as AgentShape & VersionedAgentShape;
    const agent = body.conversation_config?.agent;
    const prompt = agent?.prompt ?? {};
    const repoHash = await agentHash(spec.prompt, spec.firstMessage);
    const liveHash = await agentHash(
      typeof prompt.prompt === "string" ? prompt.prompt : "",
      typeof agent?.first_message === "string" ? agent.first_message : "",
    );
    const liveTools = (prompt.tool_ids ?? []).map((t) => toolNameById.get(t) ?? t).sort();
    const wantTools = [...spec.toolNames].sort();
    const kb = ((prompt as { knowledge_base?: Array<{ id?: string; name?: string }> }).knowledge_base ?? [])
      .map((d) => ({ id: d.id, name: d.name }));
    const builtIn = (prompt.built_in_tools ?? {}) as Record<string, unknown>;
    const wf = readWorkflow(body);
    // Read-back of how the call behaves: nothing here decides in_sync,
    // it is what a person checks after changing settings.ts.
    const cc = (body.conversation_config ?? {}) as Record<string, unknown>;
    const liveSettings = {
      first_message_empty: (typeof agent?.first_message === "string" ? agent.first_message : "") === "",
      language: (agent as { language?: unknown } | undefined)?.language ?? null,
      language_presets: Object.keys((cc.language_presets ?? {}) as Record<string, unknown>),
      turn: cc.turn ?? null,
      client_events: (cc.conversation as { client_events?: unknown } | undefined)?.client_events ?? null,
      voice_id: (cc.tts as { voice_id?: unknown } | undefined)?.voice_id ?? null,
    };
    const checks = {
      prompt_hash: liveHash === repoHash,
      tools: JSON.stringify(liveTools) === JSON.stringify(wantTools),
      knowledge: kb.length === 1 && kb[0].name === kbDocName(spec.key),
      end_call: !!builtIn.end_call,
      workflow: Object.values(wf?.edges ?? {}).some((e) => e.source === "start_node"),
      // Mesi's voice is live (MESITA-4620): the prompt hash never covered TTS.
      voice: liveSettings.voice_id === TTS.voice_id,
    };
    agents.push({
      key: spec.key,
      id,
      name: body.name ?? null,
      hash: { repo: repoHash, stored: configuredAgents[spec.key]?.hash ?? null, live: liveHash },
      tools: liveTools,
      knowledge_base: kb,
      built_in_tools: Object.keys(builtIn).filter((k) => builtIn[k]),
      settings: liveSettings,
      workflow: summarizeWorkflow(wf),
      checks,
      in_sync: Object.values(checks).every(Boolean),
    });
  }
  return json({
    ok: true,
    mode,
    in_sync: agents.every((a) => a.in_sync === true),
    agents,
    workspace_agents: listedAgents.map((a) => ({ id: a.agent_id, name: a.name })),
    workspace_tools: toolRows.map((t) => {
      const c = (t.tool_config ?? {}) as Record<string, unknown>;
      return {
        id: t.id,
        name: t.tool_config?.name,
        interruption_mode: c.interruption_mode ?? null,
        disable_interruptions: c.disable_interruptions ?? null,
      };
    }),
  });
}
