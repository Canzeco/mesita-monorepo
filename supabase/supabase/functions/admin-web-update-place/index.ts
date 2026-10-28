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
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { PLACE_PROFILE_COLUMNS } from "../_shared/place-columns.ts";
import { type ProfilePatch, writePlace } from "../_shared/place-doc.ts";
import { ENRICH_FIELD_LIMITS } from "../_shared/enrich-field-limits.ts";
import { type PlaceHours, sanitiseHours } from "./place-hours.ts";
import { isUrl, URL_FIELDS, type UrlField } from "./place-urls.ts";
import { optString } from "./place-update-utils.ts";
import { fetchPlaceFamilies } from "../_shared/categories.ts";
import { resolveStoredFamily } from "../_shared/profile-family.ts";
import { applyMediaUpdates } from "./place-media-update.ts";
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
import {
  isOperatorField,
  markOperatorFields,
  type OperatorField,
  operatorFieldsInPatch,
} from "../_shared/operator-fields.ts";
import { recordAdminOperatorEvent } from "../_shared/admin-operator-events.ts";

const MAX_DESCRIPTION_LEN = ENRICH_FIELD_LIMITS.description.max;

const READ_ONLY_FIELDS = ["category", "category_label", "mesita_categories", "google_types", "google_source_types", "family_keys"] as const;
const MAX_TAGS = ENRICH_FIELD_LIMITS.tagsPerPlace.max;

const RESERVATION_CHANNELS = new Set(["phone", "whatsapp", "instagram", "web", "none"]);

type UpdateBody = {
  id?: string;
  /** The Mesita name (MESITA-2828). Blank ⇒ the place follows Google's label. */
  name?: string | null;
  // Native fields (google_name, price_level, address, google_maps_url,
  // google_place_id) are Google/Enricher-owned and not editable here: the
  // whitelist below never reads them.
  hours?: PlaceHours | null;
  phone?: string | null;
  /** Refused: the gallery is not edited here (MESITA-2794). */
  photos?: unknown;
  mesita_photos?: unknown;
  // External + social channels
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  whatsapp_url?: string | null;
  opentable_url?: string | null;
  uber_eats_url?: string | null;
  // Place-redesign editable surface (Business-E=YES on the Components spec).
  description?: string | null;
  /** Mesita tags: place_tags slugs, editable since MESITA-2836. Null clears. */
  tags?: string[] | null;
  menu_pdf_url?: string | null;
  // Optional human label paired with menu_pdf_url. Null clears.
  menu_pdf_name?: string | null;
  // Generic products payload. Menu is one subtype under products.menu.
  products?: { menu?: unknown[] | null } | null;
  /** Profile's Actions toggle, sent with the operator's reservation channel. */
  reservations_enabled?: boolean;
  reservation_channel?: string;
  /** Basics' Reset (MESITA-2829): hand these fields back to Enrich. */
  reset_fields?: unknown;
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

  // Auth: super-admins only, like every other admin-web-* door.
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

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
  // from google_source_types in the trigger, the families from the categories
  // in the view. Name, Presentation and Tags are the operator's to edit.
  const readOnly = READ_ONLY_FIELDS.find((field) => field in body);
  if (readOnly) {
    return json(
      { ok: false, code: "read_only_field", error: `${readOnly} is inferred, not edited` },
      400,
    );
  }

  // Build the update payload from the whitelist. Missing keys are not
  // touched. Explicit null clears the field.
  const update: Record<string, unknown> = {};
  // The Mesita name → place_profiles.name (MESITA-2828: stored, the one
  // name). Empty/whitespace CLEARS it and the name-fallback trigger copies
  // Google's label back in, so the place is never nameless.
  if ("name" in body) {
    const n = (body.name ?? "").toString().trim();
    if (n.length > ENRICH_FIELD_LIMITS.placeName.max) {
      return json({ ok: false, error: "name too long" }, 400);
    }
    update.name = n.length > 0 ? n : null;
  }
  if ("hours" in body) {
    const cleaned = sanitiseHours(body.hours);
    if (cleaned === "invalid") {
      return json(
        {
          ok: false,
          error:
            "hours must be a map of weekday → [{open,close}] with HH:MM values",
        },
        400,
      );
    }
    update.hours = cleaned;
  }
  if ("phone" in body) {
    const raw = optString(body.phone, 40);
    // Phones ALWAYS carry a country code (E.164-style prefix). Null/empty
    // still clears; anything else must start with "+".
    if (raw != null && !/^\+[0-9]/.test(raw)) {
      return json(
        {
          ok: false,
          code: "phone_needs_country_code",
          error: "phone must include a country code, e.g. +52 81 8378 2164.",
        },
        400,
      );
    }
    update.phone = raw;
  }
  const mediaError = applyMediaUpdates(body, update);
  if (mediaError) return mediaError;

  // External + social URLs — each optional, each validated to https://.
  for (const field of URL_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field as UrlField];
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
      update[field] = null;
      continue;
    }
    if (!isUrl(raw)) {
      return json(
        { ok: false, error: `${field} must be a valid https:// URL` },
        400,
      );
    }
    update[field] = raw.trim();
  }

  // Place-redesign editable fields.
  if ("description" in body) {
    update.description = optString(body.description, MAX_DESCRIPTION_LEN);
  }
  if ("tags" in body) {
    const raw = body.tags;
    if (raw !== null && raw !== undefined && !Array.isArray(raw)) {
      return json({ ok: false, error: "tags must be a list of slugs" }, 400);
    }
    const tags = [...new Set(
      (raw ?? []).filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean),
    )];
    if (tags.length > MAX_TAGS) {
      return json({ ok: false, error: `at most ${MAX_TAGS} tags` }, 400);
    }
    // An unknown slug is refused by the taxonomy trigger.
    update.tags = tags;
  }
  // Profile's Actions toggle (MESITA-2787). The answer is stored as the
  // operator's reservation channel, the one column a later Enrich cannot
  // overwrite (place_reservations_follow_channel, MESITA-1737). The console
  // sends the channel with the flip: off is 'none'; on keeps the channel it
  // already shows, else 'phone', how the Reservationist books.
  if ("reservations_enabled" in body) {
    const channel = body.reservation_channel;
    if (
      typeof body.reservations_enabled !== "boolean" ||
      typeof channel !== "string" || !RESERVATION_CHANNELS.has(channel) ||
      (channel === "none") === body.reservations_enabled
    ) {
      return json({ ok: false, error: "reservations_enabled needs a matching reservation_channel" }, 400);
    }
    update.reservations_enabled = body.reservations_enabled;
    update.reservation_channel = channel;
  }
  // Basics' Reset (MESITA-2829): a list of operator-owned fields to hand
  // back to Enrich. It may ride alone, with no edit.
  const resetFields: OperatorField[] = [];
  if ("reset_fields" in body) {
    if (!Array.isArray(body.reset_fields) || !body.reset_fields.every(isOperatorField)) {
      return json({ ok: false, error: "reset_fields must list name, description or tags" }, 400);
    }
    resetFields.push(...body.reset_fields);
  }
  if (Object.keys(update).length === 0 && resetFields.length === 0) {
    return json({ ok: false, error: "No editable fields provided" }, 400);
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
        actorUserId: authRes.user.id,
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
    if (error || !row) return json({ ok: false, error: error?.message ?? "Place not found" }, 404);
    place = row as unknown as Record<string, unknown>;
  }

  // An operator's name, Presentation or tags stick through every Enrich
  // (MESITA-2829): a typed value marks the field, a Reset clears the mark.
  const marks = await markOperatorFields(admin, placeId, {
    mark: operatorFieldsInPatch(update),
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

  // Families are the categories' dictionary, derived in the profiles view
  // (MESITA-2834); the row just read back carries them. A vocabulary miss
  // leaves the string off.
  const families = await fetchPlaceFamilies(admin);
  const familyStored = families.length > 0
    ? resolveStoredFamily((place as { family_keys?: unknown }).family_keys, families)
    : undefined;

  await recordAdminOperatorEvent(admin, {
    verb: "edit",
    outcome: "succeeded",
    placeId,
    actorUserId: authRes.user.id,
    source: "admin-web-update-place",
    detail: { fields: Object.keys(update), reset: resetFields },
  });

  return json({ ok: true, place, familyStored });
});
