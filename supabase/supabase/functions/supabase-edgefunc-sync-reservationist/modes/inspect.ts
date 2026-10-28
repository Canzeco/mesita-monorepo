// supabase-edgefunc-sync-reservationist · mode "inspect".
//
// Read-only report: donor agent, workspace agents/tools, each fleet agent's
// live workflow, KB and system tools.

import type { DonorCtx } from "./context.ts";
import {
  elFetch,
  readWorkflow,
  summarizeWorkflow,
  type VersionedAgentShape,
} from "../el-client.ts";
import { json } from "../../_shared/http.ts";
import { FLEET_AGENTS } from "../../_shared/reservationist-fleet.ts";

export async function inspect(ctx: DonorCtx): Promise<Response> {
  const {
    key,
    mode,
    configuredAgents,
    listedAgents,
    toolRows,
    toolIdByName,
    donorId,
    donor,
    promptCharsBefore,
    toolIdsBefore,
  } = ctx;
  const fleetWorkflowsLive: Array<Record<string, unknown>> = [];
  for (const spec of FLEET_AGENTS) {
    const id = configuredAgents[spec.key]?.id?.trim();
    if (!id) {
      fleetWorkflowsLive.push({ key: spec.key, error: "missing agents_config id" });
      continue;
    }
    const got = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`);
    if (!got.ok) {
      fleetWorkflowsLive.push({ key: spec.key, id, error: got.error });
      continue;
    }
    const body = got.body as VersionedAgentShape & {
      name?: string;
      conversation_config?: {
        agent?: {
          prompt?: {
            knowledge_base?: Array<{ id?: string; name?: string }>;
            built_in_tools?: Record<string, unknown> | null;
            tools?: Array<{ type?: string; name?: string }> | null;
          };
        };
      };
    };
    const wf = readWorkflow(body);
    const summary = summarizeWorkflow(wf);
    const startEdges = Object.values(wf?.edges ?? {}).filter((e) => e.source === "start_node");
    const prompt = body.conversation_config?.agent?.prompt ?? {};
    const kb = prompt.knowledge_base ?? [];
    // SYSTEM TOOLS are the hang-up question: end_call is only auto-added to
    // agents created in the DASHBOARD. Ours are API-created, so report what
    // each one actually carries instead of assuming.
    const builtIn = prompt.built_in_tools ?? null;
    const systemToolNames = Array.isArray(prompt.tools)
      ? prompt.tools.filter((t) => t?.type === "system").map((t) => t?.name ?? "?")
      : [];
    fleetWorkflowsLive.push({
      key: spec.key,
      id,
      name: body.name ?? null,
      version_id: body.version_id ?? null,
      branch_id: body.branch_id ?? null,
      main_branch_id: body.main_branch_id ?? null,
      start_connected: startEdges.length > 0,
      workflow: summary,
      knowledge_base: kb.map((d) => ({ id: d.id, name: d.name })),
      built_in_tools: builtIn,
      built_in_tool_keys: builtIn ? Object.keys(builtIn) : [],
      system_tools: systemToolNames,
      has_end_call: !!(builtIn && "end_call" in builtIn) ||
        systemToolNames.includes("end_call"),
    });
  }
  return json({
    ok: true,
    mode,
    donor: { id: donorId, name: donor.name ?? null },
    prompt_chars: promptCharsBefore,
    tool_ids: toolIdsBefore,
    workspace_agents: listedAgents.map((a) => ({ id: a.agent_id, name: a.name })),
    workspace_tools: toolRows.map((t) => ({ id: t.id, name: t.tool_config?.name })),
    get_reservation_tool_id: toolIdByName.get("get_reservation") ?? null,
    configured_fleet: configuredAgents,
    fleet_workflows: fleetWorkflowsLive,
  });
}
