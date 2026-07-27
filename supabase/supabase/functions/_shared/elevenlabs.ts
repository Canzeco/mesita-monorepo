// Shared ElevenLabs Conversational AI ("Convai" / ElevenAgents) client for the
// Reservationist. The agent itself is created + tuned in ElevenLabs; these helpers
// let our EFs resolve the agent's imported Twilio number and place an outbound
// reservation call with per-call dynamic variables.
//
// Auth: header `xi-api-key: <ELEVENLABS_KEY>` on every call (plain fetch).
// Only ELEVENLABS_KEY is strictly required — the agent id and the outbound line
// default to the Reservationist wiring and are env-overridable.

const EL_BASE = "https://api.elevenlabs.io";

// Fallback agent = eleven-a1 (es-mx) · c2b outbound booker. The old single
// donor ("XD" / agent_2201kxsktw0me9rb2kdtqerrgzha) was deleted — the fleet
// is the only agents in the workspace. The outbound Twilio line is shared.
const DEFAULT_AGENT_ID = "agent_0101kyjcfjecfk69ty20rmcf12gn";
const DEFAULT_FROM_NUMBER = "+16282960710";

export function elevenLabsKey(): string | null {
  // Canonical name ELEVENLABS_KEY; ELEVEN_KEY accepted (the name the secret was
  // first created under in the dashboard).
  const k = Deno.env.get("ELEVENLABS_KEY") ?? Deno.env.get("ELEVEN_KEY");
  return k && k.trim() ? k.trim() : null;
}

export function reservationAgentId(): string {
  return Deno.env.get("ELEVENLABS_AGENT_ID")?.trim() || DEFAULT_AGENT_ID;
}

export function reservationFromNumber(): string {
  return Deno.env.get("ELEVENLABS_FROM_NUMBER")?.trim() || DEFAULT_FROM_NUMBER;
}

function headers(key: string): HeadersInit {
  return { "xi-api-key": key, "Content-Type": "application/json" };
}

// Digits (+ leading +) only, so "+1 (628) 296-0710" and "+16282960710" compare equal.
function normalizeNumber(s: string): string {
  return s.replace(/[^\d+]/g, "");
}

/**
 * Resolve the ElevenLabs `phone_number_id` for our imported outbound Twilio line.
 * GET /v1/convai/phone-numbers returns an array; we match on the E.164 number.
 */
export async function resolvePhoneNumberId(
  key: string,
  fromNumber: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let r: Response;
  try {
    r = await fetch(`${EL_BASE}/v1/convai/phone-numbers`, { headers: headers(key) });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "phone-numbers fetch failed" };
  }
  if (!r.ok) return { ok: false, error: `phone-numbers HTTP ${r.status}` };
  let list: unknown;
  try {
    list = await r.json();
  } catch {
    return { ok: false, error: "phone-numbers returned non-JSON" };
  }
  if (!Array.isArray(list)) return { ok: false, error: "phone-numbers not an array" };

  const target = normalizeNumber(fromNumber);
  for (const item of list) {
    const o = item as Record<string, unknown>;
    if (
      typeof o.phone_number === "string" &&
      normalizeNumber(o.phone_number) === target &&
      typeof o.phone_number_id === "string"
    ) {
      return { ok: true, id: o.phone_number_id };
    }
  }
  return {
    ok: false,
    error: `no imported ElevenLabs number matches ${fromNumber} — import it in the ElevenLabs console first`,
  };
}

export type ConversationStatusResult =
  | {
    ok: true;
    status: string;
    callDurationSecs: number | null;
    /**
     * The post-call verdict, once `status` is done: analysis.call_successful
     * ("success" | "failure" | "unknown"). null until the analysis exists —
     * "success" is what the intent loop reads as "the venue CONFIRMED".
     */
    callSuccessful: string | null;
  }
  | { ok: false; error: string };

/**
 * Read a Convai conversation's lifecycle status — how the playground's intent
 * loop learns whether an outbound call was answered. GET
 * /v1/convai/conversations/{id}; `status` walks initiated → in-progress →
 * processing → done, or lands on failed (which is what an unanswered/declined
 * Twilio leg becomes).
 */
export async function getConversationStatus(
  key: string,
  conversationId: string,
): Promise<ConversationStatusResult> {
  let r: Response;
  try {
    r = await fetch(
      `${EL_BASE}/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
      { headers: headers(key) },
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "conversation fetch failed" };
  }
  if (!r.ok) return { ok: false, error: `conversation HTTP ${r.status}` };
  let body: unknown;
  try {
    body = await r.json();
  } catch {
    return { ok: false, error: "conversation returned non-JSON" };
  }
  const b = body as Record<string, unknown>;
  const meta = (b.metadata ?? null) as Record<string, unknown> | null;
  const duration = meta && typeof meta.call_duration_secs === "number"
    ? meta.call_duration_secs
    : null;
  const analysis = (b.analysis ?? null) as Record<string, unknown> | null;
  return {
    ok: true,
    status: typeof b.status === "string" ? b.status : "unknown",
    callDurationSecs: duration,
    callSuccessful: analysis && typeof analysis.call_successful === "string"
      ? analysis.call_successful
      : null,
  };
}

export type OutboundCallResult =
  | {
    ok: true;
    conversationId: string | null;
    callSid: string | null;
    /** Whether the per-call prompt/first-message override actually rode along. */
    usedOverrides: boolean;
  }
  | { ok: false; error: string };

/** Per-call agent override — the per-leg brief (see _shared/reservation-legs.ts). */
export type CallOverrides = {
  prompt?: string;
  firstMessage?: string;
  language?: string;
};

// Per-call overrides are HARD-GATED behind ELEVENLABS_ALLOW_OVERRIDES, default
// OFF. A non-whitelisted override is NOT rejected at placement — the POST
// succeeds, the Twilio leg connects, and ElevenLabs kills the conversation at
// initiation, i.e. the callee hears an immediate hang-up (observed live
// 2026-07-27, MESITA-757). So a placement-time fallback can never catch it.
// Flip the env on ONLY after enabling prompt + first-message + language
// overrides in the agent's ElevenLabs Security tab. Until then calls go
// vars-only — call_direction still rides along for a branching console prompt.
function overridesAllowed(): boolean {
  const v = (Deno.env.get("ELEVENLABS_ALLOW_OVERRIDES") ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Place an outbound Convai call over the agent's Twilio number.
 * POST /v1/convai/twilio/outbound-call. Returns quickly with the conversation_id
 * (the join key for the post-call webhook); it does NOT wait for the call to end.
 *
 * `overrides` sends a per-call conversation_config_override (prompt / first
 * message / language). Each overridden field must be whitelisted in the agent's
 * ElevenLabs Security tab; if the placement is REJECTED with overrides on, we
 * retry once without them (the dynamic variables still carry call_direction,
 * so a branching console prompt keeps working) and report usedOverrides=false.
 */
export async function placeOutboundCall(
  key: string,
  input: {
    agentId: string;
    agentPhoneNumberId: string;
    toNumber: string;
    dynamicVariables: Record<string, string | number | boolean>;
    overrides?: CallOverrides;
  },
): Promise<OutboundCallResult> {
  const attempt = async (withOverrides: boolean): Promise<OutboundCallResult> => {
    const initData: Record<string, unknown> = {
      dynamic_variables: input.dynamicVariables,
    };
    if (withOverrides && input.overrides) {
      const agent: Record<string, unknown> = {};
      if (input.overrides.prompt) agent.prompt = { prompt: input.overrides.prompt };
      if (input.overrides.firstMessage) agent.first_message = input.overrides.firstMessage;
      if (input.overrides.language) agent.language = input.overrides.language;
      if (Object.keys(agent).length) {
        initData.conversation_config_override = { agent };
      }
    }
    let r: Response;
    try {
      r = await fetch(`${EL_BASE}/v1/convai/twilio/outbound-call`, {
        method: "POST",
        headers: headers(key),
        body: JSON.stringify({
          agent_id: input.agentId,
          agent_phone_number_id: input.agentPhoneNumberId,
          to_number: input.toNumber,
          conversation_initiation_client_data: initData,
        }),
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "outbound-call fetch failed" };
    }
    let body: unknown;
    try {
      body = await r.json();
    } catch {
      return { ok: false, error: `outbound-call returned non-JSON (HTTP ${r.status})` };
    }
    if (!r.ok) {
      const detail = (body as { detail?: { message?: string } | string } | null)?.detail;
      const msg = typeof detail === "string"
        ? detail
        : detail?.message ?? `outbound-call HTTP ${r.status}`;
      return { ok: false, error: msg };
    }
    const b = body as Record<string, unknown>;
    return {
      ok: true,
      conversationId: typeof b.conversation_id === "string" ? b.conversation_id : null,
      callSid: typeof b.callSid === "string" ? b.callSid : null,
      usedOverrides: withOverrides && !!input.overrides,
    };
  };

  const wantOverrides = !!input.overrides && overridesAllowed();
  const first = await attempt(wantOverrides);
  if (first.ok || !wantOverrides) return first;
  // Placement rejected with overrides on — retry vars-only (belt & braces; the
  // dangerous failure mode is the init-time kill documented above).
  return await attempt(false);
}
