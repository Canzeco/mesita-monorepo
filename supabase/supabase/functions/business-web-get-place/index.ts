// Supabase Edge Function — business-web-get-place
//
// ONE place, by id, for the console's Place screen.
//
// IT EXISTS BECAUSE THE POOL IS ALSO A READ. business-web-get-overview only
// ever answers about places the caller is a MEMBER of — that is the whole
// shape of its payload — so asking it about a place nobody holds returns
// nothing, or worse, a DIFFERENT place. (Before MESITA-1892 the gap was
// wider: an org-claimed place had no `place_members` row at all, because the
// organization held it through `places.organization_id`. That layer is gone,
// the claim mints a real owner row, and the gap that is left is exactly the
// pool.)
//
// Auth, in the same two shapes the listing already has:
//   held place — the caller's own `place_members` row, any role. Reading a
//                place you belong to is a membership fact, exactly as in
//                business-web-list-places scope=mine.
//   pool place — any signed-in account, which is precisely what
//                business-web-list-places scope=public already exposes.
//
// A place you may not see is 404, never 403: someone else's place must not be
// able to tell you it exists.
//
// The pool predicate is the shared one (_shared/place-claim.ts) for the
// same reason the listing uses it — a place with a direct `place_members`
// owner is NOT in the pool even though it was never claimed from it, and
// three surfaces disagreeing about that is how a stranger reads someone
// else's live restaurant.
//
// ONE ROLE, ONE FIELD. The payload used to carry a `holder` object (the
// organization's id, its name, the claim date, and the caller's role IN it)
// beside `myDirectRole`, the caller's place_members role — two roles, ranked
// against each other, because a caller could hold both. There is one grant
// now, so there is one role: `myRole`, null when the place is visible only
// because it is pooled. `claimedAt` moved onto `place`, where the rest of the
// facts about the place already live.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isPlaceClaimable } from "../_shared/place-claim.ts";
import { isPlaceEnriched, isPlaceListed } from "../_shared/place-state.ts";
import { capPhotos, GET_PLACE_SELECT, totalPhotos } from "./place-projection.ts";

type Body = { placeId?: string; projectId?: string };

const NOT_FOUND = { ok: false, error: "Place not found", code: "not_found" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);

  // The place row carries the identity and lifecycle facts; the embedded
  // place_profiles row carries what the address IS. One round trip, the same
  // join business-web-list-places uses.
  //
  // The column list lives in place-projection.ts so a test can assert the
  // audience boundary — `plan` and `listing_type` and the strike columns are
  // named there and proven absent, rather than promised in a comment here.
  const { data, error } = await admin
    .from("places")
    .select(GET_PLACE_SELECT)
    .eq("id", placeId)
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) {
    // Both 404 branches log, because the response deliberately cannot tell
    // them apart. Without this, "the operator says their place 404s" is
    // unreconstructible three weeks later.
    console.error(`[get-place] absent: ${placeId}`);
    return json(NOT_FOUND, 404);
  }

  type Row = {
    id: string;
    state: string;
    content_state: string;
    currency: string;
    claimed_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    place_profiles: {
      name: string;
      address: string | null;
      zone: string | null;
      city: string | null;
      category: string | null;
      category_label: string | null;
      phone: string | null;
      timezone: string | null;
      enriched_at: string | null;
      photos: string[] | null;
      google_stars_overall: number | null;
      google_review_count: number | null;
    };
  };
  const row = data as unknown as Row;

  // Gate before spending another query on a place the caller may not see.
  // The role IS the membership row (_shared/auth-membership.ts): `owner` can
  // arrive from nowhere else, so there is nothing to rank.
  const { data: memberRow, error: memberErr } = await admin
    .from("place_members")
    .select("role")
    .eq("place_id", placeId)
    .eq("manager_id", authRes.user.id)
    .maybeSingle();
  if (memberErr) return json({ ok: false, error: memberErr.message }, 500);
  const myRole = (memberRow as { role?: string } | null)?.role ?? null;

  // No membership: visible only while the place is genuinely pooled. A
  // stranger's place stays a uniform 404 whether it was claimed from the pool
  // or owned the old way.
  if (!myRole && !(await isPlaceClaimable(admin, placeId))) {
    console.error(`[get-place] held by someone else: ${placeId}`);
    return json(NOT_FOUND, 404);
  }

  // Verified is an APPROVED verification on the place, whoever requested
  // it: the proof belongs to the address, not to the account that filed
  // it. (business-web-get-verification answers a different question — how
  // is MY request going — so it filters by requester and cannot be reused.)
  const { data: verification } = await admin
    .from("place_verifications")
    .select("id")
    .eq("place_id", placeId)
    .eq("state", "approved")
    .limit(1)
    .maybeSingle();

  return json({
    ok: true,
    place: {
      id: row.id,
      name: row.place_profiles.name,
      address: row.place_profiles.address,
      zone: row.place_profiles.zone,
      city: row.place_profiles.city,
      category: row.place_profiles.category,
      categoryLabel: row.place_profiles.category_label,
      phone: row.place_profiles.phone,
      timezone: row.place_profiles.timezone,
      currency: row.currency,
      // The raw places.state. `listed` is what the console gates on; this
      // is the REASON when listed is false, and the screen shows it only
      // then — an operator asking "why can't guests see us" is owed the
      // answer, not a bare No.
      state: row.state,
      contentState: row.content_state,
      enrichedAt: row.place_profiles.enriched_at,
      // Capped for the wire; `totalPhotos` keeps the truth so the screen can
      // honestly say "10 of 13". See place-projection.ts for why the cap
      // cannot live in the select.
      photos: capPhotos(row.place_profiles.photos),
      totalPhotos: totalPhotos(row.place_profiles.photos),
      googleStars: row.place_profiles.google_stars_overall,
      googleReviewCount: row.place_profiles.google_review_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // WHEN it left the pool, null while it is still in it.
      claimedAt: row.claimed_at,
      // Derived, never stored — the same helpers every other surface reads,
      // so the Place screen cannot disagree with the admin table about
      // whether a guest can reach this address.
      listed: isPlaceListed(row.state),
      enriched: isPlaceEnriched(row.place_profiles.enriched_at),
      verified: Boolean(verification),
    },
    // Held places are never claimable; a pool place that reached here is —
    // unless the caller's own membership is what made it visible, which is
    // what `myRole` says.
    claimable: myRole === null,
    myRole,
  });
});
