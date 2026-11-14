// admin-web-get-credits-limit — Admin › Payments › Credits Limit (MESITA-3947,
// Pato 2026-11-14: "the limit each place can accept ... i also want to be
// able to monitor that super important").
//
// One read, admin_credit_limits, in STRIPE_MODE's universe (never the
// body's): the default limit per currency, and every place holding credit
// or with House Credits On, with its outstanding credit (Available + Pending
// + open gift links, what the buy path counts), its own limit (null = the
// default) and the limit that binds it. Super-admins only.
//
// Response: { ok: true, test_mode, defaults: [{ currency, limit_cents,
//   updated_at }], places: [{ place_id, place_name, currency,
//   outstanding_cents, override_cents, limit_cents, house_credits }] }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

serveJson("admin-web-get-credits-limit", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const livemode = paymentsLivemode();
  const { data, error } = await ctx.admin.rpc("admin_credit_limits", { p_livemode: livemode });
  if (error) return json({ ok: false, error: `admin_credit_limits: ${error.message}` }, 500);
  const d = (data ?? {}) as { defaults?: unknown[]; places?: unknown[] };
  return json({ ok: true, test_mode: !livemode, defaults: d.defaults ?? [], places: d.places ?? [] });
});
