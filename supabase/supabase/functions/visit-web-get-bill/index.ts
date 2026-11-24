// Supabase Edge Function — visit-web-get-bill
//
// MESITA-4823 (waiter-led pay): the waiter's poll. Never who the guest is
// (their photo only), and no credits before the guest accepts.
//
// Body: { bill_id, place_id, staff_token }
// Response: { ok: true, bill: { id, state, version, currency, bill_cents, tip_cents,
//             discount_cents, credit_cents, outside_bill_cents, outside_cents,
//             expires_at, test_mode }, place: { id, name }, guest_photo }
//   403 staff_code_needed · 404 gone

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { billStaff, readBill, readBillAttempt, staffBillView } from "../_shared/pay-bill.ts";

serveJson("visit-web-get-bill", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  if (!isUuid(body.bill_id)) return json({ ok: false, code: "bad_request", error: "That is not a bill" }, 400);

  try {
    const staff = await billStaff(admin, env.serviceKey, body, Date.now());
    if (!staff) return json({ ok: false, code: "staff_code_needed", error: "Type the waiter code" }, 403);
    const bill = await readBill(admin, body.bill_id);
    if (!bill || bill.place_id !== staff.placeId) return json({ ok: false, code: "gone", error: "This bill is gone" }, 404);
    const [attempt, placeRes, guest] = await Promise.all([
      readBillAttempt(admin, bill),
      readVoucherPlace(admin, bill.place_id),
      admin.from("consumers").select("avatar_url").eq("id", bill.consumer_id).maybeSingle(),
    ]);
    if (!placeRes.ok) throw new Error(placeRes.error);
    const photo = (guest.data as { avatar_url: string | null } | null)?.avatar_url ?? null;
    return json({
      ok: true,
      bill: staffBillView(bill, attempt, Date.now()),
      place: { id: bill.place_id, name: placeRes.place?.name ?? null },
      guest_photo: typeof photo === "string" && photo.startsWith("https://") ? photo : null,
    });
  } catch (err) {
    return failWithRequestId("visit-web-get-bill", "Couldn't read the bill. Try again.", err);
  }
});
