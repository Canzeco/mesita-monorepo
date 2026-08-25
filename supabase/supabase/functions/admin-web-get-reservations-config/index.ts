// Supabase Edge Function — admin-web-get-reservations-config
//
// Naming: caller-verb-words. Caller = admin, verb = get, words = reservations-config.
//
// Returns the reservation-endpoint policy from the public.app_config singleton
// for the admin console's Reservations Config page: the ordered channel priority
// (phone only — MESITA-842; voice-reachable), the parked channels, and whether
// an operator's hand-picked channel survives a re-enrich. See
// 20260715120000_reservations_config.sql + 20260805105000_reservations_phone_only.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, jsonError, jsonOk, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const { data, error } = await admin
    .from("app_config")
    .select("reservations_config, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return jsonError(`reservations_config_read: ${error.message}`, 500);
  }
  if (!data) {
    return jsonError("app_config missing", 500);
  }

  // ── Needs attention (eng-review 2026-08-04) ────────────────────────────────
  // The protocol exists because states nobody reads stop silently — this feed
  // is the reader. Every terminal-bad state a human must act on:
  //   · notice_state=failed      cancel notice never delivered (held table /
  //                              uninformed guest)
  //   · attempts_state=error     booking run died (platform outage persisted,
  //                              no number, crash)
  //   · callback_state=failed    guest leg could not be placed at all
  //   · confirmed-but-unheard    venue said yes, the guest ladder ran dry and
  //                              nobody picked up — the table exists and its
  //                              owner doesn't know
  const { data: attention } = await admin
    .from("reservation_tickets")
    .select(
      "id, reference_code, status, reserved_at, last_call_status, notice_state, notice_kind, attempts_state, callback_state, reminder_state, consumer_confirmed_at, is_test",
    )
    .or(
      "notice_state.eq.failed," +
        "attempts_state.eq.error," +
        "callback_state.eq.failed," +
        "reminder_state.eq.failed," +
        "and(status.eq.confirmed,consumer_confirmed_at.is.null,callback_state.in.(no_answer,unknown),callback_next_attempt_at.is.null)",
    )
    .order("reserved_at", { ascending: false })
    .limit(30);

  return jsonOk({ config: data.reservations_config,
    updatedAt: data.updated_at,
    needs_attention: attention ?? [], });
});
