// Supabase Edge Function — business-web-update-project
//
// Authenticated. Updates editable fields on a place the caller owns or
// manages. Self-contained: verifies the JWT, checks project_members membership
// itself, validates input, writes via service role. Does NOT call any other
// Edge Function.
//
// Local:  supabase functions serve business-web-update-project
// Deploy: supabase functions deploy business-web-update-project

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireEditor,
} from "../_shared/auth.ts";
import { isEmailish } from "../_shared/input.ts";
import { PLACE_BUSINESS_COLUMNS } from "../_shared/place-columns.ts";
import { isServingChannel, type ProfilePatch, writePlace } from "../_shared/place-doc.ts";
import { ENRICH_FIELD_LIMITS } from "../_shared/enrich-field-limits.ts";
import { sanitizePlaceTags } from "../_shared/tags.ts";
import { type PlaceHours, sanitiseHours } from "./project-hours.ts";
import { isUrl, URL_FIELDS, type UrlField } from "./project-urls.ts";
import { normalisePromoRate, PROMO_RATE_FIELDS } from "../_shared/promo-rates.ts";
import { ratesFromPlace } from "../_shared/promo-strategy.ts";
import {
  applyListingTypeToPatch,
  effectiveRatesAfterPatch,
} from "../_shared/partner-derivation.ts";
import { logStrategySwitch } from "../_shared/strategy-switch-log.ts";
import {
  isMissingCategoryLabelColumnError,
  optString,
} from "./project-update-utils.ts";
import { resolveCategoryInput } from "./category-input.ts";
import { applyMediaUpdates } from "./project-media-update.ts";
import {
  loadPreviousSocialUrlsForRefresh,
  queueSocialFollowersRefresh,
} from "./project-social-refresh.ts";
import {
  queuePlaceEmbeddingsOnUpdate,
  updateTouchesEmbeddingInputs,
} from "../_shared/place-embeddings.ts";
import {
  loadEnrichmentTriggers,
  subprocessesFor,
} from "../_shared/enrich-triggers.ts";

const MAX_PHOTOS = ENRICH_FIELD_LIMITS.photos.max;
const MAX_TAGS = ENRICH_FIELD_LIMITS.tagsPerPlace.max;
const MAX_TAG_LEN = ENRICH_FIELD_LIMITS.tagSlugLength.max;
// Matches the business Place editor's About field cap (PLACE_DESCRIPTION_MAX).
const MAX_DESCRIPTION_LEN = 2000;

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
  // Strip mutually exclusive catalog pairs (same rules as Intaker).
  return sanitizePlaceTags(clean).slice(0, MAX_TAGS);
}

type UpdateBody = {
  id?: string;
  name?: string | null;
  category?: string | null;
  vibe?: string | null;
  // NOTE: `price_level` is deliberately NOT editable here. It is inferred
  // from Google Places during Enrich-Research and must not be overridden
  // by admin, business, or any client.
  // NOTE: `google_maps_url` / `google_place_id` are native — seeded at create
  // from the Google Place ID spine; the EF rejects manual writes (MESITA-468).
  // ISO 4217 code. Mesita defaults every place to MXN; the business
  // can switch to USD/EUR/etc. only when we extend coverage outside
  // Mexico. Kept as text so the EF doesn't hard-code an enum.
  currency?: string | null;
  status?: "active" | "paused" | "archived";
  fiscal_type?: "formal" | "informal";
  // NOTE: `plan` is deliberately NOT editable here. Plan changes are billing
  // and go through business-web-change-subscription (Stripe), so a client can't
  // grant itself Verified (plan=pro; ultra legacy) with a plain profile update.
  // NOTE: `address` is native (Google/Intaker-sourced) and deliberately NOT
  // editable here — kept in the type only so stale clients get the reject.
  address?: string | null;
  closes_at?: string | null;
  hours?: PlaceHours | null;
  phone?: string | null;
  pitch?: string | null;
  story?: string | null;
  // Four per-tier promo rates (migration 0032; tightened MESITA-543). Welcome
  // variants fire on a guest's first visit at the place; the unprefixed
  // variants apply on every visit afterwards. Legal set: {10, 20, 30, 40, 50}.
  welcome_free_rate?: number | null;
  welcome_premium_rate?: number | null;
  free_rate?: number | null;
  premium_rate?: number | null;
  // Place-level monthly promo spend cap (migration 0038), in the place's
  // currency. One of 200, 500, 1000 or null (no cap).
  monthly_promo_cap?: number | null;
  photos?: string[];
  // External + social channels
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  whatsapp_url?: string | null;
  opentable_url?: string | null;
  resy_url?: string | null;
  uber_eats_url?: string | null;
  x_url?: string | null;
  threads_url?: string | null;
  reddit_url?: string | null;
  didi_food_url?: string | null;
  // Native — rejected below (kept in the type so stale clients get the reject).
  google_maps_url?: string | null;
  google_place_id?: string | null;
  // Plain contact (not URL-shaped)
  email?: string | null;
  // Routing: which contact each rail reaches the place on (MESITA-1208).
  // 'phone' is the only served channel; null clears the rail.
  reservation_channel?: string | null;
  reservation_target?: string | null;
  order_channel?: string | null;
  order_target?: string | null;
  // Place-redesign editable surface (Business-E=YES on the Components spec).
  description?: string | null;
  menu_pdf_url?: string | null;
  // Optional human label paired with menu_pdf_url. Null clears.
  menu_pdf_name?: string | null;
  // Alias fields used by the products-first UI.
  product_catalog_url?: string | null;
  product_catalog_name?: string | null;
  // Generic products payload. Menu is one subtype under products.menu.
  products?: { menu?: unknown[] | null } | null;
  tags?: string[];
  // Promos page section toggles — Basic + Advanced segmentation can be
  // collapsed by the business. Defaults align with the migration: basic
  // on, advanced off.
  segmentation_basic_enabled?: boolean;
  segmentation_advanced_enabled?: boolean;
};

const EDITABLE_STATUSES = new Set(["active", "paused", "archived"]);
const OPENAI_KEY = Deno.env.get("OPENAI_KEY");
const APIFY_KEY = Deno.env.get("APIFY_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);

  // Parse + validate.
  const bodyRes = await readJson<UpdateBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const projectId = (body.id ?? "").toString().trim();
  if (!projectId) return json({ ok: false, error: "id is required" }, 400);

  // Auth: editors/owners only (viewers are read-only). Super-admins bypass
  // via the super_admins allowlist baked into requireEditor.
  const memberRes = await requireEditor(admin, authRes.user, projectId);
  if (!memberRes.ok) return memberRes.response;

  // Build the update payload from the whitelist. Missing keys are not
  // touched. Explicit null clears the field.
  const update: Record<string, unknown> = {};
  // Operator name override → places.mesita_name. `name` itself is a GENERATED
  // display column (coalesce(mesita_name, google_name)) and is not writable, so
  // a caller sending `name` is expressing "label this place", which is exactly
  // mesita_name. Both spellings are accepted; `mesita_name` wins if both arrive.
  // Empty/whitespace CLEARS the override so the place falls back to Google.
  if ("mesita_name" in body || "name" in body) {
    const raw = "mesita_name" in body ? body.mesita_name : body.name;
    const n = (raw ?? "").toString().trim();
    if (n.length > ENRICH_FIELD_LIMITS.placeName.max) {
      return json({ ok: false, error: "name too long" }, 400);
    }
    update.mesita_name = n.length > 0 ? n : null;
  }
  if ("google_name" in body) {
    return json(
      {
        ok: false,
        code: "google_name_via_enrich",
        error:
          "google_name is the cached Google Places label, refreshed by the Intaker. Change it on the Google Business Profile, then re-enrich. To label the place inside Mesita, set mesita_name.",
      },
      400,
    );
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
  if ("vibe" in body) update.vibe = optString(body.vibe, 80);
  if ("price_level" in body) {
    // Price is enrich-only (Google Places). Reject so stale clients learn
    // the contract — same posture as `plan` via billing.
    return json(
      {
        ok: false,
        code: "price_via_enrich",
        error:
          "price_level is set by Enrich-Research from Google Places and cannot be updated manually.",
      },
      400,
    );
  }
  // currency: ISO 4217 uppercase code, 3 chars. Reject anything else
  // — accidental empty strings or longer strings would corrupt every
  // monetary render downstream.
  if ("currency" in body) {
    const c = (body.currency ?? "").toString().trim().toUpperCase();
    if (c.length === 3 && /^[A-Z]{3}$/.test(c)) update.currency = c;
  }
  if ("status" in body) {
    const s = body.status;
    if (!s || !EDITABLE_STATUSES.has(s)) {
      return json(
        { ok: false, error: "status must be active|paused|archived" },
        400,
      );
    }
    update.status = s;
  }
  if ("fiscal_type" in body) {
    const f = body.fiscal_type;
    if (f !== "formal" && f !== "informal") {
      return json(
        { ok: false, error: "fiscal_type must be 'formal' or 'informal'" },
        400,
      );
    }
    update.fiscal_type = f;
  }
  if ("plan" in body) {
    // Plan is billing, not profile: reject instead of silently ignoring so a
    // stale client learns the contract moved to business-web-change-subscription.
    return json(
      {
        ok: false,
        code: "plan_via_billing",
        error:
          "plan is managed by business-web-change-subscription (Stripe), not by profile updates.",
      },
      400,
    );
  }
  if ("address" in body) {
    // Address is native — seeded from Google Places and refined by the
    // Intaker, which writes public.places directly. Reject so stale clients
    // learn the contract — same posture as `price_level` and `plan`.
    return json(
      {
        ok: false,
        code: "address_via_enrich",
        error:
          "address is set from Google Places / the Intaker and cannot be updated manually.",
      },
      400,
    );
  }
  if ("google_maps_url" in body || "google_place_id" in body) {
    // decision: Pato (MESITA-468) — Google Maps + Place ID are native-locked.
    // Seeded at create from the Google spine; nobody edits them afterwards.
    return json(
      {
        ok: false,
        code: "google_maps_native",
        error:
          "google_maps_url / google_place_id are set at create from Google Places and cannot be updated manually.",
      },
      400,
    );
  }
  if ("closes_at" in body) {
    const raw = optString(body.closes_at, 5);
    if (raw != null && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(raw)) {
      return json(
        { ok: false, error: "closes_at must be 24h HH:MM (e.g. 02:00)" },
        400,
      );
    }
    update.closes_at = raw;
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
  if ("pitch" in body) update.pitch = optString(body.pitch, 200);
  if ("story" in body) update.story = optString(body.story, 1500);
  // Four per-tier promo rates. Each is nullable (null clears the offer). The
  // The Promos page sends the tens grid {10, 20, 30, 40, 50} via its four
  // preset strategies (50 is the ceiling; legacy 70 retired — MESITA-543).
  // The projects CHECK constraints mirror this set.
  for (const field of PROMO_RATE_FIELDS) {
    if (!(field in body)) continue;
    const rate = normalisePromoRate(field, body[field]);
    if (!rate.ok) {
      return json({ ok: false, error: rate.error }, 400);
    }
    update[field] = rate.value;
  }

  // Monthly promo spend cap. Nullable (null clears the ceiling) or one of
  // {200, 500, 1000}. DB CHECK mirrors this; this is the friendly 400.
  if ("monthly_promo_cap" in body) {
    const raw = body.monthly_promo_cap;
    if (raw == null) {
      update.monthly_promo_cap = null;
    } else {
      const v = Number(raw);
      if (![200, 500, 1000].includes(v)) {
        return json(
          {
            ok: false,
            error:
              "monthly_promo_cap must be null or one of 200, 500, 1000",
          },
          400,
        );
      }
      update.monthly_promo_cap = v;
    }
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
  // Promos section toggles. Strict boolean only — silently coerce
  // truthy / "true" strings would let stale clients write garbage.
  for (
    const boolField of [
      "segmentation_basic_enabled",
      "segmentation_advanced_enabled",
    ] as const
  ) {
    if (!(boolField in body)) continue;
    const value = body[boolField];
    if (typeof value !== "boolean") {
      return json({ ok: false, error: `${boolField} must be boolean` }, 400);
    }
    update[boolField] = value;
  }

  // Email: not a URL. Just trim + sanity-check the shape (has @ and a dot
  // after it). Empty / null clears the field.
  if ("email" in body) {
    const raw = body.email;
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
      update.email = null;
    } else if (typeof raw !== "string") {
      return json({ ok: false, error: "email must be a string" }, 400);
    } else {
      const trimmed = raw.trim();
      if (!isEmailish(trimmed)) {
        return json({
          ok: false,
          error: "email must look like name@domain.tld",
        }, 400);
      }
      if (trimmed.length > 254) {
        return json({ ok: false, error: "email too long" }, 400);
      }
      update.email = trimmed.toLowerCase();
    }
  }

  // Order + reservation ROUTING — which door each rail uses (MESITA-1208).
  // Five picks: phone · whatsapp · instagram · web · none (Pato 2026-08-25).
  // The Reservationist still only DIALS phone. Null / empty clears the rail.
  for (
    const [key, channelCol, targetCol] of [
      ["reservation", "reservation_channel", "reservation_target"],
      ["orders", "order_channel", "order_target"],
    ] as const
  ) {
    if (!(channelCol in body)) continue;
    const raw = (body as Record<string, unknown>)[channelCol];
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
      update[channelCol] = null;
      update[targetCol] = null;
      continue;
    }
    if (!isServingChannel(raw)) {
      return json(
        {
          ok: false,
          code: "channel_not_served",
          error:
            `${key} routing accepts phone, whatsapp, instagram, web, or none.`,
        },
        400,
      );
    }
    if (raw === "none") {
      update[channelCol] = "none";
      update[targetCol] = null;
      continue;
    }
    const target = (body as Record<string, unknown>)[targetCol];
    const value = typeof target === "string" ? target.trim().slice(0, 500) : "";
    if (!value) {
      return json(
        { ok: false, error: `${targetCol} is required when ${channelCol} is ${raw}` },
        400,
      );
    }
    update[channelCol] = raw;
    update[targetCol] = value;
  }

  if (Object.keys(update).length === 0) {
    return json({ ok: false, error: "No editable fields provided" }, 400);
  }

  const writingRates = PROMO_RATE_FIELDS.some((f) => f in update) ||
    "monthly_promo_cap" in update;
  let currentRow: Record<string, unknown> | null = null;
  if (writingRates) {
    const { data: row, error: readErr } = await admin
      .from("projects")
      .select(
        "plan, listing_type, welcome_free_rate, welcome_premium_rate, free_rate, premium_rate",
      )
      .eq("id", projectId)
      .maybeSingle();
    if (readErr) {
      return json({ ok: false, error: `place_read: ${readErr.message}` }, 500);
    }
    if (!row) return json({ ok: false, error: "Place not found" }, 404);
    currentRow = row as Record<string, unknown>;
    const plan = (currentRow.plan as string) ?? "free";
    if (plan === "free") {
      return json(
        {
          ok: false,
          code: "not_a_member",
          error: "Strategy switching requires an active partnership.",
        },
        409,
      );
    }
    applyListingTypeToPatch(update, {
      plan,
      rates: effectiveRatesAfterPatch(currentRow, update),
      currentListingType: currentRow.listing_type as string,
    });
  }

  // Follower counts follow the account (indirect edit, MESITA-416): a changed
  // instagram_url/facebook_url triggers an Apify follower refresh after the
  // response. Snapshot the current URLs first — clients resubmit whole forms,
  // and an unchanged URL must not burn a paid scrape.
  const prevSocial = await loadPreviousSocialUrlsForRefresh(
    admin,
    projectId,
    update,
    APIFY_KEY,
  );

  let updRes = await writePlace(admin, {
    table: "profiles",
    mode: "update",
    id: projectId,
    patch: update as ProfilePatch,
    select: PLACE_BUSINESS_COLUMNS,
  });

  // Backward compatibility: in projects where category_label migration hasn't
  // landed (or schema cache is stale), retry the same update without
  // category_label so edits can still be saved.
  if (
    !updRes.ok && isMissingCategoryLabelColumnError({ message: updRes.error }) &&
    "category_label" in update
  ) {
    const retryUpdate = { ...update };
    delete retryUpdate.category_label;
    updRes = await writePlace(admin, {
      table: "profiles",
      mode: "update",
      id: projectId,
      patch: retryUpdate as ProfilePatch,
      select: PLACE_BUSINESS_COLUMNS,
    });
  }
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
  const place = updRes.row;

  // ── The on_update row of the trigger matrix, honoured (MESITA-1188) ──────
  // Until now this row was decorative: it rendered two editable cells and
  // nothing read them, so flipping either changed nothing. It is the one row
  // honoured by WITHHOLDING work — an edit is ground truth, so this path seeds
  // no run and re-derives nothing. It has exactly two operator-controlled
  // cells, `social` and `embedding`; lockedCell() forces the other seven false
  // so wiring the row can never re-scrape over the human who just fixed the
  // record. A disabled row buys nothing, which stops both side effects.
  //
  // loadEnrichmentTriggers falls back to the code defaults when the blob is
  // missing, and both cells default ON — so a fresh environment behaves
  // exactly as it did before this row was wired.
  const onUpdateBuys = subprocessesFor(
    await loadEnrichmentTriggers(admin),
    "on_update",
  );

  if (onUpdateBuys.includes("social")) {
    queueSocialFollowersRefresh({
      admin,
      apifyKey: APIFY_KEY,
      projectId,
      update,
      prevSocial,
    });
  }

  // On-Update embeddings (MESITA-720): when profile fields that feed the
  // blurb change, re-synthesize human text + vector in the background.
  // Tags alone never trigger a re-embed.
  if (onUpdateBuys.includes("embedding") && updateTouchesEmbeddingInputs(update)) {
    queuePlaceEmbeddingsOnUpdate({
      admin,
      placeId: projectId,
      apiKey: Deno.env.get("OPENAI_KEY")?.trim(),
      logPrefix: "business-web-update-project/on-update",
      via: "update",
    });
  }

  if (writingRates && currentRow) {
    logStrategySwitch({
      project: projectId,
      from: ratesFromPlace(currentRow),
      to: effectiveRatesAfterPatch(currentRow, update),
      actor: authRes.user.email ?? authRes.user.id,
    });
  }

  return json({ ok: true, place });
});
