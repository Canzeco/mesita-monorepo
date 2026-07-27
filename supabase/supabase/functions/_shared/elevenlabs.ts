// Shared ElevenLabs Conversational AI ("Convai" / ElevenAgents) client for the
// Reservationist. The agent itself is created + tuned in ElevenLabs; these helpers
// let our EFs resolve the agent's imported Twilio number and place an outbound
// reservation call with per-call dynamic variables.
//
// Auth: header `xi-api-key: <ELEVENLABS_KEY>` on every call (plain fetch).
// Only ELEVENLABS_KEY is strictly required — the agent id and the outbound line
// default to the Reservationist wiring and are env-overridable.

const EL_BASE = "https://api.elevenlabs.io";

// The "Mesita Reservationist (Spanish MX)" agent + the "Mesita Reservations
// (Businesses)" outbound line, both in the ElevenAgents workspace.
export const DEFAULT_AGENT_ID = "agent_2201kxsktw0me9rb2kdtqerrgzha";
export const DEFAULT_FROM_NUMBER = "+16282960710";

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
  | { ok: true; status: string; callDurationSecs: number | null }
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
  return {
    ok: true,
    status: typeof b.status === "string" ? b.status : "unknown",
    callDurationSecs: duration,
  };
}

export type OutboundCallResult =
  | { ok: true; conversationId: string | null; callSid: string | null }
  | { ok: false; error: string };

/**
 * Place an outbound Convai call over the agent's Twilio number.
 * POST /v1/convai/twilio/outbound-call. Returns quickly with the conversation_id
 * (the join key for the post-call webhook); it does NOT wait for the call to end.
 */
export async function placeOutboundCall(
  key: string,
  input: {
    agentId: string;
    agentPhoneNumberId: string;
    toNumber: string;
    dynamicVariables: Record<string, string | number | boolean>;
  },
): Promise<OutboundCallResult> {
  let r: Response;
  try {
    r = await fetch(`${EL_BASE}/v1/convai/twilio/outbound-call`, {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({
        agent_id: input.agentId,
        agent_phone_number_id: input.agentPhoneNumberId,
        to_number: input.toNumber,
        conversation_initiation_client_data: {
          dynamic_variables: input.dynamicVariables,
        },
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
  };
}
