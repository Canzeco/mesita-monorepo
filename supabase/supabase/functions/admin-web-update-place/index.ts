// Supabase Edge Function — admin-web-update-place
//
// Super-admin only. Updates the editable profile fields of one place — the
// write behind admin's Single Place save bar (manage-single/[id]). Validates
// input, writes via the service role through the place document door, and
// queues the on_update side effects (embeddings). A changed Instagram or
// Facebook URL waits for the shared verifier. The link is stored only when
// that account is connected; a miss refuses the save and writes nothing.
// Does NOT call any other Edge Function.
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
import { sanitizePlaceTags } from "../_shared/tags.ts";
import { type PlaceHours, sanitiseHours } from "./place-hours.ts";
import { isUrl, URL_FIELDS, type UrlField } from "./place-urls.ts";
import { optString } from "./place-update-utils.ts";
import {
  fetchPlaceCategories,
  fetchPlaceFamilies,
} from "../_shared/categories.ts";
import {
  resolveProfileFamily,
  resolveStoredFamily,
} from "../_shared/profile-family.ts";
import { resolveCategoryInput } from "./category-input.ts";
import { applyMediaUpdates } from "./place-media-update.ts";
import {
  reviewPatchForSocialEdit,
  reviewsTileKeyInBody,
} from "./place-social-refresh.ts";
import {
  queuePlaceEmbeddingsOnUpdate,
  updateTouchesEmbeddingInputs,
} from "../_shared/place-embeddings.ts";
import {
  loadEnrichmentTriggers,
  subprocessesFor,
} from "../_shared/enrich-triggers.ts";
import { persistBusinessFieldPins } from "../_shared/field-correction-writer.ts";

const MAX_PHOTOS = ENRICH_FIELD_LIMITS.photos.max;
const MAX_TAGS = ENRICH_FIELD_LIMITS.tagsPerPlace.max;
const MAX_TAG_LEN = ENRICH_FIELD_LIMITS.tagSlugLength.max;
const MAX_DESCRIPTION_LEN = ENRICH_FIELD_LIMITS.description.max;

function normalisePlaceTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  // Lowercase + trim + dedupe in one pass. Empty entries drop out so the
  // form can submit a partially typed list without rejecting the request.
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const t of value) {
    if (typeof t !== "string") continue;
    const norm = t.trim().toLowerCase().slice(0, MAX_TAG_LEN);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    clean.push(norm);
    if (clean.length >= MAX_TAGS) break;
  }
  // Strip mutually exclusive catalog pairs (same rules as Enricher).
  return sanitizePlaceTags(clean).slice(0, MAX_TAGS);
}

type UpdateBody = {
  id?: string;
  mesita_name?: string | null;
  category?: string | null;
  // Native fields (google_name, price_level, address, google_maps_url,
  // google_place_id) are Google/Enricher-owned and not editable here: the
  // whitelist below never reads them.
  hours?: PlaceHours | null;
  phone?: string | null;
  photos?: string[];
  // External + social channels
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  whatsapp_url?: string | null;
  opentable_url?: string | null;
  uber_eats_url?: string | null;
  // Place-redesign editable surface (Business-E=YES on the Components spec).
  description?: string | null;
  menu_pdf_url?: string | null;
  // Optional human label paired with menu_pdf_url. Null clears.
  menu_pdf_name?: string | null;
  // Generic products payload. Menu is one subtype under products.menu.
  products?: { menu?: unknown[] | null } | null;
  tags?: string[];
};

const OPENAI_KEY = Deno.env.get("OPENAI_KEY");

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
        error: `${blocked} is reloaded from the Reviews tab`,
      },
      400,
    );
  }
  const placeId = (body.id ?? "").toString().trim();
  if (!placeId) return json({ ok: false, error: "id is required" }, 400);

  // Build the update payload from the whitelist. Missing keys are not
  // touched. Explicit null clears the field.
  const update: Record<string, unknown> = {};
  // Operator name override → places.mesita_name (`name` is a GENERATED
  // display column, coalesce(mesita_name, google_name), and is not writable).
  // Empty/whitespace CLEARS the override so the place falls back to Google.
  if ("mesita_name" in body) {
    const n = (body.mesita_name ?? "").toString().trim();
    if (n.length > ENRICH_FIELD_LIMITS.placeName.max) {
      return json({ ok: false, error: "name too long" }, 400);
    }
    update.mesita_name = n.length > 0 ? n : null;
  }
  if ("category" in body) {
    const resolved = await resolveCategoryInput(
      admin,
      body.category,
      OPENAI_KEY,
    );
    if (!resolved.ok) {
      return json({ ok: false, error: resolved.error }, 400);
    }
    update.category = resolved.slug;
    update.category_label = resolved.label;
    update.family_keys = resolved.familyKeys;
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
  const mediaError = applyMediaUpdates(body, update, MAX_PHOTOS);
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
    const tags = normalisePlaceTags(body.tags);
    if (!tags) {
      return json(
        { ok: false, error: "tags must be an array of strings" },
        400,
      );
    }
    update.tags = tags;
  }
  if (Object.keys(update).length === 0) {
    return json({ ok: false, error: "No editable fields provided" }, 400);
  }

  // A changed social URL waits here. A miss refuses the whole save
  // before either write, so a dead account never lands and the rest of
  // the draft stays unwritten. A connected account's patch is written
  // first, so the link, the flag, and the numbers land together. The
  // view write below repeats the link and the count (those columns are
  // on the view) and returns the row the console paints.
  const social = await reviewPatchForSocialEdit(admin, placeId, update);
  if (!social.ok) {
    return json(
      {
        ok: false,
        code: social.code,
        error: social.error,
        retryable: social.retryable,
        fields: social.fields,
      },
      400,
    );
  }
  const reviewPatch = social.patch;
  if (Object.keys(reviewPatch).length > 0) {
    const reviewed = await writePlace(admin, {
      table: "place_profiles",
      mode: "update",
      id: placeId,
      patch: reviewPatch,
    });
    if (!reviewed.ok) {
      return json({ ok: false, error: `reviews: ${reviewed.error}` }, 500);
    }
    if ("instagram_followers_count" in reviewPatch) {
      update.instagram_followers_count = reviewPatch.instagram_followers_count;
    }
    if ("facebook_followers" in reviewPatch) {
      update.facebook_followers = reviewPatch.facebook_followers;
    }
  }

  const updRes = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: placeId,
    patch: update as ProfilePatch,
    select: PLACE_PROFILE_COLUMNS,
  });

  if (!updRes.ok) {
    return json(
      {
        ok: false,
        error: `place_update: ${updRes.error}`,
        code: updRes.code ?? null,
      },
      400,
    );
  }
  const place = updRes.row as Record<string, unknown>;
  if ("instagram_found" in reviewPatch) {
    place.instagram_found = reviewPatch.instagram_found;
  }
  if ("facebook_found" in reviewPatch) {
    place.facebook_found = reviewPatch.facebook_found;
  }
  if ("instagram_followers_count" in reviewPatch) {
    place.instagram_followers_count = reviewPatch.instagram_followers_count;
  }
  if ("facebook_followers" in reviewPatch) {
    place.facebook_followers = reviewPatch.facebook_followers;
  }

  const pinRes = await persistBusinessFieldPins(admin, placeId, update);
  if (!pinRes.ok) {
    return json(
      { ok: false, error: `field_pin: ${pinRes.error}` },
      500,
    );
  }

  // The on_update row's `embedding` cell re-synthesises when the blurb
  // inputs change. The reviews verifier already ran above; it is not this
  // trigger. A disabled row buys nothing.
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

  // Restamp Family for the row just written, so the profile does not re-read
  // to learn what the new category's families are. A vocabulary miss leaves
  // the strings off; the save itself already landed.
  const [categories, families] = await Promise.all([
    fetchPlaceCategories(admin),
    fetchPlaceFamilies(admin),
  ]);
  const row = place as { category?: unknown; family_keys?: unknown };
  const family = categories.length > 0 && families.length > 0
    ? resolveProfileFamily({
      category: row.category,
      familyKeys: row.family_keys,
      categories,
      families,
    })
    : undefined;
  const familyStored = families.length > 0
    ? resolveStoredFamily(row.family_keys, families)
    : undefined;

  return json({ ok: true, place, family, familyStored });
});
