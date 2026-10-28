// Supabase Edge Function — consumer-web-cancel-reservation (product caller)
//
// The guest cancels their OWN reservation from the app — the in-app half of
// the cancel paths (the other two are voice: eleven-a2-cancel-reservation on
// the Confirmer call, eleven-a3-cancel-reservation on the inbound line).
//
//   { reservation_id, reason? }
//
// Ownership is re-checked server-side (consumer_id === caller) — an id alone
// is never authority. Idempotent: cancelling a cancelled ticket is ok:true.
// A ticket whose slot already passed can't be cancelled (409) — there is
// nothing left to call off.
//
// The engine may still have a run in flight; it only ever writes to a ticket
// it already started, and the next state write loses to this one because the
// app reads `state` as the single visible verdict.
//
// Deploy: supabase functions deploy consumer-web-cancel-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { cancelAsGuest } from "../_shared/agent-tools.ts";
import { readOwnedTicket } from "../_shared/reservation-owned.ts";
import { PASSED_GRACE_MS } from "../_shared/reservation-doc.ts";

type Body = { reservation_id?: string; reason?: string };

serveJson("consumer-web-cancel-reservation", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const id = bodyRes.body.reservation_id;
  if (!id || typeof id !== "string") {
    return json({ ok: false, error: "reservation_id required" }, 400);
  }
  const reason = typeof bodyRes.body.reason === "string"
    ? bodyRes.body.reason.trim().slice(0, 300)
    : "";

  const admin = adminClient(envRes.env);
  const { row, error: readErr } = await readOwnedTicket<{
    id: string;
    state: string;
    reserved_at: string;
    consumer_id: string;
    reference_code: string | null;
  }>(admin, id, authRes.user.id, "id, state, reserved_at, consumer_id, reference_code");
  if (readErr) return json({ ok: false, error: readErr }, 500);
  // Same answer for "doesn't exist" and "not yours" — never leak existence.
  if (!row) {
    return json({ ok: false, error: "Reservation not found" }, 404);
  }

  if (row.state === "cancelled") {
    return json({ ok: true, already: true, reservation_id: id, state: "cancelled" });
  }
  if (new Date(row.reserved_at).getTime() < Date.now() - PASSED_GRACE_MS) {
    return json({ ok: false, error: "This reservation already happened." }, 409);
  }

  // A CONFIRMED table means the place is holding it — it must HEAR about the
  // cancel or this becomes a Mesita-made no-show (Docs › Reservations §B
  // leg 5). Pending tickets owe nothing: never ring a place to cancel what it
  // never agreed to.
  // ONE cancel write-shape for all four doors (app + a2/a3/a4 voice) —
  // cancelTicket owns it, including the run_id rotation that orphans any
  // mid-flight engine run. The cancel itself is done and instant; the
  // courtesy call is a background consequence.
  const res = await cancelAsGuest(
    admin,
    envRes.env,
    "consumer-web-cancel-reservation",
    { id, state: row.state },
    reason,
  );
  if (!res.ok) return json({ ok: false, error: res.error }, 500);

  return json({
    ok: true,
    cancelled: true,
    reservation_id: id,
    state: "cancelled",
    reference_code: row.reference_code ?? null,
    place_notified: res.placeNotified,
  });
});
