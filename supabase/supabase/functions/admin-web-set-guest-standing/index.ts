// Supabase Edge Function — admin-web-set-guest-standing
//
// Manage › Guests (MESITA-2550, MESITA-2553). Sets a guest's Class (regular or
// VIP, through a partner; never sold) and Plan (free or premium), independently,
// and the operator-only note on where a VIP came from. One call to the
// admin_set_guest_standing RPC does the write: it stamps who set the class
// and when only when the class actually changes, so two operators can never
// record the wrong one. Super-admin only. It also sets one guest's monthly
// reservation cap (MESITA-2555; null = the plan's cap, _shared/reservation-cap.ts)
// through admin_set_guest_reservation_cap, written first so the standing RPC's
// row comes back with it.
//
// Errors are { ok: false, code, error } with a stable code and the fix:
//   400 stale_client · invalid_consumer · invalid_guest_class · invalid_plan ·
//       invalid_note · note_too_long · invalid_reservation_cap · nothing_to_set
//   404 guest_not_found · 409 account_closed · 500 update_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { readStandingBody, type RawGuest, toGuestRow } from "../_shared/guest-standing.ts";

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

  const bodyRes = await readJson<unknown>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readStandingBody(bodyRes.body);
  if (!parsed.ok) {
    return json({ ok: false, code: parsed.code, error: parsed.error }, parsed.status);
  }
  const { consumerId, patch } = parsed;

  if ("reservationCapOverride" in patch) {
    // A closed account is skipped here as in the RPC; the read below reports it.
    const capWrite = await admin.rpc("admin_set_guest_reservation_cap", {
      p_consumer: consumerId,
      p_cap: patch.reservationCapOverride ?? null,
    });
    if (capWrite.error) {
      return json(
        { ok: false, code: "update_failed", error: `update_failed: ${capWrite.error.message}` },
        500,
      );
    }
  }

  // With only the cap in the patch every argument is null: the RPC changes
  // nothing and returns the row.
  const written = await admin.rpc("admin_set_guest_standing", {
    p_consumer: consumerId,
    p_guest_class: patch.guestClass ?? null,
    p_plan: patch.plan ?? null,
    p_note: patch.guestClassNote ?? null,
    p_note_set: "guestClassNote" in patch,
    p_actor: authRes.user.id,
  });
  if (written.error) {
    return json(
      { ok: false, code: "update_failed", error: `update_failed: ${written.error.message}` },
      500,
    );
  }

  const row = (Array.isArray(written.data) ? written.data[0] : written.data) as RawGuest | null;
  if (!row) {
    // No row back: the id is unknown, or the account is closed (the RPC skips
    // closed accounts). Tell them apart with one read.
    const existing = await admin
      .from("consumers")
      .select("id, deleted_at")
      .eq("id", consumerId)
      .maybeSingle();
    if (existing.error) {
      return json(
        { ok: false, code: "update_failed", error: `read_failed: ${existing.error.message}` },
        500,
      );
    }
    if (existing.data?.deleted_at) {
      return json({ ok: false, code: "account_closed", error: "This account is closed" }, 409);
    }
    return json({ ok: false, code: "guest_not_found", error: "No such guest" }, 404);
  }

  console.log("guest_standing_set", JSON.stringify({
    consumerId,
    guestClass: patch.guestClass ?? null,
    plan: patch.plan ?? null,
    noteChanged: "guestClassNote" in patch,
    reservationCapOverride: "reservationCapOverride" in patch
      ? patch.reservationCapOverride ?? null
      : undefined,
  }));

  const me = authRes.user.emailLower;
  return json({
    ok: true,
    guest: toGuestRow(row, (id) => (id === authRes.user.id ? me : null)),
  });
});
