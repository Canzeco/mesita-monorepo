// admin-web-save-credits-limit — the one door onto the Credits Limit
// (MESITA-3947): a currency's default, or one place's own limit.
//
// Body: { currency: "MXN", limit_cents: integer ≥ 0 }
//     | { place_id: uuid, limit_cents: integer ≥ 0 | null }  (null = the default)
// Response: { ok: true } · 400 bad input · 404 unknown currency or place
// Super-admins only. A lower limit never touches credit already owed; it
// only refuses the next voucher buy that would pass it.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";

/** Ten billion units in cents: above any real limit, below 2^53. */
const MAX_LIMIT_CENTS = 1_000_000_000_000;

function isLimit(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_LIMIT_CENTS;
}

serveJson("admin-web-save-credits-limit", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { currency, place_id: placeId, limit_cents: limit } = bodyRes.body;
  const by = ctx.user.email ?? ctx.user.id;

  if (typeof currency === "string") {
    if (!/^[A-Z]{3}$/.test(currency)) return json({ ok: false, error: "currency must be a three-letter code" }, 400);
    if (!isLimit(limit)) return json({ ok: false, error: "limit_cents must be a whole number of cents, 0 or more" }, 400);
    const { data, error } = await ctx.admin
      .from("credit_limit_defaults")
      .update({ limit_cents: limit, updated_at: new Date().toISOString(), updated_by: by })
      .eq("currency", currency)
      .select("currency");
    if (error) return json({ ok: false, error: `save_default: ${error.message}` }, 500);
    if (!data || data.length === 0) return json({ ok: false, error: `No default for ${currency}` }, 404);
    console.log("[admin-web-save-credits-limit]", JSON.stringify({ currency, limit_cents: limit, by }));
    return json({ ok: true });
  }

  if (isUuid(placeId)) {
    if (limit !== null && !isLimit(limit)) {
      return json({ ok: false, error: "limit_cents must be a whole number of cents, 0 or more, or null" }, 400);
    }
    const { data, error } = await ctx.admin.rpc("admin_set_place_credit_limit", { p_place_id: placeId, p_limit_cents: limit });
    if (error) return json({ ok: false, error: `save_place: ${error.message}` }, 500);
    if (data !== true) return json({ ok: false, error: "No such place" }, 404);
    console.log("[admin-web-save-credits-limit]", JSON.stringify({ place_id: placeId, limit_cents: limit, by }));
    return json({ ok: true });
  }

  return json({ ok: false, error: "Send a currency or a place_id" }, 400);
});
