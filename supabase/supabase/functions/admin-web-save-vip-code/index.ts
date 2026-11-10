// Supabase Edge Function — admin-web-save-vip-code
//
// Admin › Guests › Invitation codes (MESITA-3540). Issues a VIP invitation
// code, or revokes an unused one. Super-admin only. A guest uses a code once
// on Me › Class; consumer_redeem_vip_invitation checks it.
//
// Body: { label?, vipPartnerId? } — issue. Twelve random digits; only their
//         SHA-256 and the last four are stored, so the code ("1234 5678 9012")
//         is in this answer (issuedCode) and never again. label (at most 80) says who it
//         is for; vipPartnerId is the partner the guest's VIP then comes
//         through.
//       | { id, revoke: true } — revoke an unused code.
// Success: { ok: true, issuedCode?, issuedId?, codes } — `codes` is the list,
// newest first (admin-web-list-guests returns the same list); null when that
// read failed after an issue (the code is still in the answer).
//
// Errors are { ok: false, code, error }:
//   400 invalid_label · label_too_long · invalid_partner · invalid_code_id
//   404 unknown_partner · code_not_found
//   409 code_not_unused (used or already revoked) · 500 save_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import {
  formatVipCode,
  hashVipCode,
  loadVipCodes,
  newVipCode,
  readSaveVipCodeBody,
} from "../_shared/vip-codes.ts";

serveJson("admin-web-save-vip-code", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<unknown>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readSaveVipCodeBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error }, parsed.status);

  let issued: { id: string; code: string } | null = null;

  if (parsed.action === "revoke") {
    const { data, error } = await admin
      .from("vip_invitation_codes")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", parsed.id)
      .is("used_at", null)
      .is("revoked_at", null)
      .select("id");
    if (error) return json({ ok: false, code: "save_failed", error: `save_failed: ${error.message}` }, 500);
    if ((data ?? []).length === 0) {
      const found = await admin.from("vip_invitation_codes").select("id").eq("id", parsed.id).maybeSingle();
      if (found.error) {
        return json({ ok: false, code: "save_failed", error: `save_failed: ${found.error.message}` }, 500);
      }
      return found.data
        ? json({ ok: false, code: "code_not_unused", error: "That code was already used or revoked." }, 409)
        : json({ ok: false, code: "code_not_found", error: "No such code" }, 404);
    }
    console.log("vip_code_revoked", JSON.stringify({ id: parsed.id }));
  } else {
    if (parsed.vipPartnerId) {
      const p = await admin.from("vip_partners").select("id").eq("id", parsed.vipPartnerId).maybeSingle();
      if (p.error) return json({ ok: false, code: "save_failed", error: `save_failed: ${p.error.message}` }, 500);
      if (!p.data) return json({ ok: false, code: "unknown_partner", error: "No such partner" }, 404);
    }
    // A clash on the hash (one in 10^12 per code) just draws again.
    for (let attempt = 0; attempt < 3 && !issued; attempt++) {
      const code = newVipCode();
      const { data, error } = await admin
        .from("vip_invitation_codes")
        .insert({
          code_hash: await hashVipCode(code),
          code_last4: code.slice(-4),
          label: parsed.label,
          vip_partner_id: parsed.vipPartnerId,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") continue;
        return json({ ok: false, code: "save_failed", error: `save_failed: ${error.message}` }, 500);
      }
      issued = { id: data.id as string, code };
    }
    if (!issued) return json({ ok: false, code: "save_failed", error: "save_failed: no free code" }, 500);
    console.log("vip_code_issued", JSON.stringify({ id: issued.id, last4: issued.code.slice(-4) }));
  }

  // The code is shown once, so a failed list read after an issue still
  // answers ok with the code (codes: null keeps the page's list).
  const loaded = await loadVipCodes(admin);
  if (!loaded.ok) console.error("vip_codes_list_failed", JSON.stringify({ error: loaded.error }));
  if (!loaded.ok && !issued) {
    return json({ ok: false, code: "save_failed", error: `saved, but ${loaded.error}` }, 500);
  }
  return json({
    ok: true,
    ...(issued ? { issuedCode: formatVipCode(issued.code), issuedId: issued.id } : {}),
    codes: loaded.ok ? loaded.codes : null,
  });
});
