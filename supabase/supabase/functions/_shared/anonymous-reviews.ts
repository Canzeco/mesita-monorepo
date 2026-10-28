// Guests read Google reviews ANONYMOUSLY (Pato, MESITA-2916: "to minimize
// legal problems ... don't mention the names"). Only the stars, the comment
// and the date leave consumer-web-get-place; the author, the reviewer's
// photo and every other key stay in the stored jsonb.
export function anonymousReviews(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      rating: r.rating,
      text: r.text ?? r.quote,
      published: r.published ?? r.date,
    }));
}
