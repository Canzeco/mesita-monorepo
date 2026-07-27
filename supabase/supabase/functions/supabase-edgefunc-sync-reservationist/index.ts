// Supabase Edge Function — supabase-edgefunc-sync-reservationist (internal / artificial caller)
//
// Config-as-code for the ElevenLabs Reservationist FLEET: makes the LIVE
// workspace match Mesita's spec via the ElevenLabs management API — the
// ELEVENLABS_KEY never leaves EF env, so an operator (or an agent session with
// SQL access) can wire everything without touching the console.
//
// Body: { mode?: "inspect" | "sync" | "fleet" | "prune" | "workflows" }
//
//   inspect    read-only report: donor agent, workspace agents/tools, fleet.
//   sync       LEGACY — prefer fleet. Unknown modes return 400 (never silently
//              fall through to sync — that once recreated get_reservation).
//   fleet      upsert family tools + agents; store ids in agents_config.
//   prune      delete non-fleet agents + force-delete legacy get_reservation.
//   workflows  PATCH conversation_config.workflow for a1–a4 from
//              fleetWorkflows() — Workflows only (Procedures stay unused).
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
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { elevenLabsKey, reservationAgentId } from "../_shared/elevenlabs.ts";
import { FLEET_AGENTS, fleetToolConfigs, fleetWorkflows } from "../_shared/reservationist-fleet.ts";

const EL_BASE = "https://api.elevenlabs.io";
const TOOL_NAME = "get_reservation";

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

// The legacy webhook tool definition, built from live env + DB state.
function desiredToolConfig(supabaseUrl: string, anonKey: string, toolSecret: string) {
  return {
    type: "webhook",
    name: TOOL_NAME,
    description:
      "Busca una reservación de Mesita en la base de datos en TIEMPO REAL. Úsala cuando el interlocutor mencione una reservación existente: pide el código de referencia de 8 dígitos, o si no lo tiene, el nombre y apellido del comensal. Devuelve lugar, fecha, hora, personas y estado, listos para decirse en voz alta.",
    response_timeout_secs: 15,
    api_schema: {
      url: `${supabaseUrl}/functions/v1/eleven-agent-get-reservation`,
      method: "POST",
      request_headers: {
        Authorization: `Bearer ${anonKey}`,
        "x-agent-secret": toolSecret,
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        required: [],
        description: "Claves de búsqueda — manda el código si lo tienes, si no el nombre.",
        properties: {
          reference_code: {
            type: "string",
            description: "Código de referencia de 8 dígitos de la reservación (ej. 48291057).",
          },
          first_name: {
            type: "string",
            description: "Nombre del comensal, tal como lo dijo.",
          },
          last_name: {
            type: "string",
            description: "Apellido del comensal, tal como lo dijo.",
          },
        },
      },
    },
  };
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
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = requireInternalCaller(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const key = elevenLabsKey();
  if (!key) return json({ ok: false, error: "ELEVENLABS_KEY not configured" }, 503);
  const fallbackAgentId = reservationAgentId();

  const body = await readJsonOr<{ mode?: unknown; write_prompts?: unknown }>(req, {});
  const rawMode = typeof body.mode === "string" ? body.mode : "inspect";
  const allowed = new Set(["inspect", "sync", "fleet", "prune", "workflows"]);
  if (!allowed.has(rawMode)) {
    return json({
      ok: false,
      error: `unknown mode ${JSON.stringify(rawMode)}; use inspect|sync|fleet|prune|workflows`,
    }, 400);
  }
  const mode = rawMode as "inspect" | "sync" | "fleet" | "prune" | "workflows";
  const writePrompts = body.write_prompts === true;

  // The tool secret + agent state — read live so a SQL rotation propagates on
  // the next sync.
  const admin = adminClient(envRes.env);
  const { data: settings } = await admin
    .from("app_settings")
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
  const legacyToolId = toolIdByName.get(TOOL_NAME) ?? null;

  const listResEarly = await elFetch(key, "/v1/convai/agents?page_size=100");
  if (!listResEarly.ok) return json({ ok: false, error: listResEarly.error }, 502);
  const listedAgents = (listResEarly.body as {
    agents?: Array<{ agent_id?: string; name?: string }>;
  } | null)?.agents ?? [];

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
    let legacyTool: { id: string; action: string } | null = null;
    if (legacyToolId) {
      const delTool = await elFetch(
        key,
        `/v1/convai/tools/${encodeURIComponent(legacyToolId)}?force=true`,
        { method: "DELETE" },
      );
      if (!delTool.ok) {
        return json({
          ok: false,
          error: `delete tool get_reservation: ${delTool.error}`,
          deleted,
        }, 502);
      }
      legacyTool = { id: legacyToolId, action: "deleted" };
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
      legacy_tool: legacyTool,
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
      const wf = specs[spec.key];
      // Top-level `workflow` per Agents update OpenAPI (also accepted under
      // conversation_config — top-level is the dedicated field).
      const patch = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { workflow: wf },
      });
      if (!patch.ok) {
        return json({
          ok: false,
          error: `workflow ${spec.key}: ${patch.error}`,
          report,
        }, 502);
      }
      // Verify nodes landed.
      const after = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`);
      const afterWf = after.ok
        ? ((after.body as {
          workflow?: { nodes?: Record<string, unknown> };
          conversation_config?: { workflow?: { nodes?: Record<string, unknown> } };
        })?.workflow ??
          (after.body as {
            conversation_config?: { workflow?: { nodes?: Record<string, unknown> } };
          })?.conversation_config?.workflow)
        : null;
      const nodeKeys = afterWf?.nodes ? Object.keys(afterWf.nodes) : [];
      report.push({
        key: spec.key,
        id,
        nodes: Object.keys(wf.nodes),
        edges: Object.keys(wf.edges),
        verified_nodes: nodeKeys,
        ok: nodeKeys.length >= 2 && nodeKeys.includes("start_node"),
      });
    }
    return json({ ok: true, mode, agents: report });
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
    return json({
      ok: true,
      mode,
      donor: { id: donorId, name: donor.name ?? null },
      prompt_chars: promptCharsBefore,
      tool_ids: toolIdsBefore,
      workspace_agents: listedAgents.map((a) => ({ id: a.agent_id, name: a.name })),
      workspace_tools: toolRows.map((t) => ({ id: t.id, name: t.tool_config?.name })),
      get_reservation_tool_id: legacyToolId,
      configured_fleet: configuredAgents,
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
        // repo spec (a deliberate prompt upgrade).
        const before = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`);
        if (!before.ok) {
          id = null; // deleted in console — fall through to create
        } else {
          const prevPrompt = (before.body as AgentShape).conversation_config?.agent?.prompt ?? {};
          const prevChars = typeof prevPrompt.prompt === "string" ? prevPrompt.prompt.length : 0;
          const agentPatch: Record<string, unknown> = writePrompts
            ? {
              first_message: spec.firstMessage,
              prompt: { prompt: spec.prompt, tool_ids: toolIds },
            }
            : { prompt: { tool_ids: toolIds } };
          const patch = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: {
              name: spec.name,
              conversation_config: { agent: agentPatch },
            },
          });
          if (!patch.ok) return json({ ok: false, error: `agent ${spec.key}: ${patch.error}` }, 502);
          const after = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`);
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
      .from("app_settings")
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

  // ── mode "sync" (legacy): create or update the single get_reservation tool ─
  const toolConfig = desiredToolConfig(envRes.env.url, envRes.env.anonKey, toolSecret);
  let toolId = legacyToolId;
  let toolAction: string;
  if (toolId) {
    const upd = await elFetch(key, `/v1/convai/tools/${encodeURIComponent(toolId)}`, {
      method: "PATCH",
      body: { tool_config: toolConfig },
    });
    if (!upd.ok) return json({ ok: false, error: upd.error }, 502);
    toolAction = "updated";
  } else {
    const crt = await elFetch(key, "/v1/convai/tools", {
      method: "POST",
      body: { tool_config: toolConfig },
    });
    if (!crt.ok) return json({ ok: false, error: crt.error }, 502);
    toolId = ((crt.body as { id?: string } | null)?.id) ?? null;
    if (!toolId) {
      return json({
        ok: false,
        error: `tool created but no id in response: ${JSON.stringify(crt.body).slice(0, 300)}`,
      }, 502);
    }
    toolAction = "created";
  }

  // Attach to the original agent (tool_ids only — the prompt text is never sent).
  let attachAction = "already-attached";
  if (!toolIdsBefore.includes(toolId)) {
    const patch = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(donorId)}`, {
      method: "PATCH",
      body: {
        conversation_config: {
          agent: { prompt: { tool_ids: [...toolIdsBefore, toolId] } },
        },
      },
    });
    if (!patch.ok) return json({ ok: false, error: patch.error }, 502);
    attachAction = "attached";
  }

  // Verify: prompt untouched, tool attached.
  const verify = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(donorId)}`);
  if (!verify.ok) return json({ ok: false, error: verify.error }, 502);
  const after = verify.body as AgentShape;
  const promptAfter = after.conversation_config?.agent?.prompt ?? {};
  const promptCharsAfter = typeof promptAfter.prompt === "string" ? promptAfter.prompt.length : 0;
  const toolIdsAfter: string[] = Array.isArray(promptAfter.tool_ids)
    ? [...promptAfter.tool_ids]
    : [];

  return json({
    ok: true,
    mode,
    agent: { id: donorId, name: after.name ?? null },
    tool: { id: toolId, name: TOOL_NAME, action: toolAction },
    attach: attachAction,
    tool_ids_before: toolIdsBefore,
    tool_ids_after: toolIdsAfter,
    prompt_chars_before: promptCharsBefore,
    prompt_chars_after: promptCharsAfter,
    prompt_untouched: promptCharsBefore === promptCharsAfter,
    attached: toolIdsAfter.includes(toolId),
  });
});
