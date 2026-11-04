// Supabase Edge Function — visit-web-find-visit
//
// MESITA-3262: visit.mesita.ai when the QR won't scan (Pato: "if not scan, enable to
// manually input member number"). The member number and the place's six digits together
// open the guest's open QR at that place. Alone a member number opens nothing, because
// member numbers are sequential and there is no sign-in here. Five wrong tries lock
// typing for that guest for 15 minutes (place_visit_member_claim).
//
// The answer is the same secret a scanned link holds, new for this opening, so
// visit-web-get-visit and visit-web-close-visit carry on as they do for a scan.
//
// Body: { member_number: "1234-5678", place_code: "123456" }
// Response: { ok: true, place_id, code: "<32 hex>" }
//         | { ok: false, code: "no_match" | "locked" | "bad_codes", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { hashPlaceCode, hashVisitCode, newVisitCode, readMemberNumber, readPlaceCode } from "../_shared/place-visits.ts";

const REFUSED: Record<string, string> = {
  no_match: "That doesn't match an open QR. Check both codes, and that the guest has their QR on screen.",
  locked: "Too many wrong tries for this member number. Try again in 15 minutes, or scan the QR.",
};

serveJson("visit-web-find-visit", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const memberNumber = readMemberNumber(bodyRes.body.member_number);
  const placeCode = readPlaceCode(bodyRes.body.place_code);
  if (!memberNumber || !placeCode) {
    return json({ ok: false, code: "bad_codes", error: "The member number is eight digits and the place code is six." }, 400);
  }

  const admin = adminClient(envRes.env);
  const places = await admin.rpc("place_visit_member_places", { p_member_number: memberNumber });
  if (places.error) return json({ ok: false, error: places.error.message }, 500);

  const code = newVisitCode();
  const candidates = await Promise.all(
    ((places.data ?? []) as string[]).map(async (placeId) => ({
      place_id: placeId,
      place_code_hash: await hashPlaceCode(placeId, placeCode),
      new_code_hash: await hashVisitCode(placeId, code),
    })),
  );

  // With no open QR this still runs, so a wrong try counts the same either way.
  const { data, error } = await admin.rpc("place_visit_member_claim", {
    p_member_number: memberNumber,
    p_candidates: candidates,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data?.outcome !== "ok") {
    const outcome = String(data?.outcome);
    return json({ ok: false, code: outcome, error: REFUSED[outcome] ?? REFUSED.no_match }, 409);
  }
  console.log(JSON.stringify({ fn: "visit-web-find-visit", place_id: data.place_id }));
  return json({ ok: true, place_id: data.place_id, code });
});
