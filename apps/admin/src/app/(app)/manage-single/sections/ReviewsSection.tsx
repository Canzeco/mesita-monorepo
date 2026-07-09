"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Star, Users } from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "../ui";

// Mirrors consumer PlaceDetailBody Reviews tab:
//   1. Reviews summary  (Mesita aggregates + Google / IG / FB cards)
//   2. Google reviews   (list; hidden when empty)
//   3. Mesita reviews   (list or empty state)

type GoogleReview = {
  id: string;
  author: string;
  rating: number;
  quote: string;
  date: string;
};

type MesitaVisitor = {
  id: string;
  name: string;
  handle: string;
  quote: string;
  food: number;
  service: number;
  ambiance: number;
  value: number;
};

type ReviewSort = "newest" | "highest" | "lowest";

const REVIEW_SORTS: { key: ReviewSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "highest", label: "Highest" },
  { key: "lowest", label: "Lowest" },
];

function formatCount(n: number, exact = false): string {
  if (exact || n < 1_000) return n.toLocaleString();
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000).toFixed(1)}K`;
}

function firstNonEmptyString(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function clampRating(v: unknown): number {
  return Math.min(5, Math.max(1, Math.round(asNumber(v, 5))));
}

function reviewTimeMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

function formatReviewDate(date: string): string {
  if (!date) return "";
  const t = Date.parse(date);
  if (!Number.isFinite(t)) return date;
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseGoogleReviews(input: unknown): GoogleReview[] {
  if (!Array.isArray(input)) return [];
  const items: GoogleReview[] = [];
  input.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object") return;
    const row = raw as Record<string, unknown>;
    const quote = firstNonEmptyString([
      row["quote"],
      row["text"],
      row["review"],
      row["body"],
      row["comment"],
    ]);
    if (!quote) return;
    const author =
      firstNonEmptyString([
        row["author"],
        row["author_name"],
        row["name"],
        row["user_name"],
        row["username"],
      ]) ?? "Guest";
    const date =
      firstNonEmptyString([row["date"], row["published"], row["published_at"]]) ??
      "";
    items.push({
      id: `google-${idx}-${author}`,
      author,
      rating: clampRating(row["rating"]),
      quote,
      date,
    });
  });
  return items;
}

function parseMesitaVisitors(input: unknown): MesitaVisitor[] {
  if (!Array.isArray(input)) return [];
  const items: MesitaVisitor[] = [];
  input.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object") return;
    const row = raw as Record<string, unknown>;
    const quote = firstNonEmptyString([
      row["quote"],
      row["text"],
      row["review"],
      row["body"],
      row["comment"],
    ]);
    if (!quote) return;
    const name =
      firstNonEmptyString([row["name"], row["author"], row["author_name"]]) ??
      "Guest";
    const handle =
      firstNonEmptyString([row["handle"], row["username"], row["user_name"]]) ??
      "";
    items.push({
      id: `mesita-${idx}-${name}`,
      name,
      handle,
      quote,
      food: clampRating(row["food"] ?? row["rating"]),
      service: clampRating(row["service"] ?? row["rating"]),
      ambiance: clampRating(
        row["ambiance"] ?? row["ambience"] ?? row["rating"],
      ),
      value: clampRating(row["value"] ?? row["rating"]),
    });
  });
  return items;
}

function mesitaOverall(v: MesitaVisitor): number {
  return (v.food + v.service + v.ambiance + v.value) / 4;
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (value / 5) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-14 shrink-0 truncate text-xs">
        {label}
      </span>
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
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={
            "h-3.5 w-3.5 " +
            (i < filled
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/35")
          }
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

function ExternalCard({
  label,
  icon,
  value,
  meta,
}: {
  label: string;
  icon: "star" | "users";
  value: string;
  meta: string;
}) {
  return (
    <div className="border-border bg-background flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3">
      <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.12em] uppercase">
        {label}
      </p>
      <div className="flex items-center gap-1 text-sm font-semibold tabular-nums">
        {icon === "star" ? (
          <Star
            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
            strokeWidth={0}
          />
        ) : (
          <Users className="text-muted-foreground h-3.5 w-3.5" />
        )}
        {value}
      </div>
      <p className="text-muted-foreground text-[10px] leading-tight">{meta}</p>
    </div>
  );
}

function ReviewSortChips({
  sort,
  onSort,
  label,
}: {
  sort: ReviewSort;
  onSort: (next: ReviewSort) => void;
  label: string;
}) {
  return (
    <div
      className="bg-muted/60 flex gap-1 rounded-xl p-1"
      role="group"
      aria-label={label}
    >
      {REVIEW_SORTS.map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={() => onSort(mode.key)}
          aria-pressed={sort === mode.key}
          className={
            "flex-1 rounded-lg py-1.5 text-xs font-semibold transition " +
            (sort === mode.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground")
          }
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

function GoogleReviewCard({ review }: { review: GoogleReview }) {
  return (
    <article className="border-border bg-background flex w-72 shrink-0 snap-start flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{review.author}</p>
          {review.date ? (
            <p className="text-muted-foreground text-[11px]">
              {formatReviewDate(review.date)}
            </p>
          ) : null}
        </div>
        <span className="bg-sky-500/10 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sky-700 uppercase">
          Google
        </span>
      </div>
      <Stars rating={review.rating} />
      <p className="text-muted-foreground line-clamp-5 text-sm leading-snug">
        “{review.quote}”
      </p>
    </article>
  );
}

function MesitaReviewCard({ visitor }: { visitor: MesitaVisitor }) {
  const overall = Math.round(mesitaOverall(visitor));
  return (
    <article className="border-border bg-background flex w-72 shrink-0 snap-start flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{visitor.name}</p>
          {visitor.handle ? (
            <p className="text-muted-foreground truncate text-[11px]">
              {visitor.handle}
            </p>
          ) : null}
        </div>
        <span className="bg-secondary/10 text-secondary shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          Mesita
        </span>
      </div>
      <Stars rating={overall} />
      <p className="text-muted-foreground text-[10px] leading-snug">
        Overall <span className="text-foreground font-semibold">{overall}</span>
        {" · "}Food{" "}
        <span className="text-foreground font-semibold">{visitor.food}</span>
        {" · "}Service{" "}
        <span className="text-foreground font-semibold">{visitor.service}</span>
        {" · "}Ambience{" "}
        <span className="text-foreground font-semibold">{visitor.ambiance}</span>
        {" · "}Value{" "}
        <span className="text-foreground font-semibold">{visitor.value}</span>
      </p>
      <p className="text-muted-foreground line-clamp-5 text-sm leading-snug italic">
        “{visitor.quote}”
      </p>
    </article>
  );
}

function HScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

export function ReviewsSection({ place }: { place: AdminPlace }) {
  const hasMesitaReviews = (place.mesita_review_count ?? 0) > 0;
  const overall = hasMesitaReviews
    ? (place.mesita_stars_overall ?? 5)
    : 5;
  const subRatings: Array<[string, number]> = [
    ["Food", hasMesitaReviews ? (place.mesita_stars_food ?? 5) : 5],
    ["Service", hasMesitaReviews ? (place.mesita_stars_service ?? 5) : 5],
    ["Ambience", hasMesitaReviews ? (place.mesita_stars_ambience ?? 5) : 5],
    [
      "Value",
      hasMesitaReviews
        ? (place.mesita_stars_value ?? place.mesita_stars_overall ?? 5)
        : 5,
    ],
  ];

  const googleReviews = useMemo(
    () => parseGoogleReviews(place.google_reviews),
    [place.google_reviews],
  );
  const mesitaVisitors = useMemo(
    () => parseMesitaVisitors(place.mesita_visitors),
    [place.mesita_visitors],
  );

  const [googleSort, setGoogleSort] = useState<ReviewSort>("newest");
  const [mesitaSort, setMesitaSort] = useState<ReviewSort>("newest");

  const sortedGoogle = useMemo(() => {
    const copy = [...googleReviews];
    copy.sort((a, b) => {
      if (googleSort === "highest") {
        return b.rating - a.rating || reviewTimeMs(b.date) - reviewTimeMs(a.date);
      }
      if (googleSort === "lowest") {
        return a.rating - b.rating || reviewTimeMs(b.date) - reviewTimeMs(a.date);
      }
      return reviewTimeMs(b.date) - reviewTimeMs(a.date);
    });
    return copy;
  }, [googleReviews, googleSort]);

  const sortedMesita = useMemo(() => {
    if (mesitaSort === "newest") return mesitaVisitors;
    const copy = [...mesitaVisitors];
    copy.sort((a, b) => {
      const diff = mesitaOverall(b) - mesitaOverall(a);
      return mesitaSort === "highest" ? diff : -diff;
    });
    return copy;
  }, [mesitaVisitors, mesitaSort]);

  const googleStars = place.google_stars_overall;
  const googleCount = place.google_review_count ?? 0;
  const igFollowers = place.instagram_followers_count;
  const fbFollowers = place.facebook_followers;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        icon={<Star className="text-muted-foreground h-4 w-4" />}
        title="Reviews summary"
        subtitle="Mesita aggregates plus Google, Instagram, and Facebook signals. Read-only."
      >
        <div className="mt-5 flex flex-col gap-4">
          <div className="border-border bg-background rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Mesita</p>
              <span className="text-muted-foreground text-xs tabular-nums">
                {place.mesita_review_count ?? 0} reviews
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-secondary/10 ring-secondary/20 flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl ring-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl leading-none font-semibold tabular-nums">
                    {overall.toFixed(1)}
                  </span>
                  <Star
                    className="h-3 w-3 fill-amber-400 text-amber-400"
                    strokeWidth={0}
                  />
                </div>
                <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                  Overall
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {subRatings.map(([label, value]) => (
                  <RatingBar key={label} label={label} value={value} />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ExternalCard
              label="Google"
              icon="star"
              value={googleStars == null ? "—" : googleStars.toFixed(1)}
              meta={
                googleCount > 0
                  ? `${formatCount(googleCount, true)} reviews`
                  : "No reviews"
              }
            />
            <ExternalCard
              label="Instagram"
              icon="users"
              value={igFollowers == null ? "—" : formatCount(igFollowers)}
              meta="followers"
            />
            <ExternalCard
              label="Facebook"
              icon="users"
              value={fbFollowers == null ? "—" : formatCount(fbFollowers)}
              meta="followers"
            />
          </div>
        </div>
      </SectionCard>

      {googleReviews.length > 0 ? (
        <SectionCard
          icon={<Star className="text-muted-foreground h-4 w-4" />}
          title="Google reviews"
          subtitle={`${formatCount(googleCount || googleReviews.length, true)} total · newest / highest / lowest.`}
        >
          <div className="mt-5 flex flex-col gap-3">
            <ReviewSortChips
              sort={googleSort}
              onSort={setGoogleSort}
              label="Sort Google reviews"
            />
            <HScroll>
              {sortedGoogle.map((review) => (
                <GoogleReviewCard key={review.id} review={review} />
              ))}
            </HScroll>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        icon={<MessageCircle className="text-muted-foreground h-4 w-4" />}
        title="Mesita reviews"
        subtitle={`${place.mesita_review_count ?? 0} total · from Mesita guests after a visit.`}
      >
        <div className="mt-5 flex flex-col gap-3">
          {mesitaVisitors.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
                <MessageCircle className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">No Mesita reviews yet</p>
                <p className="text-muted-foreground text-xs leading-snug">
                  Guests leave reviews after visiting — none on this place yet.
                </p>
              </div>
            </div>
          ) : (
            <>
              <ReviewSortChips
                sort={mesitaSort}
                onSort={setMesitaSort}
                label="Sort Mesita reviews"
              />
              <HScroll>
                {sortedMesita.map((visitor) => (
                  <MesitaReviewCard key={visitor.id} visitor={visitor} />
                ))}
              </HScroll>
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
