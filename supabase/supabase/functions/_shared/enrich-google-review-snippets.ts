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
