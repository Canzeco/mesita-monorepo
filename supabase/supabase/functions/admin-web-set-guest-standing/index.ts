// Supabase Edge Function — admin-web-set-guest-standing
//
// Manage › Guests (MESITA-2550, MESITA-2553). Sets a guest's Class (regular or
// VIP, through a partner; never sold) and Plan (free or premium), independently,
// and the operator-only note on where a VIP came from, and for a VIP the
// partner it came through and its last day (MESITA-2556; recorded, never
// enforced, and no rate rides on either). One call to the
// admin_set_guest_standing RPC does the write: it stamps who set the class
// and when only when the class actually changes, so two operators can never
// record the wrong one. Super-admin only.
//
// Errors are { ok: false, code, error } with a stable code and the fix:
//   400 stale_client · invalid_consumer · invalid_guest_class · invalid_plan ·
//       invalid_note · note_too_long · invalid_partner · invalid_vip_until ·
//       vip_until_past · not_vip · unknown_partner · nothing_to_set
//   404 guest_not_found · 409 account_closed · not_vip · 500 update_failed

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

  const written = await admin.rpc("admin_set_guest_standing", {
    p_consumer: consumerId,
    p_guest_class: patch.guestClass ?? null,
    p_plan: patch.plan ?? null,
    p_note: patch.guestClassNote ?? null,
    p_note_set: "guestClassNote" in patch,
    p_partner: patch.vipPartnerId ?? null,
    p_partner_set: "vipPartnerId" in patch,
    p_vip_until: patch.vipUntil ?? null,
    p_vip_until_set: "vipUntil" in patch,
    p_actor: authRes.user.id,
  });
  if (written.error?.code === "23503") {
    return json({ ok: false, code: "unknown_partner", error: "No such partner. Reload the page." }, 400);
  }
  if (written.error?.code === "23514" && /vip_fields/.test(written.error.message)) {
    return json({
      ok: false,
      code: "not_vip",
      error: "Only a VIP has a partner or a last day. Set the class to VIP first.",
    }, 409);
  }
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
    partnerChanged: "vipPartnerId" in patch,
    vipUntilChanged: "vipUntil" in patch,
  }));

  const me = authRes.user.emailLower;
  return json({
    ok: true,
    guest: toGuestRow(row, (id) => (id === authRes.user.id ? me : null)),
  });
});
