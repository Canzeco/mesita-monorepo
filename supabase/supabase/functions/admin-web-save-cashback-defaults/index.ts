// admin-web-save-cashback-defaults — the one door onto the cashback defaults
// (MESITA-4700, Pato: "Yes, editable"): the Welcome and Returning rates
// (MESITA-4709; Off · 5 · 10 · 15 · 20 %) and the cap per bill that
// every place without its own saved lines reads. A place's own lines
// (place_cashback_settings) are never touched.
//
// MESITA-4766: and Returning VIP (returning_vip_bps 0 · 1000 · 2000, optional); MESITA-4789: Welcome VIP (welcome_vip_bps, same steps, optional).
//
// Body: { welcome_bps, returning_bps, returning_vip_bps?, welcome_vip_bps? } (a cap_cents is ignored; MESITA-4728)
// Response: { ok: true, cashback_defaults } · 400 bad input
// Super-admins only. A change applies to the next confirmed bill; cashback
// already earned stays as it was.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { CASHBACK_RATE_COLUMNS, readCashbackInput } from "../_shared/cashback.ts";

serveJson("admin-web-save-cashback-defaults", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const input = readCashbackInput(bodyRes.body);
  if (!input.ok) return json({ ok: false, error: input.error }, 400);
  const by = ctx.user.email ?? ctx.user.id;
  const { data, error } = await ctx.admin
    .from("cashback_defaults")
    .upsert({ id: true, ...input.rates, updated_at: new Date().toISOString(), updated_by: by }, { onConflict: "id" })
    .select(CASHBACK_RATE_COLUMNS)
    .single();
  if (error) return json({ ok: false, error: `cashback_defaults: ${error.message}` }, 500);
  console.log("[admin-web-save-cashback-defaults]", JSON.stringify({ ...input.rates, by }));
  return json({ ok: true, cashback_defaults: data });
});
