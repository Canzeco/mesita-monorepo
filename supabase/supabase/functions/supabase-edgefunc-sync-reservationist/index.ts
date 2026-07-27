// Supabase Edge Function — supabase-edgefunc-sync-reservationist (internal / artificial caller)
//
// Config-as-code for the ElevenLabs Reservationist: makes the LIVE agent match
// Mesita's tool surface via the ElevenLabs management API — the ELEVENLABS_KEY
// never leaves EF env, so an operator (or an agent session with SQL access)
// can wire the agent without touching the console.
//
// Today "the tool surface" is one tool: `get_reservation`, the webhook server
// tool pointing at eleven-agent-get-reservation, carrying this project's anon
// key (gateway lock) and the CURRENT x-agent-secret read live from
// app_settings.agents_config (secret lock). Idempotent — rerun after rotating
// the secret or changing the tool definition here and the live agent follows.
//
// This EF NEVER writes the agent's prompt, first message, voice, or any other
// console-authored field — it PATCHes exactly conversation_config.agent.prompt
// .tool_ids (the workspace-tool attachment list) and verifies afterwards that
// the prompt text length is unchanged.
//
// Body: { mode?: "inspect" | "sync" } — inspect is a read-only report of the
// live agent + workspace tools; sync (default) creates/updates + attaches.
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

// The desired webhook tool definition, built from live env + DB state.
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

type AgentShape = {
  name?: string;
  conversation_config?: {
    agent?: {
      prompt?: Record<string, unknown> & { prompt?: string; tool_ids?: string[] };
    };
  };
};

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
  const agentId = reservationAgentId();

  const body = await readJsonOr<{ mode?: unknown }>(req, {});
  const mode = body.mode === "inspect" ? "inspect" : "sync";

  // The tool's secret header value — read live so a SQL rotation propagates on
  // the next sync.
  const admin = adminClient(envRes.env);
  const { data: settings } = await admin
    .from("app_settings")
    .select("agents_config")
    .eq("id", 1)
    .maybeSingle();
  const toolSecret =
    ((settings?.agents_config as Record<string, unknown> | null)?.toolSecret as
      | string
      | undefined)?.trim() ?? "";
  if (!toolSecret) {
    return json({ ok: false, error: "app_settings.agents_config.toolSecret missing" }, 500);
  }

  // ── Read the live agent + workspace tools ──────────────────────────────────
  const agentRes = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(agentId)}`);
  if (!agentRes.ok) return json({ ok: false, error: agentRes.error }, 502);
  const agent = agentRes.body as AgentShape;
  const prompt = agent.conversation_config?.agent?.prompt ?? {};
  const promptCharsBefore = typeof prompt.prompt === "string" ? prompt.prompt.length : 0;
  const toolIdsBefore: string[] = Array.isArray(prompt.tool_ids) ? [...prompt.tool_ids] : [];

  const toolsRes = await elFetch(key, "/v1/convai/tools");
  if (!toolsRes.ok) return json({ ok: false, error: toolsRes.error }, 502);
  type ToolRow = { id?: string; tool_config?: { name?: string; type?: string } };
  const toolRows: ToolRow[] =
    (toolsRes.body as { tools?: ToolRow[] } | null)?.tools ?? [];
  const existing = toolRows.find((t) => t.tool_config?.name === TOOL_NAME) ?? null;

  if (mode === "inspect") {
    return json({
      ok: true,
      mode,
      agent: { id: agentId, name: agent.name ?? null },
      prompt_chars: promptCharsBefore,
      tool_ids: toolIdsBefore,
      workspace_tools: toolRows.map((t) => ({ id: t.id, name: t.tool_config?.name })),
      get_reservation_tool_id: existing?.id ?? null,
    });
  }

  // ── Sync: create or update the workspace tool ──────────────────────────────
  const toolConfig = desiredToolConfig(envRes.env.url, envRes.env.anonKey, toolSecret);
  let toolId = existing?.id ?? null;
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

  // ── Attach to the agent (tool_ids only — the prompt text is never sent) ────
  let attachAction = "already-attached";
  if (!toolIdsBefore.includes(toolId)) {
    const patch = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(agentId)}`, {
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

  // ── Verify: prompt untouched, tool attached ────────────────────────────────
  const verify = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(agentId)}`);
  if (!verify.ok) return json({ ok: false, error: verify.error }, 502);
  const after = verify.body as AgentShape;
  const promptAfter = after.conversation_config?.agent?.prompt ?? {};
  const promptCharsAfter = typeof promptAfter.prompt === "string"
    ? promptAfter.prompt.length
    : 0;
  const toolIdsAfter: string[] = Array.isArray(promptAfter.tool_ids)
    ? [...promptAfter.tool_ids]
    : [];

  return json({
    ok: true,
    mode,
    agent: { id: agentId, name: after.name ?? null },
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
