// Supabase Edge Function — eleven-webhook-post-call
//
// MESITA-3618: how a reservation call ENDS. ElevenLabs posts here when a
// conversation finishes (post_call_transcription) or when an outbound call
// never connected (call_initiation_failure: busy / no-answer). The engine
// (supabase-edgefunc-place-reservation-call) only places calls and saves the
// conversation id; this door finds the ticket and leg by that id — the place
// call (a1), the guest call (a2), the cancellation notice or the reminder —
// and applies the outcome through _shared/reservation-call-outcome.ts, the
// same door the retry cron uses for a call still owed after 10 min.
//
// Auth: verify_jwt = false — ElevenLabs holds no Supabase JWT. The gate is
// ElevenLabs' HMAC: `ElevenLabs-Signature: t=<secs>,v0=<hex>` over
// `${t}.${rawBody}` with ELEVENLABS_WEBHOOK_SECRET; older than 30 min is
// refused. Until Pato saves that secret this door answers 503 and changes
// nothing — the cron's one read per owed call settles everything meanwhile.
//
// Answers: 405 · 503 not_configured · 413 body_too_large · 400
// bad_signature / stale_event / bad JSON · 200 {ok, ignored} for an event
// type or a conversation that owes nothing (inbound a3/a4 calls, audio
// events, a second delivery) · 200 {ok, applied} · 500 on a database failure
// (ElevenLabs retries; the cron is the net either way).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { adminClient, type EFEnv, readEFEnv } from "../_shared/auth.ts";
import {
  applyCallResult,
  cleanConversationId,
  INITIATION_FAILURE,
  readConversation,
  supabaseOutcomeStore,
  verifyElevenSignature,
} from "../_shared/reservation-call-outcome.ts";
import { runInBackground } from "../_shared/background.ts";
import { phoneTail, placesByCallerLine } from "../_shared/agent-tools.ts";
import { callerNumber, placeCallKind, updatePlaceNotes } from "../_shared/place-notes.ts";
import { rowPlaceId } from "../_shared/place-id.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const FN = "eleven-webhook-post-call";
// A transcript of a long call is big; anything past this is not ours.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * Place notes (MESITA-3955): a finished call WITH A PLACE (a1 out; a3 in when
 * the caller's line is a place's, MESITA-4143) rewrites that place's notes
 * from its transcript; a group's shared desk rewrites each of its places'. Runs past the response and
 * never changes the call's outcome; a failure is logged and the notes stay.
 */
async function learnFromPlaceCall(
  admin: SupabaseClient,
  env: EFEnv,
  conversationId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { data: settings } = await admin.from("app_config").select("agents_config").eq("id", 1).maybeSingle();
  const agents = ((settings?.agents_config as Record<string, unknown> | null)?.agents ?? null) as
    | Record<string, { id?: string } | undefined>
    | null;
  const kind = placeCallKind(data.agent_id, {
    a1: agents?.a1?.id?.trim(),
    a3: agents?.a3?.id?.trim(),
    a4: agents?.a4?.id?.trim(),
  });
  if (!kind) return;

  let placeIds: string[] = [];
  if (kind === "a1") {
    const t = await supabaseOutcomeStore(admin, env, FN).findByConversation(conversationId);
    const id = t ? rowPlaceId(t as unknown as Record<string, unknown>) : null;
    placeIds = id ? [id] : [];
  } else {
    // A guest's call to a3 has no place on its line and is skipped here.
    const tail = phoneTail(callerNumber(data));
    placeIds = tail.length >= 10 ? (await placesByCallerLine(admin, tail)).map((p) => p.id) : [];
  }
  if (placeIds.length === 0) {
    console.log(`[${FN}] ${conversationId} notes: no place for this ${kind} call`);
    return;
  }
  for (const placeId of placeIds) {
    const res = await updatePlaceNotes(admin, { placeId, conversationId, transcript: data.transcript });
    console.log(`[${FN}] ${conversationId} notes ${placeId}: ${JSON.stringify(res)}`);
  }
}

serveJson("eleven-webhook-post-call", async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const secret = (Deno.env.get("ELEVENLABS_WEBHOOK_SECRET") ?? "").trim();
  if (!secret) {
    console.error(`[${FN}] not_configured`);
    return json({ ok: false, code: "not_configured", error: "ELEVENLABS_WEBHOOK_SECRET is not set" }, 503);
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json({ ok: false, code: "body_too_large" }, 413);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ ok: false, code: "body_too_large" }, 413);
  }

  const verdict = await verifyElevenSignature(
    raw,
    req.headers.get("elevenlabs-signature"),
    secret,
    Math.floor(Date.now() / 1000),
  );
  if (!verdict.ok) {
    console.error(`[${FN}] ${verdict.code}`);
    return json({ ok: false, code: verdict.code }, 400);
  }

  let event: { type?: unknown; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
  const type = typeof event?.type === "string" ? event.type : "";
  if (type !== "post_call_transcription" && type !== "call_initiation_failure") {
    return json({ ok: true, ignored: "event_type", type });
  }
  const conversationId = cleanConversationId(event.data?.conversation_id);
  if (!conversationId) return json({ ok: true, ignored: "no_conversation_id" });

  const result = type === "call_initiation_failure" ? INITIATION_FAILURE : readConversation(event.data);
  if (!result.final) return json({ ok: true, ignored: "not_final", status: result.status });

  const admin = adminClient(envRes.env);
  try {
    const applied = await applyCallResult(
      supabaseOutcomeStore(admin, envRes.env, FN),
      conversationId,
      result,
    );
    if (type === "post_call_transcription" && event.data) {
      runInBackground(learnFromPlaceCall(admin, envRes.env, conversationId, event.data));
    }
    console.log(`[${FN}] ${conversationId} ${type} → ${JSON.stringify(applied)}`);
    return applied.applied
      ? json({ ok: true, applied: true, leg: applied.leg, state: applied.state })
      : json({ ok: true, ignored: applied.reason });
  } catch (e) {
    console.error(`[${FN}] ${conversationId} apply failed: ${e instanceof Error ? e.message : e}`);
    return json({ ok: false, error: "apply failed" }, 500);
  }
});
