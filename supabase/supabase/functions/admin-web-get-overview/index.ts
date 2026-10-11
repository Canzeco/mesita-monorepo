// Supabase Edge Function — admin-web-get-overview
//
// Super-admin only. The full place row admin's Single Place edits
// (manage-single/[id]), plus the State facts its State and Crenup boxes read,
// in one round trip.
//
// WAS business-web-get-overview (MESITA-2090). That function served three
// readers — the business console's sidebar (every place the caller held), its
// Place screen (the active place plus recent tickets, the rewards config and
// the staff PIN) and, through its super-admin branch, this admin screen. The
// business console is deleted in the MVP First Stage cut, so only the
// super-admin branch survives, under the name of the one app that calls it:
// the EF name is the ACL (ef-caller-acl.test.ts). Gone with the business
// readers: the place_members branch, recent tickets, `rewardsConfig`, the
// Check PIN, and the Mesita Pay / Credits / orders acceptance bits — no admin
// screen reads any of them.
//
// Body:     { placeId }   (legacy aliases via readPlaceIdAlias)
// Response: { ok: true, isSuperAdmin: true, active: { place } }
//           `active.place` is the AdminPlace (apps/web-admin
//           components/place-manage/actions.ts). The envelope keeps the
//           old shape so the client's one reader did not have to move.
// Auth:     caller must be in public.super_admins.
//
// Local:  supabase functions serve admin-web-get-overview
// Deploy: supabase functions deploy admin-web-get-overview

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { PLACE_BUSINESS_COLUMNS as PLACE_PROFILE_COLUMNS } from "../_shared/place-columns.ts";
import { isPlaceListed, isPlaceRequested, isPlaceSeeded } from "../_shared/place-state.ts";
import { CRENUP_LABELS_IN_ORDER, CRENUP_TOTAL } from "../_shared/crenup-ladder.ts";
import type { EnrichmentMap, FunctionState } from "../_shared/schema-catalog.ts";
import { operatorFunctionStates } from "../_shared/schema-catalog.ts";

// The Embeddings card (MESITA-720) reads these. Never part of the public
// column set: a heavy field only this screen and admin-web-search-places need.
const PLACE_ADMIN_EMBEDDING_COLUMNS =
  ", embedding, embedding_source_hash, embedding_source_text, name_embedding, name_embedding_hash";

// State (MESITA-1186). The State box answers `seeded` off the identity spine,
// so the read needs Google's id. It must never widen PLACE_PUBLIC_COLUMNS.
const PLACE_ADMIN_STATE_COLUMNS = ", google_place_id";

type Body = {
  placeId?: string;
  /** @deprecated MESITA-26; prefer placeId (MESITA-942). */
  activeUnitId?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const body = await readJsonOr<Body>(req, {});
  const placeId = readPlaceIdAlias(body) || null;
  if (!placeId) {
    return json({ ok: false, error: "placeId is required" }, 400);
  }

  // One round trip for both: the place row, and the materialized enrichment
  // map the State box's `enriched` high-water reads from (MESITA-1249).
  // `enrichment` is read off `place_profiles` directly, not `profiles` — it is
  // deliberately NOT in the profiles view's column list (adding it means
  // rebuilding the view's two INSTEAD OF triggers).
  const [placeRow, enrichmentRow] = await Promise.all([
    admin
      .from("profiles")
      .select(
        PLACE_PROFILE_COLUMNS + PLACE_ADMIN_EMBEDDING_COLUMNS + PLACE_ADMIN_STATE_COLUMNS,
      )
      .eq("id", placeId)
      .maybeSingle(),
    admin
      .from("place_profiles")
      .select("enrichment")
      .eq("id", placeId)
      .maybeSingle(),
  ]);
  if (placeRow.error) {
    return json({ ok: false, error: placeRow.error.message }, 500);
  }
  if (!placeRow.data) {
    return json({ ok: false, error: "Place not found" }, 404);
  }
  const placeFields = placeRow.data as unknown as Record<string, unknown>;

  // Best effort: a missing/null map falls back to the CREATED-floor default,
  // which reads as 0 — the State box and the catalog table MUST show the same
  // number either way, a state that disagrees with itself across two screens
  // being worse than no state.
  if (enrichmentRow.error) {
    console.error("[admin-web-get-overview] place_profiles.enrichment:", enrichmentRow.error.message);
  }
  const enrichmentMap = (enrichmentRow.data?.enrichment as EnrichmentMap | null) ??
    { functions: {}, highWater: 0, blockedAt: null };

  // The pipeline facts of State ride along computed, never stored — the same
  // helpers admin-web-search-places uses for the Single Place table, so the
  // box and the table can never disagree. `name` arrives already resolved: it
  // is a generated column (mesita_name → google_name).
  const place = {
    ...placeFields,
    seeded: isPlaceSeeded(placeFields.google_place_id),
    listed: isPlaceListed(placeFields.state),
    requested: isPlaceRequested({
      requestCount: placeFields.request_count,
      contentState: placeFields.content_state,
    }),
    enrich_crenup: enrichmentMap.highWater,
    enrich_crenup_total: CRENUP_TOTAL,
    enrich_crenup_labels: CRENUP_LABELS_IN_ORDER,
    // WHY it stopped, beside where: function 1 can FAIL a place Google
    // reports permanently closed, so 0 carries two different facts.
    enrich_crenup_blocked: enrichmentMap.blockedAt,
    enrich_functions: operatorFunctionStates(
      enrichmentMap.functions as Partial<Record<string, FunctionState>>,
    ),
  };

  return json({
    ok: true,
    isSuperAdmin: true,
    active: { place },
  });
});
