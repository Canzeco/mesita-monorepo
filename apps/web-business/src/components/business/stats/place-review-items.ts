import type { MyPlace } from "@/lib/api/places";

type ReviewItem = {
  id: string;
  source: "Mesita" | "Google";
  author: string;
  rating: number;
  text: string;
};

export function extractRelevantReviews(place: MyPlace): ReviewItem[] {
  const raw = place as unknown as Record<string, unknown>;
  const out: ReviewItem[] = [];

  const mesita = toReviewItems(raw["mesita_visitors"], "Mesita");
  const google = toReviewItems(raw["google_reviews"], "Google");
  const max = Math.max(mesita.length, google.length);
  for (let i = 0; i < max; i += 1) {
    if (mesita[i]) out.push(mesita[i]);
    if (google[i]) out.push(google[i]);
  }
  return out;
}

function toReviewItems(input: unknown, source: ReviewItem["source"]): ReviewItem[] {
  if (!Array.isArray(input)) return [];
  const items: ReviewItem[] = [];

  input.forEach((rawItem, idx) => {
    if (!rawItem || typeof rawItem !== "object") return;
    const row = rawItem as Record<string, unknown>;
    const author = firstNonEmptyString([
      row["author"],
      row["author_name"],
      row["name"],
      row["user_name"],
      row["username"],
    ]);
    const text = firstNonEmptyString([
      row["text"],
      row["review"],
      row["body"],
      row["comment"],
      row["quote"],
    ]);
    const rating = normalizeRating(row["rating"]);
    if (!text) return;
    items.push({
      id: `${source.toLowerCase()}-${idx}-${author ?? "guest"}`,
      source,
      author: author ?? "Guest",
      rating,
      text,
    });
  });

  return items;
}

function firstNonEmptyString(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function normalizeRating(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(5, Math.max(1, Math.round(v)));
  }
  if (typeof v === "string") {
    const num = Number.parseFloat(v);
    if (Number.isFinite(num)) return Math.min(5, Math.max(1, Math.round(num)));
  }
  return 5;
}
