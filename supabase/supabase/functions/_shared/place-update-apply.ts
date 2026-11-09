// One profile save, two doors (MESITA-3103): admin-web-update-place (a
// super-admin in web-admin) and business-web-update-place (whoever runs the
// place, or a super-admin, in web-business). The body was admin-web-update-
// place's; it moved here so both EFs run the same validation, writes, pins,
// operator-field marks, embedding refresh and ledger row.
//
// It does not Sync. Sync is the Reviews header and the enrichment draft, through
// one core (save-does-not-sync.test.ts pins it).
//
// An OWNER may write only OWNER_WRITABLE_FIELDS: the profile a guest reads.
// Mesita's switches (reservations, prepayments) stay the operator's; any other
// key in an owner's body is refused whole with `not_owner_field`, never
// silently dropped.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";
import { PLACE_PROFILE_COLUMNS } from "./place-columns.ts";
import { type ProfilePatch, writePlace } from "./place-doc.ts";
import { fetchPlaceFamilies } from "./categories.ts";
import { resolveStoredFamily } from "./profile-family.ts";
import { reviewsOwnedBodyKey as reviewsTileKeyInBody } from "./review-sources.ts";
import { queuePlaceEmbeddingsOnUpdate, updateTouchesEmbeddingInputs } from "./place-embeddings.ts";
import { loadEnrichmentTriggers, subprocessesFor } from "./enrich-triggers.ts";
import { persistBusinessFieldPins } from "./field-correction-writer.ts";
import { markOperatorFields, operatorFieldsInPatch } from "./operator-fields.ts";
import { recordAdminOperatorEvent } from "./admin-operator-events.ts";
import { buildPlaceUpdate, READ_ONLY_FIELDS, type UpdateBody } from "./place-update.ts";
import { firstForeignPhoto } from "./place-media-update.ts";

export type PlaceUpdateActor = "admin" | "owner";

/** What the place's owner edits: the profile guests read. */
export const OWNER_WRITABLE_FIELDS = [
  "name",
  "description",
  "hours",
  "phone",
  "website_url",
  "instagram_url",
  "facebook_url",
  "whatsapp_url",
  "opentable_url",
  "uber_eats_url",
  "tags",
  "family_keys",
  "menu_pdf_url",
  "menu_pdf_name",
  "products",
  // The gallery, hero first (MESITA-3504): only what the place already
  // shows or uploaded itself (firstForeignPhoto).
  "photos",
  // The round profile picture (MESITA-3528): same guard as photos.
  "profile_photo",
  // Basics' Reset hands an edited field back to Enrich; an owner may undo
  // their own edit.
  "reset_fields",
] as const;

const OWNER_KEYS: ReadonlySet<string> = new Set(["id", ...OWNER_WRITABLE_FIELDS]);

/** The first key an owner may not send, or null. Pure. */
export function firstNonOwnerField(body: Record<string, unknown>): string | null {
  for (const key of Object.keys(body)) {
    if (!OWNER_KEYS.has(key)) return key;
  }
  return null;
}

export async function applyPlaceUpdate(
  admin: SupabaseClient,
  body: UpdateBody,
  opts: { actor: PlaceUpdateActor; userId: string; source: string },
): Promise<Response> {
  const { actor, userId, source } = opts;

  if (actor === "owner") {
    const refused = firstNonOwnerField(body as Record<string, unknown>);
    if (refused) {
      return json(
        { ok: false, code: "not_owner_field", error: `${refused} is set by Mesita, not by the place` },
        400,
      );
    }
  }

  const blocked = reviewsTileKeyInBody(body);
  if (blocked) {
    return json({ ok: false, code: "reviews_owned", error: `${blocked} is updated by Sync` }, 400);
  }
  const placeId = (body.id ?? "").toString().trim();
  if (!placeId) return json({ ok: false, error: "id is required" }, 400);
  // The Google fields are Google's own (MESITA-2836): the categories derive
  // from google_source_types in the trigger.
  const readOnly = READ_ONLY_FIELDS.find((field) => field in body);
  if (readOnly) {
    return json({ ok: false, code: "read_only_field", error: `${readOnly} is inferred, not edited` }, 400);
  }

  const pickedPicture = typeof body.profile_photo === "string" && body.profile_photo.trim() !== ""
    ? body.profile_photo.trim()
    : null;
  if (("photos" in body && Array.isArray(body.photos)) || pickedPicture) {
    const { data: cur, error: curErr } = await admin.from("profiles").select("photos").eq("id", placeId).maybeSingle();
    if (curErr) return json({ ok: false, error: curErr.message }, 500);
    if (!cur) return json({ ok: false, error: "Place not found" }, 404);
    // The profile picture passes the same guard (MESITA-3528): a photo the
    // gallery shows (before or after this save) or one the place uploaded.
    const sent = Array.isArray(body.photos)
      ? (body.photos as unknown[]).filter((u): u is string => typeof u === "string").map((u) => u.trim()).filter(Boolean)
      : [];
    const current = Array.isArray(cur.photos) ? (cur.photos as string[]) : [];
    const ctx = { placeId, supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "" };
    // The gallery: only what it already shows, or this place's uploads.
    // The picture: also any photo the same save puts in the gallery.
    const foreign = firstForeignPhoto(sent, { ...ctx, current }) ??
      (pickedPicture ? firstForeignPhoto([pickedPicture], { ...ctx, current: [...current, ...sent] }) : null);
    if (foreign) {
      return json({ ok: false, code: "photo_not_ours", error: "A photo must be one the place shows or uploaded here" }, 400);
    }
  }

  const families = await fetchPlaceFamilies(admin);
  const built = buildPlaceUpdate(body, families);
  if (!built.ok) return built.response;
  const { update: builtUpdate, familyKeys, resetFields } = built;
  // profile_photo lives on place_profiles only: the profiles view computes it
  // (coalesce with the cover) and its INSTEAD OF writer would drop it.
  const { profile_photo: profilePhoto, ...update } = builtUpdate as Record<string, unknown>;
  if ("profile_photo" in builtUpdate) {
    const picRes = await writePlace(admin, {
      table: "place_profiles",
      mode: "update",
      id: placeId,
      patch: { profile_photo: (profilePhoto as string | null) ?? null },
    });
    if (!picRes.ok) {
      return json({ ok: false, error: `profile_photo: ${picRes.error}`, code: picRes.code ?? null }, 400);
    }
  }

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
        actorUserId: userId,
        source,
        detail: { error: famRes.error, code: famRes.code ?? null, field: "family_keys", actor },
      });
      return json({ ok: false, error: `family_keys: ${famRes.error}`, code: famRes.code ?? null }, 400);
    }
    console.log(JSON.stringify({
      fn: "families",
      caller: source,
      placeId,
      source: actor === "owner" ? "owner" : "operator",
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
        actorUserId: userId,
        source,
        detail: { error: updRes.error, code: updRes.code ?? null, actor },
      });
      return json({ ok: false, error: `place_update: ${updRes.error}`, code: updRes.code ?? null }, 400);
    }
    place = updRes.row as Record<string, unknown>;

    const pinRes = await persistBusinessFieldPins(admin, placeId, update);
    if (!pinRes.ok) return json({ ok: false, error: `field_pin: ${pinRes.error}` }, 500);
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

  // A typed name, Presentation, tags or families stick through every Enrich
  // (MESITA-2829, MESITA-2893): a typed value marks the field, a Reset clears
  // the mark. An owner's edit sticks the same way an operator's does.
  const marks = await markOperatorFields(admin, placeId, {
    mark: operatorFieldsInPatch(familyKeys === undefined ? update : { ...update, family_keys: familyKeys }),
    clear: resetFields,
  });
  if (!marks.ok) return json({ ok: false, error: `operator_fields: ${marks.error}` }, 500);
  place.operator_fields = marks.fields;
  // The place's own profile picture pick (MESITA-3528), as the place read
  // sends it, so a save never reads as "follows the cover".
  const { data: pickRow, error: pickErr } = await admin
    .from("place_profiles")
    .select("profile_photo")
    .eq("id", placeId)
    .maybeSingle();
  if (pickErr) return json({ ok: false, error: `profile_photo: ${pickErr.message}` }, 500);
  place.profile_photo_pick = (pickRow as { profile_photo?: string | null } | null)?.profile_photo ?? null;

  // The on_update row's `embedding` cell re-synthesises when the blurb inputs
  // change. A disabled row buys nothing.
  const onUpdateBuys = subprocessesFor(await loadEnrichmentTriggers(admin), "on_update");
  if (onUpdateBuys.includes("embedding") && updateTouchesEmbeddingInputs(update)) {
    queuePlaceEmbeddingsOnUpdate({
      admin,
      placeId,
      apiKey: Deno.env.get("OPENAI_KEY")?.trim(),
      logPrefix: `${source}/on-update`,
      via: "update",
    });
  }

  const familyStored = families.length > 0
    ? resolveStoredFamily((place as { family_keys?: unknown }).family_keys, families)
    : undefined;

  await recordAdminOperatorEvent(admin, {
    verb: "edit",
    outcome: "succeeded",
    placeId,
    actorUserId: userId,
    source,
    detail: {
      fields: familyKeys === undefined ? Object.keys(update) : [...Object.keys(update), "family_keys"],
      reset: resetFields,
      actor,
    },
  });

  return json({ ok: true, place, familyStored });
}
