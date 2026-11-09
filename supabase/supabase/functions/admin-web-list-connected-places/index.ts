// Supabase Edge Function — admin-web-list-connected-places
//
// MESITA-3383: Manage › Money's connected places. Every place with a
// place_payment_accounts row in PAYMENTS_STRIPE_MODE's universe (never the body's, so
// a live row never shows under test): its name, the account's state (ready /
// onboarding / restricted, as Business › Payments words it), the switches
// the owner has on, credit outstanding (Available and Pending) against the
// test-mode place cap, and the last Connect event received. 50 a page,
// newest account first, by a (created_at, place_id) cursor. Super-admin only.
//
// Body: { before?: { created_at, place_id } }
// Response: { ok, test_mode, cap_cents, rows: [...], next }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentsLivemode } from "../_shared/boost.ts";
import { accountState } from "../_shared/payments.ts";
import { PLACE_CAP_CENTS } from "../_shared/vouchers.ts";

type Row = {
  place_id: string;
  place_name: string | null;
  created_at: string;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  disabled_reason: string | null;
  requirements_due: number;
  switches: Record<string, unknown>;
  available_cents: number;
  pending_cents: number;
  last_event_at: string | null;
};

serveJson("admin-web-list-connected-places", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const before = (bodyRes.body.before ?? null) as { created_at?: unknown; place_id?: unknown } | null;
  if (before && (typeof before.created_at !== "string" || Number.isNaN(Date.parse(before.created_at)) || !isUuid(before.place_id))) {
    return json({ ok: false, error: "before must be { created_at, place_id }" }, 400);
  }

  const livemode = paymentsLivemode();
  const { data, error } = await admin.rpc("admin_connected_places", {
    p_livemode: livemode,
    p_before: before ? before.created_at : null,
    p_before_id: before ? before.place_id : null,
  });
  if (error) return json({ ok: false, error: `admin_connected_places: ${error.message}` }, 500);
  const rows = ((data ?? []) as Row[]).map(({ charges_enabled, details_submitted, disabled_reason, switches, ...r }) => ({
    ...r,
    state: accountState({ charges_enabled, details_submitted, disabled_reason }),
    disabled_reason,
    switches_on: Object.entries(switches ?? {}).filter(([, v]) => v === true).map(([k]) => k).sort(),
    available_cents: Number(r.available_cents ?? 0),
    pending_cents: Number(r.pending_cents ?? 0),
  }));
  const last = rows.length === 50 ? rows[49] : null;
  return json({
    ok: true,
    test_mode: !livemode,
    // The cap binds only in test mode (vouchers.ts overPlaceCap); live has none.
    cap_cents: livemode ? null : PLACE_CAP_CENTS,
    rows,
    next: last ? { created_at: last.created_at, place_id: last.place_id } : null,
  });
});
