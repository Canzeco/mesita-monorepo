"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Star } from "lucide-react";
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

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
}

function extractQuote(row: Record<string, unknown>): string | null {
  return firstNonEmptyString([
    row["quote"],
    row["text"],
    row["review"],
    row["body"],
    row["comment"],
  ]);
}

function parseGoogleReviews(input: unknown): GoogleReview[] {
  if (!Array.isArray(input)) return [];
  const items: GoogleReview[] = [];
  input.forEach((raw, idx) => {
    const row = asRecord(raw);
    if (!row) return;
    const quote = extractQuote(row);
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
    const row = asRecord(raw);
    if (!row) return;
    const quote = extractQuote(row);
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

function RatingBar({ label, value }: { label: string; value: number | null }) {
  const pct = value == null ? 0 : Math.min(100, (value / 5) * 100);
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
        {value == null ? "—" : value.toFixed(1)}
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
  logo,
  star,
  value,
  meta,
}: {
  label: string;
  /** Brand SVG in /public/channels — the card's identity mark. */
  logo: string;
  /** Show the amber rating star before the value (Google rating only). */
  star?: boolean;
  value: string;
  meta: string;
}) {
  return (
    <div className="border-border/60 bg-muted/30 flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3">
      <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
        {/* Static brand mark — next/image adds nothing at 14px. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" aria-hidden className="h-3.5 w-3.5 shrink-0" />
        {label}
      </p>
      <div className="flex items-center gap-1 text-sm font-semibold tabular-nums">
        {star && (
          <Star
            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
            strokeWidth={0}
          />
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

// Quotes shorter than this comfortably fit the 5-line clamp — no toggle. The
// threshold is a heuristic (≈5 lines × ~44 chars at w-72), not a measurement;
// a few borderline quotes showing a needless "Read more" beats truncating a
// long one with no way to expand.
const REVIEW_CLAMP_CHARS = 220;

function GoogleReviewCard({ review }: { review: GoogleReview }) {
  const [expanded, setExpanded] = useState(false);
  const clampable = review.quote.length > REVIEW_CLAMP_CHARS;
  return (
    <article className="border-border/60 bg-muted/30 flex w-72 shrink-0 snap-start flex-col gap-2 rounded-xl border p-3">
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
      <p
        className={
          "text-muted-foreground text-sm leading-snug" +
          (expanded ? "" : " line-clamp-5")
        }
      >
        “{review.quote}”
      </p>
      {clampable ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-primary self-start text-xs font-semibold transition hover:opacity-80"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </article>
  );
}

function MesitaReviewCard({ visitor }: { visitor: MesitaVisitor }) {
  const overall = Math.round(mesitaOverall(visitor));
  return (
    <article className="border-border/60 bg-muted/30 flex w-72 shrink-0 snap-start flex-col gap-2 rounded-xl border p-3">
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
  // Ratings only exist once a guest has actually reviewed. These columns are
  // null until then, and defaulting them to 5 rendered a fabricated "5.0
  // OVERALL" badge on every unreviewed place — read as a real score, not a
  // placeholder. null means "no score yet"; the card says so instead.
  const hasMesitaReviews = (place.mesita_review_count ?? 0) > 0;
  const overall = hasMesitaReviews ? (place.mesita_stars_overall ?? null) : null;
  const subRatings: Array<[string, number | null]> | null = hasMesitaReviews
    ? [
        ["Food", place.mesita_stars_food ?? null],
        ["Service", place.mesita_stars_service ?? null],
        ["Ambience", place.mesita_stars_ambience ?? null],
        // Value falls back to overall — a reviewed place always has one.
        [
          "Value",
          place.mesita_stars_value ?? place.mesita_stars_overall ?? null,
        ],
      ]
    : null;

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

  // Google's aggregate count (google_review_count) can run to thousands, but the
  // Enricher only scrapes review *texts* up to Apify's hard 100 cap — so the list
  // below is at most 100. Spell that out to defuse the "12,847 total / short list"
  // confusion (mirrors Atlas Config → Field limits and Enricher Config → Reviews).
  const scrapedGoogle = googleReviews.length;
  const googleReviewsSubtitle =
    googleCount > scrapedGoogle
      ? `${scrapedGoogle} of ${formatCount(googleCount, true)} scraped.`
      : `${scrapedGoogle} scraped.`;
  // Flagged, not buried: the Enricher can only ever hold 100 Google review
  // TEXTS (Apify's hard per-run cap), while google_review_count is Google's
  // full aggregate. Pato 2026-08-03: "mention a flag there that max 100
  // google reviews. we know its a limitation but maybe later we fix it" —
  // the fix is tracked as MESITA-848.
  const googleCapped = scrapedGoogle >= 100 || googleCount > scrapedGoogle;

  // Cards are siblings of Place boxes — parent PlaceSection owns the 2-col grid.
  return (
    <>
      <SectionCard
        icon={<Star className="h-4 w-4" />}
        tint="amber"
        title="Reviews summary"
        subtitle="Mesita aggregates plus Google, Instagram, and Facebook signals. Read-only."
      >
        <div className="mt-5 flex flex-col gap-4">
          <div className="border-border/60 bg-muted/30 rounded-xl border p-4">
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
                    {overall == null ? "—" : overall.toFixed(1)}
                  </span>
                  {overall != null ? (
                    <Star
                      className="h-3 w-3 fill-amber-400 text-amber-400"
                      strokeWidth={0}
                    />
                  ) : null}
                </div>
                <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
                  Overall
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {subRatings ? (
                  subRatings.map(([label, value]) => (
                    <RatingBar key={label} label={label} value={value} />
                  ))
                ) : (
                  <p className="text-muted-foreground text-xs leading-snug">
                    No Mesita reviews yet — ratings appear once a guest reviews
                    this place.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ExternalCard
              label="Google"
              logo="/channels/google.svg"
              star
              value={googleStars == null ? "—" : googleStars.toFixed(1)}
              meta={
                googleCount > 0
                  ? `${formatCount(googleCount, true)} reviews`
                  : "No reviews"
              }
            />
            <ExternalCard
              label="Instagram"
              logo="/channels/instagram.svg"
              value={igFollowers == null ? "—" : formatCount(igFollowers)}
              meta="followers"
            />
            <ExternalCard
              label="Facebook"
              logo="/channels/facebook.svg"
              value={fbFollowers == null ? "—" : formatCount(fbFollowers)}
              meta="followers"
            />
          </div>
        </div>
      </SectionCard>

      {googleReviews.length > 0 ? (
        <SectionCard
          icon={<Star className="h-4 w-4" />}
          tint="sky"
          title="Google reviews"
          subtitle={googleReviewsSubtitle}
        >
          {googleCapped && (
            <p className="border-border bg-muted/40 text-muted-foreground mt-4 rounded-xl border px-3 py-2 text-[11px] leading-snug">
              <span className="text-foreground font-semibold">Known limit ·</span>{" "}
              Mesita stores at most <span className="font-semibold">100</span> Google
              review texts per place — Apify caps the pull. The star average and the
              total count above come from Google and are complete; only the list below
              is truncated. Raising it is tracked (MESITA-848).
            </p>
          )}
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
        icon={<MessageCircle className="h-4 w-4" />}
        tint="rose"
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
    </>
  );
}
