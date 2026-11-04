// Supabase Edge Function — consumer-web-create-visit-code
//
// MESITA-3202: the place screen's Rewards tab, Show my code. What a guest's QR
// holds: this place only, ten minutes, one use. Asking again replaces the last
// one. The code is never stored in the clear. A closed account's code is refused
// where it is used (place_visit_check, place_visit_close).
//
// MESITA-3240: a long secret, not six digits. The QR links to visit.mesita.ai and
// nobody types it. The six digits people type are the place's.
//
// MESITA-3214: the Reward tab's QR, at every Mesita place. For the moment every
// place counts as offering rewards (Pato: "assume all palces offer rewards"), so
// a place with none on still issues a code. It switches nothing on: at the till
// that guest gets only the rewards the place has on, so none there.
//
// MESITA-3245: the guest enters the bill first, and it waits with the code. The
// place corrects it if it is wrong when it closes the visit.
//
// MESITA-3259: Story is the guest's choice, and the tick waits with the code too.
// Staff's page and the close read it.
//
// Body: { place_id: uuid, bill_cents: integer, story?: boolean }
// Response: { ok: true, code: "<32 hex>", issued_at, expires_at }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { hashVisitCode, isBillCents, newVisitCode, VISIT_CODE_DRAWS, VISIT_CODE_MINUTES } from "../_shared/place-visits.ts";

serveJson("consumer-web-create-visit-code", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const billCents = bodyRes.body.bill_cents;
  if (!isBillCents(billCents)) return json({ ok: false, code: "bad_bill", error: "Enter your bill." }, 400);

  const admin = adminClient(envRes.env);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + VISIT_CODE_MINUTES * 60_000).toISOString();
  for (let draw = 0; draw < VISIT_CODE_DRAWS; draw++) {
    const code = newVisitCode();
    const { data: issued, error } = await admin.rpc("place_visit_code_issue", {
      p_place_id: placeId,
      p_consumer_id: userId,
      p_code_hash: await hashVisitCode(placeId, code),
      p_expires_at: expiresAt,
      p_bill_cents: billCents,
      p_story: bodyRes.body.story === true,
    });
    if (error) return json({ ok: false, error: error.message }, 500);
    if (issued === true) return json({ ok: true, code, issued_at: issuedAt.toISOString(), expires_at: expiresAt });
  }
  return json({ ok: false, error: "Couldn't make a code. Try again." }, 500);
});
