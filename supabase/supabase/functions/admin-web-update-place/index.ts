// Supabase Edge Function — admin-web-update-place
//
// Super-admin only. Updates the editable profile fields of one place — the
// write behind admin's Single Place save bar (manage-single/[id]). Validates
// input, writes via the service role through the place document door, and
// queues the on_update side effects (embeddings). A changed link is stored
// as a URL. It does not Sync. Sync is the Reviews header and the enrichment
// draft, through one core. Does NOT call any other Edge Function.
//
// WAS business-web-update-place (MESITA-2090). The business console that
// owned it is deleted in the MVP First Stage cut, so the one surviving caller
// names it: the EF name is the ACL (ef-caller-acl.test.ts). Gone with the
// business console: the place_members editor/owner gate (requireEditor), and
// the rewards fields — the four promo rates, monthly_promo_cap, the
// partnership-gated strategy switch and the Promos segmentation toggles. No
// admin screen sends any of them.
//
// Local:  supabase functions serve admin-web-update-place
// Deploy: supabase functions deploy admin-web-update-place

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { PLACE_PROFILE_COLUMNS } from "../_shared/place-columns.ts";
import { type ProfilePatch, writePlace } from "../_shared/place-doc.ts";
import { fetchPlaceFamilies } from "../_shared/categories.ts";
import { resolveStoredFamily } from "../_shared/profile-family.ts";
import { reviewsOwnedBodyKey as reviewsTileKeyInBody } from "../_shared/review-sources.ts";
import {
  queuePlaceEmbeddingsOnUpdate,
  updateTouchesEmbeddingInputs,
} from "../_shared/place-embeddings.ts";
import {
  loadEnrichmentTriggers,
  subprocessesFor,
} from "../_shared/enrich-triggers.ts";
import { persistBusinessFieldPins } from "../_shared/field-correction-writer.ts";
import { markOperatorFields, operatorFieldsInPatch } from "../_shared/operator-fields.ts";
import { recordAdminOperatorEvent } from "../_shared/admin-operator-events.ts";
import { buildPlaceUpdate, READ_ONLY_FIELDS, type UpdateBody } from "./build-update.ts";

serveJson("admin-web-update-place", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  // Parse + validate.
  const bodyRes = await readJson<UpdateBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const blocked = reviewsTileKeyInBody(body);
  if (blocked) {
    return json(
      {
        ok: false,
        code: "reviews_owned",
        error: `${blocked} is updated by Sync`,
      },
      400,
    );
  }
  const placeId = (body.id ?? "").toString().trim();
  if (!placeId) return json({ ok: false, error: "id is required" }, 400);
  // The Google fields are Google's own (MESITA-2836): the categories derive
  // from google_source_types in the trigger. Name, Presentation, Tags and,
  // since MESITA-2893, Families are the operator's to edit.
  const readOnly = READ_ONLY_FIELDS.find((field) => field in body);
  if (readOnly) {
    return json(
      { ok: false, code: "read_only_field", error: `${readOnly} is inferred, not edited` },
      400,
    );
  }

  const families = await fetchPlaceFamilies(admin);
  const built = buildPlaceUpdate(body, families);
  if (!built.ok) return built.response;
  const { update, familyKeys, resetFields } = built;

  // Families first, so the profile row read back below already carries them
  // (profiles.family_keys is the stored list, MESITA-2891).
  if (familyKeys !== undefined) {
    const famRes = await writePlace(admin, {
      table: "place_profiles",
      mode: "update",
      id: placeId,
      patch: { family_keys: familyKeys },
    });
    if (!famRes.ok) {
      await recordAdminOperatorEvent(admin, {
        verb: "edit",
        outcome: "failed",
        placeId,
        actorUserId: user.id,
        source: "admin-web-update-place",
        detail: { error: famRes.error, code: famRes.code ?? null, field: "family_keys" },
      });
      return json(
        { ok: false, error: `family_keys: ${famRes.error}`, code: famRes.code ?? null },
        400,
      );
    }
    console.log(JSON.stringify({
      fn: "families",
      caller: "admin-web-update-place",
      placeId,
      source: "operator",
      picked: familyKeys ?? [],
      outcome: familyKeys ? "written" : "cleared",
    }));
  }

  let place: Record<string, unknown>;
  if (Object.keys(update).length > 0) {
    const updRes = await writePlace(admin, {
      table: "profiles",
      mode: "update",
      id: placeId,
      patch: update as ProfilePatch,
      select: PLACE_PROFILE_COLUMNS,
    });

    if (!updRes.ok) {
      await recordAdminOperatorEvent(admin, {
        verb: "edit",
        outcome: "failed",
        placeId,
        actorUserId: user.id,
        source: "admin-web-update-place",
        detail: { error: updRes.error, code: updRes.code ?? null },
      });
      return json(
        {
          ok: false,
          error: `place_update: ${updRes.error}`,
          code: updRes.code ?? null,
        },
        400,
      );
    }
    place = updRes.row as Record<string, unknown>;

    const pinRes = await persistBusinessFieldPins(admin, placeId, update);
    if (!pinRes.ok) {
      return json(
        { ok: false, error: `field_pin: ${pinRes.error}` },
        500,
      );
    }
  } else {
    const { data: row, error } = await admin
      .from("profiles")
      .select(PLACE_PROFILE_COLUMNS)
      .eq("id", placeId)
      .maybeSingle();
    // A failed read is the server's fault (500); only a missing row is a 404.
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!row) return json({ ok: false, error: "Place not found" }, 404);
    place = row as unknown as Record<string, unknown>;
  }

  // An operator's name, Presentation, tags or families stick through every
  // Enrich (MESITA-2829, MESITA-2893): a typed value marks the field, a Reset
  // clears the mark.
  const marks = await markOperatorFields(admin, placeId, {
    mark: operatorFieldsInPatch(
      familyKeys === undefined ? update : { ...update, family_keys: familyKeys },
    ),
    clear: resetFields,
  });
  if (!marks.ok) {
    return json({ ok: false, error: `operator_fields: ${marks.error}` }, 500);
  }
  place.operator_fields = marks.fields;

  // The on_update row's `embedding` cell re-synthesises when the blurb
  // inputs change. Sync is not this save. A disabled row buys nothing.
  const onUpdateBuys = subprocessesFor(
    await loadEnrichmentTriggers(admin),
    "on_update",
  );

  if (
    onUpdateBuys.includes("embedding") && updateTouchesEmbeddingInputs(update)
  ) {
    queuePlaceEmbeddingsOnUpdate({
      admin,
      placeId,
      apiKey: Deno.env.get("OPENAI_KEY")?.trim(),
      logPrefix: "admin-web-update-place/on-update",
      via: "update",
    });
  }

  // The row just read back carries the stored families (MESITA-2891); this
  // names them. A vocabulary miss leaves the string off.
  const familyStored = families.length > 0
    ? resolveStoredFamily((place as { family_keys?: unknown }).family_keys, families)
    : undefined;

  await recordAdminOperatorEvent(admin, {
    verb: "edit",
    outcome: "succeeded",
    placeId,
    actorUserId: user.id,
    source: "admin-web-update-place",
    detail: {
      fields: familyKeys === undefined ? Object.keys(update) : [...Object.keys(update), "family_keys"],
      reset: resetFields,
    },
  });

  return json({ ok: true, place, familyStored });
});
