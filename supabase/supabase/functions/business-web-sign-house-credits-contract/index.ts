// Supabase Edge Function — business-web-sign-house-credits-contract
//
// MESITA-3589: the owner agrees to the House Credits Contract (Notion Main
// §10: House Credits Contract, Not signed · Signed). Independent of Stripe
// Connect (Pato, 2026-11-09: "REMEMBER THAT CONTRACT IS INDEPENDENT FROM
// STRIPE CONNECT"): nothing here reads or needs the place's Stripe account.
// The text is a placeholder until a lawyer writes it (terms_version
// draft-2026-11); the record keeps who agreed, when and to which version.
// Signing never turns House Credits on: that is the owner's next switch.
//
// The place's owner (or Mesita staff on the owner's behalf) only.
//
// Body: { place_id: uuid }
// Response: { ok: true, contract: { signed, signed_at, terms_version, text }, outcome: signed|already_signed }
// The record keeps the signer's id, email and role (owner | superadmin), the
// version, the sha256 of the exact text shown, the time, IP and user agent;
// it is append-only (SQL), so a signature is never edited.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { HOUSE_CREDITS_TERMS_TEXT, HOUSE_CREDITS_TERMS_VERSION, readContract, sha256Hex } from "../_shared/payments.ts";

serveJson("business-web-sign-house-credits-contract", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const existing = await readContract(admin, placeId);
  if (existing.signed) return json({ ok: true, outcome: "already_signed", contract: existing });

  const { error } = await admin.from("house_credits_contracts").insert({
    place_id: placeId,
    signed_by: user.id,
    signed_by_email: user.email ?? null,
    signer_role: access.role === "superadmin" ? "superadmin" : "owner",
    terms_version: HOUSE_CREDITS_TERMS_VERSION,
    text_sha256: await sha256Hex(HOUSE_CREDITS_TERMS_TEXT),
    ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400) || null,
  });
  // Two taps at once: the unique live-contract index lets one through.
  if (error && error.code !== "23505") {
    return json({ ok: false, error: `house_credits_contracts: ${error.message}` }, 500);
  }
  console.log("[business-web-sign-house-credits-contract]", JSON.stringify({ place_id: placeId, user_id: user.id, terms_version: HOUSE_CREDITS_TERMS_VERSION }));
  return json({ ok: true, outcome: error ? "already_signed" : "signed", contract: await readContract(admin, placeId) });
});
