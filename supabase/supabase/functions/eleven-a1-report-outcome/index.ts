// Supabase Edge Function — eleven-a1-report-outcome (vendor caller)
//
// Caller = eleven-a1: the c2b OUTBOUND Booker — the agent leg that calls the
// place on the guest's behalf. Mid-call it reports what the place actually
// said, replacing inference from ElevenLabs' coarse call_successful flag:
//
//   { reference_code,
//     verdict: "confirmed" | "counter_offer" | "declined"
//            | "unreachable"   // never reached anyone who can book: voicemail,
//                              // IVR dead-end, "call back later"  → RETRYABLE
//            | "wrong_number", // the line is not this place           → TERMINAL
//     alternatives?: string[],   // speakable options: "afuera a las 10"
//     note?: string }
//
// unreachable vs declined matters: declined is the place SAYING NO (terminal,
// real signal); unreachable is us never getting to ask (worth another attempt).
// wrong_number must never retry — redialling just rings a stranger again.
//
// Writes reported_verdict / alternatives / outcome_note onto the ticket. It
// deliberately does NOT flip state or fire the confirmation leg — the engine
// owns those transitions; the negotiation loop (follow-up) consumes what this
// records. Auth: anon-key bearer + x-agent-secret (see _shared/agent-tools.ts).
//
// on_reservation_failed emitter (MESITA-1189): a "wrong_number" verdict is the
// ONE terminal, unambiguous signal that the stored channel is stale — declined
// and counter_offer mean the place answered (channel works), unreachable is
// documented and implemented as retryable (voicemail, IVR, "call back later").
// Firing on those would burn the cooldown window on a channel that isn't
// actually broken. The trigger buys only the Google refetch, which runs past
// the response (_shared/google-refetch.ts, MESITA-2420): the agent is mid-call
// and does not wait on Google. Best-effort: a refetch failure never fails the
// caller's outcome report.
//
// Deploy: supabase functions deploy eleven-a1-report-outcome

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { cleanNote, requireAgentSecret, ticketByCode } from "../_shared/agent-tools.ts";
import { normalizeAlternatives } from "../_shared/reservation-alternatives.ts";
import { writeReservation } from "../_shared/reservation-doc.ts";
import { loadEnrichmentTriggers, subprocessesFor } from "../_shared/enrich-triggers.ts";
import { refetchGoogleAfterWrongNumber } from "../_shared/google-refetch.ts";
import { runInBackground } from "../_shared/background.ts";

const VERDICTS = [
  "confirmed",
  "counter_offer",
  "declined",
  "unreachable",
  "wrong_number",
] as const;

serveJson("eleven-a1-report-outcome", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

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
    run_id?: unknown;
  }>(req, {});

  const verdict = typeof body.verdict === "string" ? body.verdict.trim() : "";
  if (!(VERDICTS as readonly string[]).includes(verdict)) {
    return json({
      ok: false,
      error: `verdict must be one of ${VERDICTS.join(" | ")}`,
    }, 400);
  }
  const ticket = await ticketByCode(admin, body.reference_code);
  if (!ticket) return json({ ok: false, error: "reservation not found for that reference_code" }, 404);
  // Stale-run guard (eng-review 2026-08-04): run_id rides every outbound call
  // as a bound dynamic variable. A mismatch means this CALL belongs to an
  // orphaned run (the guest rescheduled/cancelled mid-call) — ignore the
  // write, tell the agent to wrap up gracefully.
  const callRunId = typeof body.run_id === "string" ? body.run_id.trim() : "";
  if (callRunId && ticket.run_id && callRunId !== ticket.run_id) {
    return json({
      ok: true,
      stale_run: true,
      ignored: true,
      say: "Esa reservación acaba de cambiar desde la app; Mesita le confirma los nuevos datos por ahí.",
    });
  }


  // Structured {time,date?,note?} entries — see _shared/reservation-alternatives.ts.
  // Storing prose made every guest pick look like a brand-new proposal and cost
  // the place a second call. normalizeAlternatives still accepts the old string
  // form, so an agent build that hasn't picked up the new schema keeps working.
  const alternatives = normalizeAlternatives(body.alternatives).slice(0, 5);

  const write = await writeReservation(admin, {
    mode: "update",
    id: ticket.id,
    patch: {
      reported_verdict: verdict as
        | "confirmed"
        | "counter_offer"
        | "declined"
        | "unreachable"
        | "wrong_number",
      alternatives,
      outcome_note: cleanNote(body.note) || null,
    },
  });
  if (!write.ok) return json({ ok: false, error: write.error }, 500);

  if (verdict === "wrong_number") {
    runInBackground(emitOnReservationFailed(admin, ticket.project_id));
  }

  return json({ ok: true, recorded: { reference_code: ticket.reference_code, verdict, alternatives } });
});

// Best-effort — never lets an enrichment-side failure fail the outcome report
// the vendor agent is waiting on mid-call.
async function emitOnReservationFailed(
  admin: ReturnType<typeof adminClient>,
  projectId: string,
): Promise<void> {
  try {
    const triggers = await loadEnrichmentTriggers(admin);
    const subprocesses = subprocessesFor(triggers, "on_reservation_failed");
    if (subprocesses.length === 0) return; // trigger disabled in the matrix

    const result = await refetchGoogleAfterWrongNumber(admin, projectId, {
      seededBy: "eleven-a1-report-outcome",
      subprocesses,
      cooldownHours: triggers.on_reservation_failed.cooldownHours,
    });
    if (!result.ran && result.reason === "error") {
      console.error(`[eleven-a1-report-outcome] Google refetch: ${result.error ?? "failed"}`);
    }
  } catch (err) {
    // Enrichment is a side effect of reporting a wrong number, never a
    // condition of it — log and let the outcome write stand.
    console.error(
      `[eleven-a1-report-outcome] Google refetch: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
