// Supabase Edge Function — admin-web-create-premier-code
//
// MESITA-3167: Manage › Premier mints and revokes Mesita Premier codes. A
// code is 100%: whoever redeems it on a place gets its Refill days (2X or
// 5X); there are no percentage codes. The plain code is in this reply only:
// the database keeps HMAC-SHA256(code, PREMIER_CODE_PEPPER) and its last 4.
// Revoking ends the code now; days places already redeemed keep running.
// The list (with uses) is admin-web-list-premier `codes`.
//
// Body:     { action: "create", tier: 1|2, days: 1..366, maxRedemptions: 1..100000, expiresAt?: ISO | null }
//         | { action: "revoke", codeId: uuid }
// Response: create { ok: true, id, code: "XXXX-XXXX", last4 } · revoke { ok: true }
// 400 { ok: false, code, error }: action_invalid · tier_invalid · days_invalid · max_invalid ·
//     expires_invalid · code_id_invalid. 404 not_found (revoke). 503 codes_off.
// Auth:     caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { codePepper, codesOff, formatCode, hashCode, mintCode, parseCreateCode } from "../_shared/premier-code.ts";

const bad = (code: string, error: string) => json({ ok: false, code, error }, 400);

serveJson("admin-web-create-premier-code", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  if (body.action === "revoke") {
    if (!isUuid(body.codeId)) return bad("code_id_invalid", "codeId is required");
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("premier_codes")
      .update({ expires_at: now, revoked_at: now })
      .eq("id", body.codeId)
      .is("revoked_at", null)
      .select("id");
    if (error) return json({ ok: false, error: `revoke: ${error.message}` }, 500);
    if (!data || data.length === 0) {
      // Already revoked is done; an unknown id is not.
      const { data: row } = await admin.from("premier_codes").select("id").eq("id", body.codeId).maybeSingle();
      if (!row) return json({ ok: false, code: "not_found", error: "Code not found" }, 404);
    }
    return json({ ok: true });
  }

  if (body.action !== "create") return bad("action_invalid", "action must be create or revoke");
  const parsed = parseCreateCode(body, Date.now());
  if ("code" in parsed) return bad(parsed.code, parsed.error);

  const pepper = codePepper();
  if (!pepper) return codesOff();

  // 40 bits: a clash is next to impossible, but the unique hash refuses it, so try again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = mintCode();
    const { data, error } = await admin
      .from("premier_codes")
      .insert({
        code_hash: await hashCode(code, pepper),
        last4: code.slice(-4),
        tier: parsed.tier,
        days: parsed.days,
        max_redemptions: parsed.maxRedemptions,
        expires_at: parsed.expiresAt,
        created_by: user.emailLower ?? user.id,
      })
      .select("id")
      .single();
    if (!error && data) {
      console.log(JSON.stringify({ fn: "admin-web-create-premier-code", id: data.id, last4: code.slice(-4), tier: parsed.tier, days: parsed.days }));
      return json({ ok: true, id: data.id, code: formatCode(code), last4: code.slice(-4) });
    }
    if (error?.code !== "23505") return json({ ok: false, error: `create: ${error?.message ?? "no row"}` }, 500);
  }
  return json({ ok: false, error: "Couldn't mint a code. Try again." }, 500);
});
