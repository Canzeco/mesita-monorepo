// Supabase Edge Function — supabase-edgefunc-sync-reservationist (internal)
//
// Config-as-code for the ElevenLabs Reservationist FLEET: makes the LIVE
// workspace match Mesita's spec via the ElevenLabs management API — the
// ELEVENLABS_KEY never leaves EF env, so an operator (or an agent session with
// SQL access) can wire everything without touching the console.
//
// Body: { mode?: "inspect" | "fleet" | "prune" | "workflows" | "knowledge"
//          | "phones" }
//
//   inspect    read-only report: donor agent, workspace agents/tools, fleet.
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
// Status: a read-back that fails verification on some agents (workflows,
// knowledge) is a 502 with "N of 4 agents failed verification"; a run whose
// agents_config save failed (fleet, knowledge) is a 500 "config_save: …".
// Both bodies still carry the full report.
//
// Layout: this file authenticates, loads only the context the mode needs and
// dispatches; modes/<mode>.ts holds each mode; el-client.ts the ElevenLabs
// fetch wrapper and shapes.
//
// Deploy: supabase functions deploy supabase-edgefunc-sync-reservationist

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { reservationAgentId, resolveElevenLabsKey } from "../_shared/elevenlabs.ts";
import { type AgentShape, elFetch, type ToolRow } from "./el-client.ts";
import {
  type BaseCtx,
  type ConfiguredAgents,
  type DonorCtx,
  type Mode,
  MODE_NAMES,
  type ModeBody,
  type WorkspaceCtx,
} from "./modes/context.ts";
import { calls } from "./modes/calls.ts";
import { transcript } from "./modes/transcript.ts";
import { phones } from "./modes/phones.ts";
import { prune } from "./modes/prune.ts";
import { workflows } from "./modes/workflows.ts";
import { knowledge } from "./modes/knowledge.ts";
import { inspect } from "./modes/inspect.ts";
import { fleet } from "./modes/fleet.ts";

// Each mode names the context stage it needs; the handler loads exactly that.
type ModeEntry =
  | { stage: "base"; run: (ctx: BaseCtx) => Promise<Response> }
  | { stage: "workspace"; run: (ctx: WorkspaceCtx) => Promise<Response> }
  | { stage: "donor"; run: (ctx: DonorCtx) => Promise<Response> };

const MODES: Record<Mode, ModeEntry> = {
  inspect: { stage: "donor", run: inspect },
  fleet: { stage: "donor", run: fleet },
  prune: { stage: "workspace", run: prune },
  workflows: { stage: "workspace", run: workflows },
  knowledge: { stage: "workspace", run: knowledge },
  // Read-only call observability. WHY: prompts and graphs were being tuned
  // blind — the transcript lives only in ElevenLabs and the key never leaves
  // EF env. `calls` lists recent conversations, `transcript` replays one.
  calls: { stage: "base", run: calls },
  transcript: { stage: "base", run: transcript },
  phones: { stage: "workspace", run: phones },
};

// The tool secret + agent state — read live so a SQL rotation propagates on
// the next sync — then the workspace's tools and agents.
async function loadWorkspace(base: BaseCtx): Promise<WorkspaceCtx | Response> {
  const admin = adminClient(base.env);
  const { data: settings } = await admin
    .from("app_config")
    .select("agents_config")
    .eq("id", 1)
    .maybeSingle();
  const agentsConfig = (settings?.agents_config ?? {}) as Record<string, unknown>;
  const toolSecret = ((agentsConfig.toolSecret as string | undefined) ?? "").trim();
  if (!toolSecret) {
    return json({ ok: false, error: "app_config.agents_config.toolSecret missing" }, 500);
  }
  const configuredAgents = (agentsConfig.agents ?? {}) as ConfiguredAgents;

  const toolsRes = await elFetch(base.key, "/v1/convai/tools");
  if (!toolsRes.ok) return json({ ok: false, error: toolsRes.error }, 502);
  const toolRows: ToolRow[] = (toolsRes.body as { tools?: ToolRow[] } | null)?.tools ?? [];
  const toolIdByName = new Map<string, string>();
  for (const t of toolRows) {
    if (t.id && t.tool_config?.name) toolIdByName.set(t.tool_config.name, t.id);
  }
  const listResEarly = await elFetch(base.key, "/v1/convai/agents?page_size=100");
  if (!listResEarly.ok) return json({ ok: false, error: listResEarly.error }, 502);
  const listedAgents = (listResEarly.body as {
    agents?: Array<{ agent_id?: string; name?: string }>;
  } | null)?.agents ?? [];

  return {
    ...base,
    agentsConfig,
    toolSecret,
    configuredAgents,
    toolRows,
    toolIdByName,
    listedAgents,
    saveAgentsConfig: async (next) => {
      const { error } = await admin
        .from("app_config")
        .update({ agents_config: next })
        .eq("id", 1);
      return { error };
    },
  };
}

// The donor agent (a1) + its prompt shape. Donor = a1 from live fleet config;
// env / DEFAULT only for brand-new workspaces.
async function loadDonor(ws: WorkspaceCtx): Promise<DonorCtx | Response> {
  const donorId = ws.configuredAgents.a1?.id?.trim() || reservationAgentId();
  const agentRes = await elFetch(ws.key, `/v1/convai/agents/${encodeURIComponent(donorId)}`);
  if (!agentRes.ok) return json({ ok: false, error: agentRes.error }, 502);
  const donor = agentRes.body as AgentShape;
  const donorCc = donor.conversation_config ?? {};
  const donorPrompt = donorCc.agent?.prompt ?? {};
  const promptCharsBefore = typeof donorPrompt.prompt === "string" ? donorPrompt.prompt.length : 0;
  const toolIdsBefore: string[] = Array.isArray(donorPrompt.tool_ids)
    ? [...donorPrompt.tool_ids]
    : [];
  return { ...ws, donorId, donor, donorCc, donorPrompt, promptCharsBefore, toolIdsBefore };
}

serveJson("supabase-edgefunc-sync-reservationist", async (req) => {
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

  const body = await readJsonOr<ModeBody>(req, {});
  const rawMode = typeof body.mode === "string" ? body.mode : "inspect";
  if (!(MODE_NAMES as readonly string[]).includes(rawMode)) {
    return json({
      ok: false,
      error: `unknown mode ${JSON.stringify(rawMode)}; use ${MODE_NAMES.join("|")}`,
    }, 400);
  }
  const mode = rawMode as Mode;
  const entry = MODES[mode];

  const base: BaseCtx = { key, mode, body, env: envRes.env };
  if (entry.stage === "base") return entry.run(base);
  const ws = await loadWorkspace(base);
  if (ws instanceof Response) return ws;
  if (entry.stage === "workspace") return entry.run(ws);
  const donor = await loadDonor(ws);
  if (donor instanceof Response) return donor;
  return entry.run(donor);
});
