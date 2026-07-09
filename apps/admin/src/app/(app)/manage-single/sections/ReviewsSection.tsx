"use client";

import { Star } from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "../ui";

type ReviewItem = {
  id: string;
  source: "Mesita" | "Google";
  author: string;
  rating: number;
  text: string;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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

function toReviewItems(
  input: unknown,
  source: "Mesita" | "Google",
): ReviewItem[] {
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
    if (!text) return;
    items.push({
      id: `${source.toLowerCase()}-${idx}-${author ?? "guest"}`,
      source,
      author: author ?? "Guest",
      rating: normalizeRating(row["rating"]),
      text,
    });
  });
  return items;
}

function extractRelevantReviews(place: AdminPlace): ReviewItem[] {
  const mesita = toReviewItems(place.mesita_visitors, "Mesita");
  const google = toReviewItems(place.google_reviews, "Google");
  const out: ReviewItem[] = [];
  const max = Math.max(mesita.length, google.length);
  for (let i = 0; i < max; i += 1) {
    if (mesita[i]) out.push(mesita[i]);
    if (google[i]) out.push(google[i]);
  }
  return out;
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 5) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-16 shrink-0 truncate text-xs">{label}</span>
      <div className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className="bg-secondary absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={
            "h-3.5 w-3.5 " +
            (i < rating
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/35")
          }
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

export function ReviewsSection({ place }: { place: AdminPlace }) {
  const overallMesita = place.mesita_stars_overall ?? null;
  const overallCount = place.mesita_review_count ?? 0;
  const bars = [
    ["Overall", place.mesita_stars_overall],
    ["Food", place.mesita_stars_food],
    ["Service", place.mesita_stars_service],
    ["Ambience", place.mesita_stars_ambience],
    ["Value", place.mesita_stars_value ?? place.mesita_stars_overall],
  ] as const;
  const snippets = extractRelevantReviews(place);
  const googleStars = place.google_stars_overall;
  const googleCount = place.google_review_count;
  const igFollowers = place.instagram_followers_count;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        icon={<Star className="text-muted-foreground h-4 w-4" />}
        title="Reviews"
        subtitle="Read-only ratings and snippets from Mesita and Google. Sourced from the place overview payload."
      >
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="border-border bg-background rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Mesita</p>
              <span className="text-muted-foreground text-xs tabular-nums">
                {overallCount} reviews
              </span>
            </div>
            <div className="flex items-start gap-4">
              <div className="bg-secondary/10 ring-secondary/20 flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl ring-1">
                <span className="text-xl font-semibold tabular-nums leading-none">
                  {overallMesita == null ? "—" : overallMesita.toFixed(1)}
                </span>
                <Star
                  className="h-3 w-3 fill-amber-400 text-amber-400"
                  strokeWidth={0}
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                {bars.map(([label, value]) => (
                  <RatingBar
                    key={label}
                    label={label}
                    value={typeof value === "number" ? value : 0}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-border bg-background rounded-xl border p-4">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
                Google
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                <Star
                  className="h-4 w-4 fill-amber-400 text-amber-400"
                  strokeWidth={0}
                />
                {googleStars == null ? "—" : googleStars.toFixed(1)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {googleCount == null
                  ? "No review count"
                  : `${formatCount(googleCount)} reviews`}
              </p>
            </div>
            <div className="border-border bg-background rounded-xl border p-4">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.12em] uppercase">
                Instagram
              </p>
              <p className="mt-2 text-lg font-semibold tabular-nums">
                {igFollowers == null ? "—" : formatCount(igFollowers)}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">followers</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Snippets"
        subtitle={`${snippets.length} shown · interleaved Mesita + Google when both exist.`}
      >
        {snippets.length === 0 ? (
          <p className="bg-muted text-muted-foreground mt-5 rounded-xl px-3 py-3 text-sm">
            No review snippets available yet for this place.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {snippets.map((item) => (
              <article
                key={item.id}
                className="border-border bg-background rounded-xl border p-3"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{item.author}</p>
                  <span
                    className={
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase " +
                      (item.source === "Google"
                        ? "bg-sky-500/10 text-sky-700"
                        : "bg-secondary/10 text-secondary")
                    }
                  >
                    {item.source}
                  </span>
                </div>
                <Stars rating={item.rating} />
                <p className="text-muted-foreground mt-2 line-clamp-5 text-sm leading-snug">
                  “{item.text}”
                </p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
