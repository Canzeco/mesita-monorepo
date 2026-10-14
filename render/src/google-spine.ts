// The Google identity spine, mapped to the one write. Photos and category stay
// out: photo URLs expire, and a Google type slug is not a Mesita category.

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
  "rating",
  "userRatingCount",
  "businessStatus",
  "editorialSummary",
  "generativeSummary",
  "regularOpeningHours",
  "reviews",
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
};

export type GoogleSpine =
  | { ok: true; description: string | null; facts: string; patch: Record<string, unknown> }
  | { ok: false; error: string };

function component(details: GooglePlace, types: string[]): string | null {
  for (const want of types) {
    const hit = (details.addressComponents ?? []).find((row) => (row.types ?? []).includes(want));
    const text = hit?.longText?.trim() ?? "";
    if (text) return text;
  }
  return null;
}

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
  const description = (editorial || generative).slice(0, 1000) || null;
  const phone = (details.internationalPhoneNumber || details.nationalPhoneNumber || "").trim();
  const website = httpUrl(details.websiteUri);
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
  };
  const zone = component(details, ["neighborhood", "sublocality_level_1", "sublocality"]);
  const city = component(details, ["locality", "administrative_area_level_2"]);
  if (zone) patch.zone = zone;
  if (city) patch.city = city;
  if (phone) patch.phone = phone;
  if (website) patch.website_url = website;
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
  const reviews = googleReviews(details.reviews);
  if (reviews) patch.google_reviews = reviews;
  if (editorial) patch.pitch = editorial.slice(0, 1000);
  if (generative) patch.story = generative.slice(0, 1000);

  const facts = [
    `Name: ${name}`,
    `Address: ${address}`,
    city ? `City: ${city}` : "",
    zone ? `Neighborhood: ${zone}` : "",
    phone ? `Phone: ${phone}` : "",
    website ? `Website: ${website}` : "",
    typeof details.rating === "number" ? `Google rating: ${details.rating}` : "",
    description ? `Google summary: ${description}` : "",
  ].filter(Boolean).join("\n");

  return { ok: true, description, facts, patch };
}

function googleReviews(reviews: GooglePlace["reviews"]): { author: string; rating: number; quote: string; date: string }[] | null {
  const mapped = (reviews ?? []).map((review) => ({
    author: review.authorAttribution?.displayName?.trim() || "Google reviewer",
    rating: typeof review.rating === "number" ? review.rating : 0,
    quote: (review.text?.text ?? review.originalText?.text ?? "").trim(),
    date: review.relativePublishTimeDescription ?? "",
  })).filter((review) => review.quote.length > 0);
  return mapped.length > 0 ? mapped : null;
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
            "Write a place description in Spanish from the facts given. Use only those facts. Do not invent hours, prices, or a menu. At most 800 characters.",
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
  return (body?.choices?.[0]?.message?.content ?? "").trim().slice(0, 1000);
}
