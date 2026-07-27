// Supabase Edge Function — eleven-a1-report-outcome (vendor caller)
//
// Caller = eleven-a1: the c2b OUTBOUND Booker — the agent leg that calls the
// venue on the guest's behalf. Mid-call it reports what the venue actually
// said, replacing inference from ElevenLabs' coarse call_successful flag:
//
//   { reference_code, verdict: "confirmed" | "counter_offer" | "declined",
//     alternatives?: string[],   // speakable options: "afuera a las 10"
//     note?: string }
//
// Writes reported_verdict / alternatives / outcome_note onto the ticket. It
// deliberately does NOT flip status or fire the confirmation leg — the engine
// owns those transitions; the negotiation loop (follow-up) consumes what this
// records. Auth: anon-key bearer + x-agent-secret (see _shared/agent-tools.ts).
//
// Deploy: supabase functions deploy eleven-a1-report-outcome

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { cleanNote, requireAgentSecret, ticketByCode } from "../_shared/agent-tools.ts";

const VERDICTS = ["confirmed", "counter_offer", "declined"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const admin = adminClient(envRes.env);
  const denied = await requireAgentSecret(req, admin);
  if (denied) return denied;

  const body = await readJsonOr<{
    reference_code?: unknown;
    verdict?: unknown;
    alternatives?: unknown;
    note?: unknown;
  }>(req, {});

  const verdict = typeof body.verdict === "string" ? body.verdict.trim() : "";
  if (!(VERDICTS as readonly string[]).includes(verdict)) {
    return json({ ok: false, error: "verdict must be confirmed | counter_offer | declined" }, 400);
  }
  const ticket = await ticketByCode(admin, body.reference_code);
  if (!ticket) return json({ ok: false, error: "reservation not found for that reference_code" }, 404);

  const alternatives = Array.isArray(body.alternatives)
    ? body.alternatives
      .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
      .map((a) => a.trim().slice(0, 120))
      .slice(0, 5)
    : [];

  const { error } = await admin
    .from("reservations")
    .update({
      reported_verdict: verdict,
      alternatives,
      outcome_note: cleanNote(body.note) || null,
    })
    .eq("id", ticket.id);
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, recorded: { reference_code: ticket.reference_code, verdict, alternatives } });
});
