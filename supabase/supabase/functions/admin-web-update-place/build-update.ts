// The body → patch whitelist behind admin-web-update-place (MESITA-2982):
// pure, so every 400 it can answer is pinned without a database. Missing keys
// are not touched; an explicit null clears the field. The handler owns the
// gates before it (reviews_owned, id, read-only fields) and every write after.

import { json } from "../_shared/http.ts";
import { ENRICH_FIELD_LIMITS } from "../_shared/enrich-field-limits.ts";
import type { PlaceFamily } from "../_shared/categories.ts";
import { isOperatorField, type OperatorField } from "../_shared/operator-fields.ts";
import { type PlaceHours, sanitiseHours } from "./place-hours.ts";
import { isUrl, URL_FIELDS, type UrlField } from "./place-urls.ts";
import { optString } from "./place-update-utils.ts";
import { applyMediaUpdates } from "./place-media-update.ts";
import { readFamilyKeysBody } from "./place-families-body.ts";

const MAX_DESCRIPTION_LEN = ENRICH_FIELD_LIMITS.description.max;

export const READ_ONLY_FIELDS = ["category", "category_label", "google_types", "google_source_types"] as const;
const MAX_TAGS = ENRICH_FIELD_LIMITS.tagsPerPlace.max;

const RESERVATION_CHANNELS = new Set(["phone", "whatsapp", "instagram", "web", "none"]);

export type UpdateBody = {
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
  /** Mesita families: 1–7 place_families slugs, editable since MESITA-2893. Null clears. */
  family_keys?: string[] | null;
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

export type PlaceUpdate = {
  /** The profiles patch. */
  update: Record<string, unknown>;
  /** Families to write on place_profiles; undefined = not sent, null = clear. */
  familyKeys: string[] | null | undefined;
  /** Operator fields handed back to Enrich (Basics' Reset). */
  resetFields: OperatorField[];
};

const fail = (response: Response) => ({ ok: false as const, response });

export function buildPlaceUpdate(
  body: UpdateBody,
  families: readonly PlaceFamily[],
): ({ ok: true } & PlaceUpdate) | { ok: false; response: Response } {
  const update: Record<string, unknown> = {};
  // The Mesita name → place_profiles.name (MESITA-2828: stored, the one
  // name). Empty/whitespace CLEARS it and the name-fallback trigger copies
  // Google's label back in, so the place is never nameless.
  if ("name" in body) {
    const n = (body.name ?? "").toString().trim();
    if (n.length > ENRICH_FIELD_LIMITS.placeName.max) {
      return fail(json({ ok: false, error: "name too long" }, 400));
    }
    update.name = n.length > 0 ? n : null;
  }
  if ("hours" in body) {
    const cleaned = sanitiseHours(body.hours);
    if (cleaned === "invalid") {
      return fail(json(
        {
          ok: false,
          error:
            "hours must be a map of weekday → [{open,close}] with HH:MM values",
        },
        400,
      ));
    }
    update.hours = cleaned;
  }
  if ("phone" in body) {
    const raw = optString(body.phone, 40);
    // Phones ALWAYS carry a country code (E.164-style prefix). Null/empty
    // still clears; anything else must start with "+".
    if (raw != null && !/^\+[0-9]/.test(raw)) {
      return fail(json(
        {
          ok: false,
          code: "phone_needs_country_code",
          error: "phone must include a country code, e.g. +52 81 8378 2164.",
        },
        400,
      ));
    }
    update.phone = raw;
  }
  const mediaError = applyMediaUpdates(body, update);
  if (mediaError) return { ok: false, response: mediaError };
  
  // External + social URLs — each optional, each validated to https://.
  for (const field of URL_FIELDS) {
    if (!(field in body)) continue;
    const raw = body[field as UrlField];
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
      update[field] = null;
      continue;
    }
    if (!isUrl(raw)) {
      return fail(json(
        { ok: false, error: `${field} must be a valid https:// URL` },
        400,
      ));
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
      return fail(json({ ok: false, error: "tags must be a list of slugs" }, 400));
    }
    const tags = [...new Set(
      (raw ?? []).filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean),
    )];
    if (tags.length > MAX_TAGS) {
      return fail(json({ ok: false, error: `at most ${MAX_TAGS} tags` }, 400));
    }
    // An unknown slug is refused by the taxonomy trigger.
    update.tags = tags;
  }
  // Mesita Families (MESITA-2893): the operator's 1–5 of the thirty-seven. Validated
  // against the live vocabulary here, so the 400 names the slug instead of the
  // trigger's bare "unknown family"; the handler writes them on place_profiles,
  // because the profiles view's INSTEAD OF trigger drops family_keys.
  let familyKeys: string[] | null | undefined;
  if ("family_keys" in body) {
    if (families.length === 0) {
      return fail(json({ ok: false, error: "Family vocabulary unavailable" }, 500));
    }
    const read = readFamilyKeysBody(body.family_keys, families);
    if (!read.ok) return fail(json(read.body, read.status));
    familyKeys = read.keys;
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
      return fail(json({ ok: false, error: "reservations_enabled needs a matching reservation_channel" }, 400));
    }
    update.reservations_enabled = body.reservations_enabled;
    update.reservation_channel = channel;
  }
  // Basics' Reset (MESITA-2829): a list of operator-owned fields to hand
  // back to Enrich. It may ride alone, with no edit.
  const resetFields: OperatorField[] = [];
  if ("reset_fields" in body) {
    if (!Array.isArray(body.reset_fields) || !body.reset_fields.every(isOperatorField)) {
      return fail(json({ ok: false, error: "reset_fields must list name, description, tags or family_keys" }, 400));
    }
    resetFields.push(...body.reset_fields);
  }
  if (Object.keys(update).length === 0 && resetFields.length === 0 && familyKeys === undefined) {
    return fail(json({ ok: false, error: "No editable fields provided" }, 400));
  }
  return { ok: true, update, familyKeys, resetFields };
}
