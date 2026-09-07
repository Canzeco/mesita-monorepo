// Supabase Edge Function — business-web-get-place
//
// ONE place, by id, for the console's Place screen.
//
// It exists because business-web-get-overview cannot answer this question.
// For a non-super-admin that EF resolves places purely from
// `project_members`, and an ORG-CLAIMED place has no such row — the
// organization holds it through `projects.organization_id`. Asking overview
// for one therefore returns nothing, or worse, a DIFFERENT place.
//
// Auth, in the same two shapes the listing already has:
//   held place — membership in the holding organization, any role. Reading
//                a portfolio is a membership fact, exactly as in
//                business-web-list-places scope=org.
//   pool place — any signed-in account, which is precisely what
//                business-web-list-places scope=public already exposes.
//
// A place you may not see is 404, never 403: an organization you are not in
// must not be able to tell you which places it holds.
//
// The pool predicate is the shared one (_shared/place-claim.ts) for the
// same reason the listing uses it — a place directly owned through
// project_members is NOT in the pool even with organization_id null, and
// three surfaces disagreeing about that is how a stranger reads someone
// else's live restaurant.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { orgRoleFor } from "../_shared/org-membership.ts";
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

  // The project row carries the commercial facts and the holder; the
  // embedded place_profiles row carries what the address IS. One round trip, the
  // same join business-web-list-places uses.
  //
  // The column list lives in place-projection.ts so a test can assert the
  // audience boundary — `plan` and `listing_type` and the strike columns are
  // named there and proven absent, rather than promised in a comment here.
  const { data, error } = await admin
    .from("projects")
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
    organization_id: string | null;
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
  let holder:
    | { organizationId: string; organizationName: string; claimedAt: string | null; myRole: string }
    | null = null;
  let myDirectRole: string | null = null;

  if (row.organization_id) {
    const myRole = await orgRoleFor(admin, authRes.user, row.organization_id);
    if (!myRole) {
      console.error(
        `[get-place] not a member: place=${placeId} org=${row.organization_id}`,
      );
      return json(NOT_FOUND, 404);
    }
    const { data: orgRow } = await admin
      .from("organizations")
      .select("name")
      .eq("id", row.organization_id)
      .maybeSingle();
    holder = {
      organizationId: row.organization_id,
      organizationName: (orgRow as { name?: string } | null)?.name ?? "Unknown organization",
      claimedAt: row.claimed_at,
      myRole,
    };
  } else {
    // In no organization. Visible when the caller holds a DIRECT membership
    // (the old-style owned place — MESITA-1537 E-E1: those operators keep a
    // surface when the legacy console dies) or when the place is genuinely
    // pooled; a stranger's directly-owned place stays a uniform 404.
    const { data: directRow } = await admin
      .from("project_members")
      .select("role")
      .eq("place_id", placeId)
      .eq("manager_id", authRes.user.id)
      .maybeSingle();
    const directRole = (directRow as { role?: string } | null)?.role ?? null;
    if (!directRole && !(await isPlaceClaimable(admin, placeId))) {
      console.error(`[get-place] directly owned, not pooled: ${placeId}`);
      return json(NOT_FOUND, 404);
    }
    if (directRole) myDirectRole = directRole;
  }

  // Verified is an APPROVED verification on the place, whoever requested
  // it: the proof belongs to the address, not to the account that filed
  // it. (business-web-get-verification answers a different question — how
  // is MY request going — so it filters by requester and cannot be reused.)
  const { data: verification } = await admin
    .from("project_verifications")
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
      // The raw projects.state. `listed` is what the console gates on; this
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
      // Derived, never stored — the same helpers every other surface reads,
      // so the Place screen cannot disagree with the admin table about
      // whether a guest can reach this address.
      listed: isPlaceListed(row.state),
      enriched: isPlaceEnriched(row.place_profiles.enriched_at),
      verified: Boolean(verification),
    },
    holder,
    // Held places are never claimable; a pool place that reached here is —
    // unless the caller's own direct membership is what made it visible
    // (an old-style owned place is not the pool).
    claimable: row.organization_id === null && myDirectRole === null,
    myDirectRole,
  });
});
