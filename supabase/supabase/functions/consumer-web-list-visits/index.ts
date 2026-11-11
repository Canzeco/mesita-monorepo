// Supabase Edge Function — consumer-web-list-visits
//
// MESITA-3688: Activity › Visits. The signed-in guest's own tabs (Pay at the
// table), newest first, in the money mode the wallet uses, so Visits and
// Payments show the same world. Read-only. The work is _shared/list-visits.ts.
//
// Body: {}
// Response: { ok: true, visits: [{ tab_id, place: { id, name, slug,
//             photo_url }, status, currency, bill_cents, tip_cents, ticket,
//             waiter_name, created_at, paid_at, expires_at,
//             part_payment_ids }], truncated }
//   `truncated`: more than 50 tabs exist (the app shows "50+").
//   `part_payment_ids`: every payment of that tab, any status; the app keeps
//   them out of Payments (one meal, one ticket).
//   401 sign_in · 500 { ok: false, error: "Couldn't load your visits",
//   request_id } (the log line carries the same request_id and the cause)
//
// A card part still settling keeps its tab "paying" here until the tab
// screen's own read or the sweep settles it; this list never asks Stripe.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { listVisits } from "../_shared/list-visits.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

serveJson("consumer-web-list-visits", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to see your visits" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const res = await listVisits(admin, user.id, paymentsLivemode(), Date.now());
  if (!res.ok) return failWithRequestId("consumer-web-list-visits", "Couldn't load your visits", res.error);
  return json({ ok: true, visits: res.visits, truncated: res.truncated });
});
