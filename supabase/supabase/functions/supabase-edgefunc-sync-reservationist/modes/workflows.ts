// supabase-edgefunc-sync-reservationist · mode "workflows".
//
// Commit fleetWorkflows() onto each fleet agent's Main branch and read it back.

import { failedVerification, type WorkspaceCtx } from "./context.ts";
import {
  elFetch,
  resolveMainBranchId,
  readWorkflow,
  summarizeWorkflow,
  type VersionedAgentShape,
} from "../el-client.ts";
import { json } from "../../_shared/http.ts";
import { FLEET_AGENTS, fleetWorkflows } from "../../_shared/reservationist-fleet.ts";

export async function workflows(ctx: WorkspaceCtx): Promise<Response> {
  const { key, mode, configuredAgents, toolIdByName } = ctx;
  let specs: ReturnType<typeof fleetWorkflows>;
  try {
    specs = fleetWorkflows(toolIdByName);
  } catch (e) {
    return json({
      ok: false,
      error: e instanceof Error ? e.message : "fleetWorkflows failed",
    }, 500);
  }
  const report: Array<Record<string, unknown>> = [];
  for (const spec of FLEET_AGENTS) {
    const id = configuredAgents[spec.key]?.id?.trim();
    if (!id) {
      return json({
        ok: false,
        error: `agents_config.agents.${spec.key}.id missing — run mode fleet first`,
        report,
      }, 400);
    }
    const before = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`);
    if (!before.ok) {
      return json({ ok: false, error: `get ${spec.key}: ${before.error}`, report }, 502);
    }
    const tip = before.body as VersionedAgentShape;
    const branch = await resolveMainBranchId(key, id, tip);
    if (!branch.ok) {
      return json({ ok: false, error: `branch ${spec.key}: ${branch.error}`, report }, 502);
    }
    const wf = specs[spec.key];
    // Versioned agents: commit onto Main via ?branch_id=… (otherwise the UI
    // Main tip can keep an orphan Start while a draft holds the graph).
    const path =
      `/v1/convai/agents/${encodeURIComponent(id)}?branch_id=${
        encodeURIComponent(branch.branchId)
      }`;
    const patch = await elFetch(key, path, {
      method: "PATCH",
      body: {
        workflow: wf,
        version_description: `Mesita fleet workflows ${spec.key} (ASDM sync)`,
      },
    });
    if (!patch.ok) {
      return json({
        ok: false,
        error: `workflow ${spec.key}: ${patch.error}`,
        report,
      }, 502);
    }
    const after = await elFetch(
      key,
      `/v1/convai/agents/${encodeURIComponent(id)}?branch_id=${
        encodeURIComponent(branch.branchId)
      }`,
    );
    const afterBody = after.ok ? after.body as VersionedAgentShape : null;
    const afterWf = readWorkflow(afterBody);
    const summary = summarizeWorkflow(afterWf);
    const startEdges = Object.values(afterWf?.edges ?? {}).filter((e) =>
      e.source === "start_node"
    );
    report.push({
      key: spec.key,
      id,
      branch_id: branch.branchId,
      version_id: afterBody?.version_id ?? null,
      desired_nodes: Object.keys(wf.nodes),
      desired_edges: Object.keys(wf.edges),
      verified: summary,
      start_connected: startEdges.length > 0,
      ok: summary.node_count >= 3 &&
        summary.nodes.some((n) => n.startsWith("start_node")) &&
        startEdges.length > 0,
    });
  }
  const failed = failedVerification(report);
  if (failed) return json({ ok: false, error: failed, mode, agents: report }, 502);
  return json({ ok: true, mode, agents: report });
}
