// The review list the profile stores. Places returns five. This actor returns
// the newest hundred. One place, no images: the gallery is a different call.

const ACTOR = "compass~crawler-google-places";
export const GOOGLE_REVIEWS_MAX = 100;
const TIMEOUT_MS = 180_000;

type FetchImpl = typeof fetch;

export type GoogleReview = {
  author: string;
  rating: number;
  quote: string;
  date: string;
};

export function reviewsFromApifyPlace(place: unknown, max = GOOGLE_REVIEWS_MAX): GoogleReview[] {
  const raw = place && typeof place === "object" && Array.isArray((place as { reviews?: unknown }).reviews)
    ? (place as { reviews: unknown[] }).reviews
    : [];
  const cap = Math.min(GOOGLE_REVIEWS_MAX, Math.max(0, Math.floor(max)));
  const out: GoogleReview[] = [];
  for (const item of raw) {
    if (out.length >= cap) break;
    const mapped = mapReview(item);
    if (mapped) out.push(mapped);
  }
  return out;
}

export async function fetchApifyGoogleReviews(opts: {
  googlePlaceId: string;
  apifyKey?: string;
  fetchImpl?: FetchImpl;
}): Promise<GoogleReview[]> {
  const key = opts.apifyKey?.trim() ?? "";
  const placeId = opts.googlePlaceId.trim();
  if (!key) throw new Error("Render is missing APIFY_KEY");
  if (!placeId) throw new Error("Enrichment needs a Google place id to load reviews.");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeIds: [placeId],
          maxReviews: GOOGLE_REVIEWS_MAX,
          maxImages: 0,
          language: "es",
          reviewsSort: "newest",
          reviewsPersonalData: true,
        }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`Apify did not return Google reviews (${res.status}). ${body}`.trim());
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Apify did not return Google reviews.");
    return reviewsFromApifyPlace(data[0]);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Apify did not return")) throw err;
    const why = ctrl.signal.aborted
      ? `timeout after ${TIMEOUT_MS}ms`
      : (err instanceof Error ? err.message : String(err)).slice(0, 200);
    throw new Error(`Apify did not return Google reviews. ${why}`);
  } finally {
    clearTimeout(timer);
  }
}

function mapReview(item: unknown): GoogleReview | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const quote = text(row.text) ?? text(row.textTranslated) ?? text(row.reviewText) ?? "";
  if (!quote) return null;
  return {
    author: text(row.name) ?? text(row.reviewerName) ?? "Google reviewer",
    rating: ratingOf(row.stars ?? row.rating ?? row.starRating),
    quote,
    date: text(row.publishedAtDate) ?? text(row.publishAt) ?? text(row.publishedAt) ?? "",
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ratingOf(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, n));
}
