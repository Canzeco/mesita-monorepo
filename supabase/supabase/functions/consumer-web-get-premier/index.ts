// Supabase Edge Function — consumer-web-get-premier
//
// MESITA-3092: a place's Premier as its tab shows it — Manual Premier
// (Mesita's free lift, MESITA-3091) and the Paid subscription apart, who the
// caller is to it (`viewer`: payer, former_payer, stranger), whether they
// may resume, the notice of their own subscription that ended, and what each
// plan would mean for them right now (`quotes`, computed here; the UI never
// computes money). With `session_id` (Checkout's return, `?boost=`) it first
// settles the caller's own pledge through confirmPledge — only the session
// stored on that pledge, never one taken on trust — and says what happened
// (`outcome`). A guest who never comes back is settled by
// supabase-cron-sync-premier.
//
// Body: { place_id: uuid, session_id?: string }
// Response: { ok: true, tier, manual: { tier, ends_at } | null,
//             paid: { tier, ends_at, renews, by_you } | null,
//             renewing: boolean, viewer: Viewer | null, can_resume: boolean,
//             mine: MinePledge | null, ended_notice: EndedNotice | null,
//             quotes: Record<tier, Record<interval, Quote>> | null,
//             outcome?: ConfirmOutcome,
//             period, line: [], more: 0 }  (the last three for builds
//             before MESITA-3092, one release)
//
// The read is `_shared/premier-flow.ts` `readPremier` (MESITA-3103), shared
// with business-web-get-premier.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readPremier } from "../_shared/premier-flow.ts";

serveJson("consumer-web-get-premier", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const { user } = await getOptionalAuthedUser(req, envRes.env);

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const sessionId = typeof bodyRes.body.session_id === "string" ? bodyRes.body.session_id : null;

  return await readPremier(envRes.env, user, placeId, sessionId);
});
