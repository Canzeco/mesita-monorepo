type GoogleReviewInput = {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string };
};

export type GoogleReviewSnippet = {
  author: string;
  rating: number;
  quote: string;
  date: string;
};

export function mapGoogleReviews(
  reviews: GoogleReviewInput[] | undefined,
): GoogleReviewSnippet[] | null {
  if (!Array.isArray(reviews) || reviews.length === 0) return null;
  const mapped = reviews
    .map((r) => ({
      author: r.authorAttribution?.displayName ?? "Google reviewer",
      rating: typeof r.rating === "number" ? r.rating : 0,
      quote: (r.text?.text ?? r.originalText?.text ?? "").trim(),
      date: r.relativePublishTimeDescription ?? "",
    }))
    .filter((r) => r.quote.length > 0);
  return mapped.length > 0 ? mapped : null;
}

/**
 * gathered.place.google_reviews may still be the Apify scrape
 * `{ author, rating, text, published }`. writePlace only admits
 * `{ author, rating, quote, date }` (closed object). Slim before persist.
 */
export function persistGoogleReviews(raw: unknown): GoogleReviewSnippet[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const mapped: GoogleReviewSnippet[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const quote = typeof r.quote === "string" && r.quote.trim()
      ? r.quote.trim()
      : typeof r.text === "string" && r.text.trim()
      ? r.text.trim()
      : "";
    if (!quote) continue;
    mapped.push({
      author: typeof r.author === "string" && r.author.trim()
        ? r.author.trim()
        : "Google reviewer",
      rating: typeof r.rating === "number" ? r.rating : 0,
      quote,
      date: typeof r.date === "string" && r.date
        ? r.date
        : typeof r.published === "string"
        ? r.published
        : "",
    });
  }
  return mapped.length > 0 ? mapped : null;
}
