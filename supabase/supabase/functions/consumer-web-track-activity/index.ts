// Supabase Edge Function — consumer-web-track-activity
//
// Social v1 (MESITA-2442): records one of the two events on a Mesita place.
// `went` ("I went") is refused for now (MESITA-2567): Social is liked and
// viewed only.
//
// Body: { kind: "saved" | "viewed", place_id: uuid, on?: boolean,
//         quiet?: boolean, lat?: number, lng?: number }
//   saved         on: true (default) upserts the row, on: false deletes it
//                 (unsave).
//   viewed        always an upsert; a re-open moves created_at forward so the
//                 feed shows the latest look, once per member × place.
//   quiet         saved only: a backfilled pre-Social save (the first sync in a
//                 browser, MESITA-2460) — the owner's Saved list reads it, the
//                 feed and place lines never do. A real tap writes quiet=false.
//   lat, lng      where the guest's device was (MESITA-2853): the feed
//                 measures the viewer to this point ("1.2 km away"). Without
//                 a fix, or out of range, the event stores no point.
// Response: { ok: true, kind, on, enriching? }
//   enriching     viewed only: the place is mid-Enrich after this view
//                 (MESITA-2952), so the open profile can show the Enriching
//                 tag the page loaded without.
//
// A Google-only card (`g:<id>`) is refused: it is not a place row yet, and its
// save stays in the browser (lib/saved-places.ts). Recording never checks
// visibility: a member without Instagram still saves; nobody sees it
// (place_activity_visible decides that at read time).
//
// A VIEW COUNTS TOWARD ENRICH (Pato, MESITA-2642: "a profile views counter
// in the background, and when it surpasses a certain amount we automatically
// enrich the place"). A `viewed` also goes through applyPlaceRequest: each
// signed-in guest counts once per place (apply_place_request), and reaching
// the enrichment config's threshold ("Enrich after N views",
// enrichRequestThreshold) starts the same Render run admin Enrich starts. It
// replaced the guest vote (consumer-web-request-place, retired). A failure
// here never fails the view.
//
// A VIEW ALSO DRIVES UPDATE (Pato, MESITA-2997: "every 10 visits, 20, 30 we
// update the place"). The count keeps going after Enrich; each new view that
// lands it on a multiple of "Update every N views" (updateEveryViews) runs
// the same Google Update the admin Update runs (Google factuals into
// place_profiles), in the background after the answer.
//
// A SIGNED-OUT OPEN IS A VIEW WITH NO PERSON (Pato, 2026-11-18, MESITA-4326:
// "anonymous users must not be created in the database at all … the only
// thing anonymous must act on is views"; "counts only"). With no session a
// `viewed` writes one place_events row with no consumer: Business Views and
// the Stats box count it, the log, the Social feed and the person card never
// show it. It is not an Enrich/Update vote (applyPlaceRequest): those runs
// cost money and a signed-out count is too easy to inflate. Anything else
// with no session is 401.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { consumerOrAnonymousRequest } from "../_shared/request.ts";
import { eventPoint, isActivityKind, isMesitaPlaceId } from "../_shared/place-activity.ts";
import { applyPlaceRequest } from "../_shared/place-requests.ts";
import { runGooglePlaceUpdate } from "../_shared/admin-google-place-update.ts";
import { runReviewsUpdate } from "../_shared/reviews-update.ts";
import { runInBackground } from "../_shared/background.ts";

type Body = {
  kind?: string;
  place_id?: string;
  on?: boolean;
  quiet?: boolean;
  lat?: number;
  lng?: number;
};

serveJson("consumer-web-track-activity", async (req) => {
  const ctx = await consumerOrAnonymousRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user, testGuest } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { kind, place_id: placeId } = bodyRes.body;
  if (!isActivityKind(kind)) {
    return json({ ok: false, error: "kind must be saved or viewed" }, 400);
  }
  if (!isMesitaPlaceId(placeId)) {
    return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  }
  if (!user) {
    if (kind !== "viewed") {
      return json({ ok: false, error: "Sign in to save places", code: "sign_in_required" }, 401);
    }
    const { error } = await admin
      .from("place_events")
      .insert({ consumer_id: null, place_id: placeId, kind: "viewed" });
    if (error) {
      const status = error.code === "23503" ? 404 : 500;
      return json({ ok: false, error: `anonymous_view: ${error.message}` }, status);
    }
    return json({ ok: true, kind, on: true, enriching: false });
  }
  const consumerId = user.id;
  const on = kind === "viewed" ? true : bodyRes.body.on !== false;
  // The test guest (MESITA-4931): a view is not recorded; a save is quiet, so
  // only their own Saved list reads it.
  if (testGuest && kind === "viewed") return json({ ok: true, kind, on, enriching: false });
  const quiet = kind === "saved" && (testGuest || bodyRes.body.quiet === true);
  const point = eventPoint(bodyRes.body.lat, bodyRes.body.lng);

  if (on) {
    const { error } = await admin.from("place_activity").upsert(
      {
        consumer_id: consumerId,
        place_id: placeId,
        kind,
        created_at: new Date().toISOString(),
        quiet,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
      },
      { onConflict: "consumer_id,place_id,kind" },
    );
    if (error) {
      // 23503: the place (or the consumer row) does not exist.
      const status = error.code === "23503" ? 404 : 500;
      return json({ ok: false, error: `activity_upsert: ${error.message}` }, status);
    }
  } else {
    const { error } = await admin
      .from("place_activity")
      .delete()
      .eq("consumer_id", consumerId)
      .eq("place_id", placeId)
      .eq("kind", kind);
    if (error) {
      return json({ ok: false, error: `activity_delete: ${error.message}` }, 500);
    }
  }

  let enriching = false;
  if (kind === "viewed") {
    const counted = await applyPlaceRequest(admin, {
      consumerId,
      placeId,
      callerName: "consumer-web-track-activity",
    });
    if (counted.ok) {
      enriching = counted.enriching;
      if (counted.updateDue) {
        runInBackground(
          runGooglePlaceUpdate(admin, placeId, { supabaseUrl: env.url }).then((r) => {
            if (!r.ok) {
              console.error(
                `[consumer-web-track-activity] the view's Update did not run: ${r.error}`,
              );
            }
          }),
        );
      }
      // Update Reviews every N views (MESITA-3159), rarer than Google's.
      if (counted.reviewsUpdateDue) {
        runInBackground(
          runReviewsUpdate(admin, placeId).then((r) => {
            if (!r.ok) {
              console.error(
                `[consumer-web-track-activity] the view's Update Reviews did not run: ${r.error}`,
              );
            }
          }),
        );
      }
    } else {
      console.error(
        `[consumer-web-track-activity] the view did not count toward Enrich: ${counted.error}`,
      );
    }
  }

  return json(kind === "viewed" ? { ok: true, kind, on, enriching } : { ok: true, kind, on });
});
