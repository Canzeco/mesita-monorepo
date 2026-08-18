// Supabase Edge Function — supabase-edgefunc-sync-reservationist (internal)
//
// Config-as-code for the ElevenLabs Reservationist FLEET: makes the LIVE
// workspace match Mesita's spec via the ElevenLabs management API — the
// ELEVENLABS_KEY never leaves EF env, so an operator (or an agent session with
// SQL access) can wire everything without touching the console.
//
// Body: { mode?: "inspect" | "sync" | "fleet" | "prune" | "workflows" | "knowledge"
//          | "phones" }
//
//   inspect    read-only report: donor agent, workspace agents/tools, fleet.
//   sync       RETIRED (2026-08-01) — returns 400. get_reservation is a fleet
//              tool now (fleetToolConfigs, attached to a3/a4).
//   fleet      upsert the 9 fleet tools + agents; store ids in agents_config.
//   prune      delete non-fleet agents (fleet tools are managed by fleet mode
//              and never deleted here).
//   workflows  Commit AgentWorkflowRequestModel for a1–a4 from fleetWorkflows()
//              onto each agent's Main branch (?branch_id + version_description).
//              Workflows only — Procedures stay unused (Alpha).
//   phones     Import the two Twilio reservation lines into ElevenLabs and bind
//              each to its INBOUND agent: the place-facing line → a4, the
//              guest-facing line → a3. An imported number binds to exactly ONE
//              agent, which is why the two audiences cannot share a line — on a
//              single line one side always hears "no Mesita account with this
//              number". Idempotent: imports what is missing, re-binds what is
//              pointed at the wrong agent, leaves correct rows untouched.
//   knowledge  Upsert the curated Mesita brief (Notion-sourced, repo-held) as
//              ONE KB text doc PER AGENT (a1-kb-v1 …); each fleet agent ends
//              with exactly that doc attached on Main (usage_mode=prompt).
//              The pre-fleet shared doc is deleted once detached.
//
// PROMPTS ARE WRITTEN ONLY AT AGENT CREATION. On every later run the fleet
// mode PATCHes name + prompt.tool_ids exclusively and verifies the prompt
// text length is unchanged — console tuning survives. EXCEPTION, opt-in:
// { mode: "fleet", write_prompts: true } ALSO rewrites each fleet agent's
// prompt + first message from the repo spec.
//
// Auth: verify_jwt = true + requireInternalCaller — invoke via pg_net with the
// vault scheduler_service_role_key, exactly like the cron schedulers do.
//
// Deploy: supabase functions deploy supabase-edgefunc-sync-reservationist

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import {
  consumerFromNumber,
  resolveElevenLabsKey,
  reservationAgentId,
  reservationFromNumber,
} from "../_shared/elevenlabs.ts";
import {
  FLEET_AGENTS,
  FLEET_BUILT_IN_TOOLS,
  fleetToolConfigs,
  fleetWorkflows,
} from "../_shared/reservationist-fleet.ts";
import {
  LEGACY_RESERVATIONIST_KB_DOC_NAME,
  RESERVATIONIST_KB_TEXT,
  reservationistKbDocName,
} from "../_shared/reservationist-kb.ts";

const EL_BASE = "https://api.elevenlabs.io";

function headers(key: string): HeadersInit {
  return { "xi-api-key": key, "Content-Type": "application/json" };
}

async function elFetch(
  key: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: true; status: number; body: unknown } | { ok: false; error: string }> {
  let r: Response;
  try {
    r = await fetch(`${EL_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: headers(key),
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

type AgentWorkflowShape = {
  nodes?: Record<string, { type?: string; label?: string; edge_order?: string[] }>;
  edges?: Record<string, { source?: string; target?: string }>;
  prevent_subagent_loops?: boolean;
};

type VersionedAgentShape = {
  workflow?: AgentWorkflowShape;
  conversation_config?: { workflow?: AgentWorkflowShape };
  version_id?: string | null;
  branch_id?: string | null;
  main_branch_id?: string | null;
};

function readWorkflow(agent: VersionedAgentShape | null | undefined): AgentWorkflowShape | null {
  if (!agent) return null;
  return agent.workflow ?? agent.conversation_config?.workflow ?? null;
}

function summarizeWorkflow(wf: AgentWorkflowShape | null) {
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
async function resolveMainBranchId(
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

type PromptShape = Record<string, unknown> & {
  prompt?: string;
  tool_ids?: string[];
  llm?: string;
  temperature?: number;
  built_in_tools?: Record<string, unknown>;
};

type AgentShape = {
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

type ToolRow = { id?: string; tool_config?: { name?: string; type?: string } };

// Create-or-update one workspace tool; returns its id.
async function upsertTool(
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = requireInternalCaller(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const key = await resolveElevenLabsKey();
  if (!key?.startsWith("sk_")) {
    return json({ ok: false, error: "ELEVENLABS_KEY not configured" }, 503);
  }
  const fallbackAgentId = reservationAgentId();

  const body = await readJsonOr<{
    mode?: unknown;
    write_prompts?: unknown;
    conversation_id?: unknown;
    limit?: unknown;
  }>(req, {});
  const rawMode = typeof body.mode === "string" ? body.mode : "inspect";
  const allowed = new Set([
    "inspect",
    "sync",
    "fleet",
    "prune",
    "workflows",
    "knowledge",
    "calls",
    "transcript",
    "phones",
  ]);
  if (!allowed.has(rawMode)) {
    return json({
      ok: false,
      error: `unknown mode ${JSON.stringify(rawMode)}; use ${[...allowed].join("|")}`,
    }, 400);
  }
  const mode = rawMode as
    | "inspect"
    | "sync"
    | "fleet"
    | "prune"
    | "workflows"
    | "knowledge"
    | "calls"
    | "transcript"
    | "phones";
  const writePrompts = body.write_prompts === true;

  // ── Read-only call observability ─────────────────────────────────────────
  // WHY: prompts and graphs were being tuned blind. Nothing in Supabase records
  // what the agent actually SAID — the transcript lives only in ElevenLabs, and
  // the key never leaves EF env. These two modes are the eyes: `calls` lists
  // recent conversations, `transcript` replays one turn by turn with its tool
  // calls. Read-only; they never mutate an agent.
  if (mode === "calls" || mode === "transcript") {
    if (mode === "transcript") {
      const cid = typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";
      if (!cid) {
        return json({ ok: false, error: "transcript mode needs conversation_id" }, 400);
      }
      const got = await elFetch(key, `/v1/convai/conversations/${encodeURIComponent(cid)}`);
      if (!got.ok) return json({ ok: false, error: got.error }, 502);
      const c = got.body as {
        agent_id?: string;
        status?: string;
        metadata?: { call_duration_secs?: number; start_time_unix_secs?: number };
        analysis?: { call_successful?: string; transcript_summary?: string };
        transcript?: Array<{
          role?: string;
          message?: string | null;
          time_in_call_secs?: number;
          tool_calls?: Array<{ tool_name?: string; params_as_json?: string }>;
          tool_results?: Array<{ tool_name?: string; result_value?: string; is_error?: boolean }>;
        }>;
      };
      // Flatten to something readable in a SQL cell: who said what, and every
      // tool the agent fired (the thing that decides whether the ticket moves).
      const turns = (c.transcript ?? []).map((t) => {
        const bits: string[] = [];
        for (const call of t.tool_calls ?? []) {
          bits.push(`TOOL→ ${call.tool_name}(${(call.params_as_json ?? "").slice(0, 240)})`);
        }
        for (const res of t.tool_results ?? []) {
          bits.push(
            `TOOL← ${res.tool_name}${res.is_error ? " ERROR" : ""}: ${
              (res.result_value ?? "").slice(0, 240)
            }`,
          );
        }
        return {
          at: t.time_in_call_secs ?? null,
          role: t.role ?? "?",
          text: (t.message ?? "").slice(0, 400),
          tools: bits.length ? bits : undefined,
        };
      });
      return json({
        ok: true,
        mode,
        conversation_id: cid,
        agent_id: c.agent_id ?? null,
        status: c.status ?? null,
        call_successful: c.analysis?.call_successful ?? null,
        duration_secs: c.metadata?.call_duration_secs ?? null,
        summary: c.analysis?.transcript_summary ?? null,
        // The WHOLE metadata blob, untrimmed. A 0-second "failed" call says
        // nothing in its transcript — the reason (termination_reason, the
        // rejection detail, whether a per-call override rode along) lives in
        // here, and guessing at it burned real debugging time. Whatever field
        // carries the answer next time, it will already be in the response.
        metadata: (c as { metadata?: unknown }).metadata ?? null,
        tools_fired: turns.flatMap((t) => t.tools ?? []),
        turns,
      });
    }

    const lim = typeof body.limit === "number" && body.limit > 0
      ? Math.min(Math.trunc(body.limit), 30)
      : 10;
    const listed = await elFetch(key, `/v1/convai/conversations?page_size=${lim}`);
    if (!listed.ok) return json({ ok: false, error: listed.error }, 502);
    const rows = (listed.body as {
      conversations?: Array<{
        conversation_id?: string;
        agent_id?: string;
        agent_name?: string;
        status?: string;
        call_successful?: string;
        start_time_unix_secs?: number;
        call_duration_secs?: number;
        message_count?: number;
      }>;
    } | null)?.conversations ?? [];
    return json({
      ok: true,
      mode,
      count: rows.length,
      conversations: rows.map((r) => ({
        id: r.conversation_id,
        agent: r.agent_name ?? r.agent_id,
        status: r.status,
        successful: r.call_successful,
        secs: r.call_duration_secs,
        turns: r.message_count,
        started_utc: r.start_time_unix_secs
          ? new Date(r.start_time_unix_secs * 1000).toISOString()
          : null,
      })),
    });
  }

  // The tool secret + agent state — read live so a SQL rotation propagates on
  // the next sync.
  const admin = adminClient(envRes.env);
  const { data: settings } = await admin
    .from("app_config")
    .select("agents_config")
    .eq("id", 1)
    .maybeSingle();
  const agentsConfig = (settings?.agents_config ?? {}) as Record<string, unknown>;
  const toolSecret = ((agentsConfig.toolSecret as string | undefined) ?? "").trim();
  if (!toolSecret) {
    return json({ ok: false, error: "app_settings.agents_config.toolSecret missing" }, 500);
  }
  const configuredAgents = (agentsConfig.agents ?? {}) as Record<
    string,
    { id?: string; name?: string } | undefined
  >;
  // Donor = a1 from live fleet config. Env / DEFAULT only for brand-new workspaces.
  const donorId = configuredAgents.a1?.id?.trim() || fallbackAgentId;

  const toolsRes = await elFetch(key, "/v1/convai/tools");
  if (!toolsRes.ok) return json({ ok: false, error: toolsRes.error }, 502);
  const toolRows: ToolRow[] = (toolsRes.body as { tools?: ToolRow[] } | null)?.tools ?? [];
  const toolIdByName = new Map<string, string>();
  for (const t of toolRows) {
    if (t.id && t.tool_config?.name) toolIdByName.set(t.tool_config.name, t.id);
  }
  const listResEarly = await elFetch(key, "/v1/convai/agents?page_size=100");
  if (!listResEarly.ok) return json({ ok: false, error: listResEarly.error }, 502);
  const listedAgents = (listResEarly.body as {
    agents?: Array<{ agent_id?: string; name?: string }>;
  } | null)?.agents ?? [];

  // ── mode "phones": one line per audience, bound to its inbound agent ──────
  if (mode === "phones") {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
    const token = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
    if (!sid || !token) {
      return json({
        ok: false,
        error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured — needed to import",
      }, 503);
    }

    const businessLine = reservationFromNumber();
    const consumerLine = consumerFromNumber();
    if (consumerLine === businessLine) {
      return json({
        ok: false,
        error:
          "ELEVENLABS_CONSUMER_FROM_NUMBER is unset, so both audiences resolve to " +
          `${businessLine}. Set it before binding — a3 and a4 cannot share a line.`,
      }, 400);
    }

    const want = [
      {
        key: "a4",
        e164: businessLine,
        label: "Mesita Reservations (Businesses)",
        agentId: configuredAgents.a4?.id?.trim() ?? "",
      },
      {
        key: "a3",
        e164: consumerLine,
        label: "Mesita Reservations (Consumers)",
        agentId: configuredAgents.a3?.id?.trim() ?? "",
      },
    ];
    const missingAgent = want.filter((w) => !w.agentId).map((w) => w.key);
    if (missingAgent.length > 0) {
      return json({
        ok: false,
        error: `agents_config.agents is missing ${missingAgent.join(", ")} — run mode "fleet" first`,
      }, 400);
    }

    const listed = await elFetch(key, "/v1/convai/phone-numbers");
    if (!listed.ok) return json({ ok: false, error: listed.error }, 502);
    const existing = Array.isArray(listed.body)
      ? (listed.body as Array<Record<string, unknown>>)
      : [];
    const digits = (v: string) => v.replace(/[^\d+]/g, "");
    const findRow = (e164: string) =>
      existing.find((row) =>
        typeof row.phone_number === "string" && digits(row.phone_number) === digits(e164)
      ) ?? null;

    const actions: Array<Record<string, unknown>> = [];
    for (const w of want) {
      const row = findRow(w.e164);
      if (!row) {
        // Not imported yet. NOTE: importing takes over this number's Twilio
        // voice webhook — intended, that is what makes ElevenLabs answer it.
        const created = await elFetch(key, "/v1/convai/phone-numbers", {
          method: "POST",
          body: {
            phone_number: w.e164,
            label: w.label,
            sid,
            token,
            provider: "twilio",
            agent_id: w.agentId,
          },
        });
        if (!created.ok) {
          return json({ ok: false, error: `import ${w.e164}: ${created.error}`, actions }, 502);
        }
        actions.push({ number: w.e164, agent: w.key, action: "imported+bound" });
        continue;
      }

      const id = typeof row.phone_number_id === "string" ? row.phone_number_id : "";
      const boundTo = typeof row.assigned_agent === "object" && row.assigned_agent !== null
        ? (row.assigned_agent as { agent_id?: string }).agent_id ?? null
        : (typeof row.agent_id === "string" ? row.agent_id : null);
      if (boundTo === w.agentId) {
        actions.push({ number: w.e164, agent: w.key, action: "already correct" });
        continue;
      }
      if (!id) {
        return json({
          ok: false,
          error: `${w.e164} is imported but carries no phone_number_id — cannot re-bind`,
          actions,
        }, 502);
      }
      const patched = await elFetch(
        key,
        `/v1/convai/phone-numbers/${encodeURIComponent(id)}`,
        { method: "PATCH", body: { agent_id: w.agentId } },
      );
      if (!patched.ok) {
        return json({ ok: false, error: `bind ${w.e164}: ${patched.error}`, actions }, 502);
      }
      actions.push({
        number: w.e164,
        agent: w.key,
        action: "re-bound",
        was: boundTo,
      });
    }

    const after = await elFetch(key, "/v1/convai/phone-numbers");
    return json({
      ok: true,
      mode,
      business_line: businessLine,
      consumer_line: consumerLine,
      actions,
      phone_numbers: after.ok ? after.body : null,
    });
  }

  if (mode === "prune") {
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

  if (mode === "workflows") {
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
    return json({
      ok: report.every((r) => r.ok === true),
      mode,
      agents: report,
    });
  }

  if (mode === "knowledge") {
    // Per-agent curated docs — each fleet agent's KB page ends with EXACTLY
    // one doc, named a1-kb-v1 … a4-kb-v1 (same repo-held text; the name says
    // owner + content version). The pre-fleet shared doc is deleted once no
    // fleet agent references it.
    const savedDocIds = (agentsConfig.knowledgeDocIds ?? {}) as Record<
      string,
      string | undefined
    >;
    const legacySavedId = typeof agentsConfig.knowledgeDocId === "string"
      ? agentsConfig.knowledgeDocId.trim()
      : "";

    // Workspace docs by name — adopt console-created docs instead of duplicating.
    const docIdByName = new Map<string, string>();
    {
      const listed = await elFetch(key, "/v1/convai/knowledge-base?page_size=100");
      if (listed.ok) {
        const docs = (listed.body as {
          documents?: Array<{ id?: string; name?: string }>;
        } | null)?.documents ??
          (Array.isArray(listed.body)
            ? listed.body as Array<{ id?: string; name?: string }>
            : []);
        for (const d of docs) {
          if (d.id && d.name) docIdByName.set(d.name, d.id);
        }
      }
    }

    const docsOut: Record<string, string> = {};
    const attachReport: Array<Record<string, unknown>> = [];

    for (const spec of FLEET_AGENTS) {
      const id = configuredAgents[spec.key]?.id?.trim();
      if (!id) {
        return json({
          ok: false,
          error: `agents_config.agents.${spec.key}.id missing — run mode fleet first`,
          attachReport,
        }, 400);
      }
      const docName = reservationistKbDocName(spec.key);

      // 1 · Upsert this agent's doc: saved id → exact name → create.
      let docId = (savedDocIds[spec.key] ?? "").trim();
      let docAction = "updated";
      if (docId) {
        const upd = await elFetch(
          key,
          `/v1/convai/knowledge-base/${encodeURIComponent(docId)}`,
          { method: "PATCH", body: { name: docName, content: RESERVATIONIST_KB_TEXT } },
        );
        if (!upd.ok) docId = ""; // stale id — fall through
      }
      if (!docId) {
        const hit = docIdByName.get(docName);
        if (hit) {
          const upd = await elFetch(
            key,
            `/v1/convai/knowledge-base/${encodeURIComponent(hit)}`,
            { method: "PATCH", body: { name: docName, content: RESERVATIONIST_KB_TEXT } },
          );
          if (!upd.ok) {
            return json({ ok: false, error: `kb update ${docName}: ${upd.error}` }, 502);
          }
          docId = hit;
          docAction = "updated-by-name";
        }
      }
      if (!docId) {
        const crt = await elFetch(key, "/v1/convai/knowledge-base/text", {
          method: "POST",
          body: { name: docName, text: RESERVATIONIST_KB_TEXT },
        });
        if (!crt.ok) {
          return json({ ok: false, error: `kb create ${docName}: ${crt.error}` }, 502);
        }
        docId = ((crt.body as { id?: string } | null)?.id) ?? "";
        if (!docId) {
          return json({
            ok: false,
            error: `kb create ${docName} returned no id: ${
              JSON.stringify(crt.body).slice(0, 300)
            }`,
          }, 502);
        }
        docAction = "created";
      }
      docsOut[spec.key] = docId;
      docIdByName.set(docName, docId);

      // 2 · Attach as the SOLE doc on Main (replace, never merge).
      const before = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`);
      if (!before.ok) {
        return json({ ok: false, error: `get ${spec.key}: ${before.error}`, attachReport }, 502);
      }
      const tip = before.body as VersionedAgentShape;
      const branch = await resolveMainBranchId(key, id, tip);
      if (!branch.ok) {
        return json({ ok: false, error: `branch ${spec.key}: ${branch.error}`, attachReport }, 502);
      }
      const path = `/v1/convai/agents/${encodeURIComponent(id)}?branch_id=${
        encodeURIComponent(branch.branchId)
      }`;
      const patch = await elFetch(key, path, {
        method: "PATCH",
        body: {
          conversation_config: {
            agent: {
              prompt: {
                knowledge_base: [
                  { type: "text", name: docName, id: docId, usage_mode: "prompt" },
                ],
              },
            },
          },
          version_description: `Mesita KB ${docName} — sole doc (ASDM sync)`,
        },
      });
      if (!patch.ok) {
        return json({ ok: false, error: `attach ${spec.key}: ${patch.error}`, attachReport }, 502);
      }
      const after = await elFetch(key, path);
      const afterKb = after.ok
        ? ((after.body as {
          conversation_config?: {
            agent?: { prompt?: { knowledge_base?: Array<{ id?: string; name?: string }> } };
          };
        }).conversation_config?.agent?.prompt?.knowledge_base ?? [])
        : [];
      const sole = afterKb.length === 1 && afterKb[0]?.id === docId;
      attachReport.push({
        key: spec.key,
        id,
        branch_id: branch.branchId,
        document: { id: docId, name: docName, action: docAction },
        knowledge_base: afterKb.map((d) => ({ id: d.id, name: d.name })),
        ok: sole,
      });
    }

    // 3 · The shared pre-fleet doc is unreferenced now — delete it (best effort).
    const fleetDocIds = new Set(Object.values(docsOut));
    const legacyId = legacySavedId || docIdByName.get(LEGACY_RESERVATIONIST_KB_DOC_NAME) || "";
    let legacyCleanup: Record<string, unknown> | null = null;
    if (legacyId && !fleetDocIds.has(legacyId)) {
      let del = await elFetch(
        key,
        `/v1/convai/knowledge-base/${encodeURIComponent(legacyId)}`,
        { method: "DELETE" },
      );
      if (!del.ok) {
        del = await elFetch(
          key,
          `/v1/convai/knowledge-base/${encodeURIComponent(legacyId)}?force=true`,
          { method: "DELETE" },
        );
      }
      legacyCleanup = {
        id: legacyId,
        action: del.ok ? "deleted" : "delete-failed (non-fatal)",
        error: del.ok ? null : del.error,
      };
    }

    // 4 · Persist the per-agent ids (drop the legacy single-doc key).
    const nextConfig: Record<string, unknown> = {
      ...agentsConfig,
      knowledgeDocIds: docsOut,
      knowledgeSyncedAt: new Date().toISOString(),
    };
    delete nextConfig.knowledgeDocId;
    const { error: saveErr } = await admin
      .from("app_config")
      .update({ agents_config: nextConfig })
      .eq("id", 1);

    return json({
      ok: attachReport.every((r) => r.ok === true),
      mode,
      documents: FLEET_AGENTS.map((s) => ({
        key: s.key,
        id: docsOut[s.key] ?? null,
        name: reservationistKbDocName(s.key),
        chars: RESERVATIONIST_KB_TEXT.length,
      })),
      agents: attachReport,
      legacy: legacyCleanup,
      config_saved: !saveErr,
      config_error: saveErr?.message ?? null,
    });
  }

  // ── Read the donor agent (a1) + its prompt shape ───────────────────────────
  const agentRes = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(donorId)}`);
  if (!agentRes.ok) return json({ ok: false, error: agentRes.error }, 502);
  const donor = agentRes.body as AgentShape;
  const donorCc = donor.conversation_config ?? {};
  const donorPrompt = donorCc.agent?.prompt ?? {};
  const promptCharsBefore = typeof donorPrompt.prompt === "string" ? donorPrompt.prompt.length : 0;
  const toolIdsBefore: string[] = Array.isArray(donorPrompt.tool_ids)
    ? [...donorPrompt.tool_ids]
    : [];

  if (mode === "inspect") {
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

  // ── mode "fleet": the four agents + their 7 tools ──────────────────────────
  if (mode === "fleet") {
    // 1 · Upsert the 7 family tools.
    const toolReport: Array<{ name: string; id: string; action: string }> = [];
    for (const def of fleetToolConfigs(envRes.env.url, envRes.env.anonKey, toolSecret)) {
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
    const { error: saveErr } = await admin
      .from("app_config")
      .update({ agents_config: newConfig })
      .eq("id", 1);

    return json({
      ok: true,
      mode,
      donor: { id: donorId, name: donor.name ?? null, language, sections: Object.keys(donorSections) },
      tools: toolReport,
      agents: agentReport,
      config_saved: !saveErr,
      config_error: saveErr?.message ?? null,
    });
  }

  // ── mode "sync" — RETIRED 2026-08-01 ───────────────────────────────────────
  // get_reservation is a first-class fleet tool now (fleetToolConfigs, attached
  // to a3/a4); the old single-agent path would fight fleet mode over the same
  // workspace tool name with a divergent schema.
  return json({
    ok: false,
    error: 'mode "sync" is retired — use mode "fleet" (get_reservation is a fleet tool now)',
  }, 400);
});
