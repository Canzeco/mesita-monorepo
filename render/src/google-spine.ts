// Step 1, Details. Render does not map Google itself (MESITA-3844): it asks
// enricher-edgefunc-google-details, the same Google fetch and mapping Update
// runs, and folds the patch into the draft, as draft-sync.ts does for Social
// and Reviews. One body, whichever button bought the Google facts.

import { charge, openaiUsd } from "./cost.ts";

export type GoogleDetails = {
  patch: Record<string, unknown>;
  businessStatus: string | null;
  primaryType: string | null;
  /** Google's photo URLs, best-first. */
  photoUrls: string[];
  countryCode: string | null;
};

export async function fetchGoogleDetails(
  googlePlaceId: string,
  maxPhotos: number,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleDetails> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
  const writeKey = process.env.ENRICH_WRITE_KEY?.trim() ?? "";
  if (!supabaseUrl || !writeKey) throw new Error("Details is not configured");
  const res = await fetchImpl(
    `${supabaseUrl.replace(/\/$/, "")}/functions/v1/enricher-edgefunc-google-details`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${writeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ googlePlaceId, maxPhotos }),
    },
  );
  const body = (await res.json().catch(() => null)) as
    | (Partial<GoogleDetails> & { ok?: boolean; error?: string })
    | null;
  if (!res.ok || !body?.ok || !body.patch || typeof body.patch !== "object") {
    throw new Error(body?.error || `Google details did not return a result (${res.status})`);
  }
  return {
    patch: body.patch,
    businessStatus: typeof body.businessStatus === "string" ? body.businessStatus : null,
    primaryType: typeof body.primaryType === "string" ? body.primaryType : null,
    photoUrls: Array.isArray(body.photoUrls) ? body.photoUrls.filter((u): u is string => typeof u === "string") : [],
    countryCode: typeof body.countryCode === "string" ? body.countryCode : null,
  };
}

type AddressPart = { types?: string[]; longText?: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Google's own summary, editorial first: the Description step's fallback. */
export function googleDescription(patch: Record<string, unknown>): string | null {
  return capPresentation(text(patch.pitch) || text(patch.story));
}

/** The facts the description model may use when Google has no summary. */
export function googleFacts(patch: Record<string, unknown>, description: string | null): string {
  const address = (patch.google_address ?? {}) as { addressComponents?: AddressPart[] };
  const componentFacts = (address.addressComponents ?? []).flatMap((row) => {
    const key = (row.types ?? []).find((type) => type && type !== "political");
    const value = row.longText?.trim() ?? "";
    return key && value ? [`${key}: ${value}`] : [];
  });
  const rating = patch.google_stars_overall;
  return [
    `Name: ${text(patch.google_name)}`,
    `formattedAddress: ${text(patch.address)}`,
    ...componentFacts,
    text(patch.phone) ? `Phone: ${text(patch.phone)}` : "",
    text(patch.website_url) ? `Website: ${text(patch.website_url)}` : "",
    typeof rating === "number" ? `Google rating: ${rating}` : "",
    description ? `Google summary: ${description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const DESCRIBE_MODEL = "gpt-4o-mini";

export async function describeFromFacts(
  facts: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DESCRIBE_MODEL,
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
  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  } | null;
  charge("openai", openaiUsd(DESCRIBE_MODEL, body?.usage), `describe ${DESCRIBE_MODEL}`);
  if (!res.ok)
    throw new Error(
      body?.error?.message ||
        `OpenAI did not write a description (${res.status})`,
    );
  return capPresentation(body?.choices?.[0]?.message?.content ?? "") ?? "";
}

/** Guest Presentation ceiling. Same number as ENRICH_FIELD_LIMITS.description
 *  (2000, MESITA-2739): pitch and story are the write's Google fallback
 *  Presentation, so a lower number here cut stored Presentations. The twin
 *  fixture pins both (MESITA-2989). */
export const PRESENTATION_MAX = 2000;

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
  const cut =
    space >= PRESENTATION_MAX * MIN_KEEP ? room.slice(0, space) : room;
  return `${cut.replace(/[\s,;:–—-]+$/, "")}…`;
}
