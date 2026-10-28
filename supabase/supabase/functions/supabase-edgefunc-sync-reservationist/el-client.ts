// supabase-edgefunc-sync-reservationist · the ElevenLabs management client.
//
// One fetch wrapper (never throws; every failure is an { ok:false, error }
// string with method, path and status), the agent/workflow shapes the modes
// read back, and the two write helpers more than one mode needs.

import { EL_BASE, elHeaders } from "../_shared/elevenlabs.ts";

export async function elFetch(
  key: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: true; status: number; body: unknown } | { ok: false; error: string }> {
  let r: Response;
  try {
    r = await fetch(`${EL_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: elHeaders(key),
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : `fetch ${path} failed` };
  }
  let body: unknown = null;
  try {
    body = await r.json();
  } catch {
    // some 2xx responses may be empty — keep null
  }
  if (!r.ok) {
    return {
      ok: false,
      error: `${init?.method ?? "GET"} ${path} → HTTP ${r.status}: ${
        JSON.stringify(body).slice(0, 400)
      }`,
    };
  }
  return { ok: true, status: r.status, body };
}

export type AgentWorkflowShape = {
  nodes?: Record<string, { type?: string; label?: string; edge_order?: string[] }>;
  edges?: Record<string, { source?: string; target?: string }>;
  prevent_subagent_loops?: boolean;
};

export type VersionedAgentShape = {
  workflow?: AgentWorkflowShape;
  conversation_config?: { workflow?: AgentWorkflowShape };
  version_id?: string | null;
  branch_id?: string | null;
  main_branch_id?: string | null;
};

export function readWorkflow(agent: VersionedAgentShape | null | undefined): AgentWorkflowShape | null {
  if (!agent) return null;
  return agent.workflow ?? agent.conversation_config?.workflow ?? null;
}

export function summarizeWorkflow(wf: AgentWorkflowShape | null) {
  if (!wf?.nodes) {
    return { node_count: 0, edge_count: 0, nodes: [] as string[], edges: [] as string[] };
  }
  const nodes = Object.entries(wf.nodes).map(([id, n]) => {
    const label = typeof n.label === "string" && n.label ? `:${n.label}` : "";
    return `${id}(${n.type ?? "?"}${label})`;
  });
  const edges = Object.entries(wf.edges ?? {}).map(([id, e]) =>
    `${id}:${e.source ?? "?"}→${e.target ?? "?"}`
  );
  return {
    node_count: nodes.length,
    edge_count: edges.length,
    nodes,
    edges,
    prevent_subagent_loops: wf.prevent_subagent_loops ?? null,
  };
}

/** Resolve Main branch id for a versioned agent (required to commit workflow). */
export async function resolveMainBranchId(
  key: string,
  agentId: string,
  tip: VersionedAgentShape,
): Promise<{ ok: true; branchId: string } | { ok: false; error: string }> {
  const fromTip = tip.main_branch_id?.trim() || tip.branch_id?.trim() || "";
  if (fromTip) return { ok: true, branchId: fromTip };
  const listed = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(agentId)}/branches`);
  if (!listed.ok) return { ok: false, error: `list branches: ${listed.error}` };
  const branches = (listed.body as {
    branches?: Array<{ id?: string; name?: string; archived?: boolean }>;
  } | null)?.branches ?? [];
  const main = branches.find((b) => (b.name ?? "").toLowerCase() === "main" && !b.archived) ??
    branches.find((b) => !b.archived);
  const id = main?.id?.trim();
  if (!id) return { ok: false, error: "no Main branch found on agent" };
  return { ok: true, branchId: id };
}

export type PromptShape = Record<string, unknown> & {
  prompt?: string;
  tool_ids?: string[];
  llm?: string;
  temperature?: number;
  built_in_tools?: Record<string, unknown>;
};

export type AgentShape = {
  name?: string;
  conversation_config?: Record<string, unknown> & {
    agent?: Record<string, unknown> & {
      language?: string;
      prompt?: PromptShape;
    };
    tts?: Record<string, unknown>;
    asr?: Record<string, unknown>;
    turn?: Record<string, unknown>;
    conversation?: Record<string, unknown>;
  };
};

export type ToolRow = { id?: string; tool_config?: { name?: string; type?: string } };

// Create-or-update one workspace tool; returns its id.
export async function upsertTool(
  key: string,
  existingByName: Map<string, string>,
  name: string,
  config: Record<string, unknown>,
): Promise<{ ok: true; id: string; action: string } | { ok: false; error: string }> {
  const existing = existingByName.get(name) ?? null;
  if (existing) {
    const upd = await elFetch(key, `/v1/convai/tools/${encodeURIComponent(existing)}`, {
      method: "PATCH",
      body: { tool_config: config },
    });
    if (!upd.ok) return { ok: false, error: upd.error };
    return { ok: true, id: existing, action: "updated" };
  }
  const crt = await elFetch(key, "/v1/convai/tools", { method: "POST", body: { tool_config: config } });
  if (!crt.ok) return { ok: false, error: crt.error };
  const id = ((crt.body as { id?: string } | null)?.id) ?? null;
  if (!id) {
    return { ok: false, error: `tool ${name} created but no id in response` };
  }
  return { ok: true, id, action: "created" };
}
