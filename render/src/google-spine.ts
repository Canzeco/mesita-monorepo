// The Google identity spine, mapped to the one write. Category stays out: a
// Google type slug is not a Mesita category. Photo links are fetched separately
// and copied into storage by the write.

import { channelFromUrl, priceLevelFromGoogle } from "./channels.ts";
import { closesAtFromHours, weeklyHoursFromPeriods, type GooglePeriod } from "./hours.ts";

const FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "priceLevel",
  "rating",
  "userRatingCount",
  "businessStatus",
  "editorialSummary",
  "generativeSummary",
  "regularOpeningHours",
  "reviews",
  "photos",
].join(",");

const BUSINESS = new Set(["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"]);

export type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: { types?: string[]; longText?: string }[];
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  priceLevel?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  editorialSummary?: { text?: string };
  generativeSummary?: { overview?: { text?: string } };
  regularOpeningHours?: { weekdayDescriptions?: string[]; periods?: GooglePeriod[] };
  reviews?: {
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    relativePublishTimeDescription?: string;
  }[];
  photos?: { name?: string }[];
};

export type GoogleSpine =
  | { ok: true; description: string | null; facts: string; patch: Record<string, unknown> }
  | { ok: false; error: string };

function httpUrl(value: string | undefined): string | null {
  const url = value?.trim() ?? "";
  return url.startsWith("https://") || url.startsWith("http://") ? url : null;
}

export function profileFromGoogle(details: GooglePlace, requestedId: string): GoogleSpine {
  const name = details.displayName?.text?.trim() ?? "";
  if (!name) return { ok: false, error: "Place has no display name on Google." };
  const lat = details.location?.latitude;
  const lng = details.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { ok: false, error: "Place has no coordinates on Google." };
  }
  const address = details.formattedAddress?.trim() ?? "";
  if (!address) return { ok: false, error: "Place has no address on Google." };

  const editorial = details.editorialSummary?.text?.trim() ?? "";
  const generative = details.generativeSummary?.overview?.text?.trim() ?? "";
  const description = capPresentation(editorial || generative);
  const phone = (details.internationalPhoneNumber || details.nationalPhoneNumber || "").trim();
  const channel = channelFromUrl(details.websiteUri);
  const website = channel?.key === "website_url" ? channel.url : null;
  const placeId = (details.id ?? requestedId).trim();
  const maps = httpUrl(details.googleMapsUri) ??
    `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
  const business = details.businessStatus?.trim().toUpperCase() ?? "";

  const patch: Record<string, unknown> = {
    google_name: name.slice(0, 80),
    address,
    lat,
    lng,
    google_maps_url: maps,
    google_found: true,
    google_address: {
      formattedAddress: address,
      location: { latitude: lat, longitude: lng },
      addressComponents: details.addressComponents ?? [],
    },
  };
  if (phone) patch.phone = phone;
  if (channel) {
    patch[channel.key] = channel.url;
    if (channel.key === "instagram_url") patch.instagram_found = true;
    if (channel.key === "facebook_url") patch.facebook_found = true;
  }
  const price = priceLevelFromGoogle(details.priceLevel);
  if (price) patch.price_level = price;
  if (typeof details.rating === "number" && details.rating >= 0 && details.rating <= 5) {
    patch.google_stars_overall = details.rating;
  }
  if (Number.isInteger(details.userRatingCount) && (details.userRatingCount ?? 0) >= 0) {
    patch.google_review_count = details.userRatingCount;
  }
  if (BUSINESS.has(business)) {
    patch.business_state = business;
    patch.business_state_at = new Date().toISOString();
  }
  const hours = weeklyHoursFromPeriods(details.regularOpeningHours?.periods);
  if (hours) patch.hours = hours;
  const closesAt = closesAtFromHours(details.regularOpeningHours?.weekdayDescriptions);
  if (closesAt) patch.closes_at = closesAt;
  // Places returns at most five reviews. The review list is Apify's, written
  // by buildEnrichment. Copying these five would be the list the guest sees.
  if (editorial) patch.pitch = capPresentation(editorial);
  if (generative) patch.story = capPresentation(generative);

  const componentFacts = (details.addressComponents ?? []).flatMap((row) => {
    const key = (row.types ?? []).find((type) => type && type !== "political");
    const value = row.longText?.trim() ?? "";
    return key && value ? [`${key}: ${value}`] : [];
  });
  const facts = [
    `Name: ${name}`,
    `formattedAddress: ${address}`,
    ...componentFacts,
    phone ? `Phone: ${phone}` : "",
    website ? `Website: ${website}` : "",
    channel && channel.key !== "website_url" ? `Link: ${channel.url}` : "",
    typeof details.rating === "number" ? `Google rating: ${details.rating}` : "",
    description ? `Google summary: ${description}` : "",
  ].filter(Boolean).join("\n");

  return { ok: true, description, facts, patch };
}

export async function fetchTimezone(lat: number, lng: number, apiKey: string): Promise<string | null> {
  const stamp = Math.floor(Date.now() / 1000);
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${stamp}&key=${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) return null;
  const body = await res.json().catch(() => null) as { status?: string; timeZoneId?: string } | null;
  return body?.status === "OK" && body.timeZoneId ? body.timeZoneId : null;
}

const PHOTO_CAP = 10;

export function photoUris(bodies: { photoUri?: string }[], cap = PHOTO_CAP): string[] {
  const limit = Math.min(PHOTO_CAP, Math.max(0, Math.floor(cap)));
  const out: string[] = [];
  for (const body of bodies) {
    if (out.length >= limit) break;
    const uri = body.photoUri?.trim() ?? "";
    if (!uri.startsWith("https://") || out.includes(uri)) continue;
    out.push(uri);
  }
  return out;
}

export async function fetchGooglePhotoUrls(
  photos: { name?: string }[] | undefined,
  apiKey: string,
  cap = PHOTO_CAP,
): Promise<string[]> {
  const limit = Math.min(PHOTO_CAP, Math.max(0, Math.floor(cap)));
  const names = (photos ?? [])
    .map((photo) => photo.name?.trim() ?? "")
    .filter(Boolean)
    .slice(0, limit);
  const bodies = await Promise.all(names.map(async (name) => {
    const res = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxHeightPx=1600&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } },
    );
    if (!res.ok) return {};
    return await res.json().catch(() => ({})) as { photoUri?: string };
  }));
  return photoUris(bodies, limit);
}

export async function fetchGooglePlace(googlePlaceId: string, apiKey: string): Promise<GooglePlace> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}?languageCode=es-MX&regionCode=MX`;
  const res = await fetch(url, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google rejected the place (${res.status}). ${text.slice(0, 160)}`);
  }
  return await res.json() as GooglePlace;
}

export async function describeFromFacts(facts: string, apiKey: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Write a place description in English from the facts given. Use only those facts. Do not invent hours, prices, or a menu. At most 500 characters.",
        },
        { role: "user", content: facts },
      ],
    }),
  });
  const body = await res.json().catch(() => null) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  } | null;
  if (!res.ok) throw new Error(body?.error?.message || `OpenAI did not write a description (${res.status})`);
  return capPresentation(body?.choices?.[0]?.message?.content ?? "") ?? "";
}

/** Guest Presentation ceiling. Same number as ENRICH_FIELD_LIMITS.description. */
export const PRESENTATION_MAX = 500;

// Cut at the last full sentence, never mid-word (MESITA-2641). The twin of
// supabase/_shared/presentation-cap.ts; Render is its own package and cannot
// import it, so the two change together.
const SENTENCE_END = /[.!?…](?=[\s"”'’)\]]|$)/g;
const MIN_KEEP = 0.4;

export function capPresentation(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (t.length <= PRESENTATION_MAX) return t;
  const head = t.slice(0, PRESENTATION_MAX);
  let end = -1;
  for (const m of head.matchAll(SENTENCE_END)) end = (m.index ?? -1) + 1;
  if (end >= PRESENTATION_MAX * MIN_KEEP) return head.slice(0, end).trimEnd();
  const room = t.slice(0, PRESENTATION_MAX - 1);
  const space = room.lastIndexOf(" ");
  const cut = space >= PRESENTATION_MAX * MIN_KEEP ? room.slice(0, space) : room;
  return `${cut.replace(/[\s,;:–—-]+$/, "")}…`;
}
