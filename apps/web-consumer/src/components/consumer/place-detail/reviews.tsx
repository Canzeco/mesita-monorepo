"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { MessageCircle, Star, Users } from "lucide-react";

import {
  FacebookLogo,
  GoogleLogo,
  InstagramLogo,
  MesitaMark,
} from "@/components/consumer/BrandLogos";
import { ReviewCard } from "@/components/consumer/ReviewCard";
import type { PlaceDetail } from "@/lib/mock/place";
import { cn, formatCompactCount, formatRating } from "@/lib/utils";

import { Box, BoxHScroll } from "./box";

// ── 3. Reviews summary ──────────────────────────────────────────────────

export function ReviewsSummaryBox({ place }: { place: PlaceDetail }) {
  // Brand-new places default to 5.0 across the board with 0 reviews until
  // the first real one lands; once mesita_reviews.total > 0 we trust the
  // averaged values that come in on the row.
  const hasReviews = place.mesita_reviews.total > 0;
  const overall = hasReviews ? place.mesita_reviews.overall : 5.0;
  const subRatings: Array<[string, number]> = [
    ["Food", hasReviews ? place.mesita_reviews.food : 5.0],
    ["Service", hasReviews ? place.mesita_reviews.service : 5.0],
    ["Ambience", hasReviews ? place.mesita_reviews.ambiance : 5.0],
    ["Value", hasReviews ? place.mesita_reviews.value : 5.0],
  ];
  return (
    <Box title="Reviews summary" icon={Star} iconColor="text-violet-400">
      {/* Mesita box. Layout:
            • Header row — pink "m" glyph + label + total review count.
            • Hero overall — pink-tinted square card on the left with the
              big serif rating + a gold star + "OVERALL" eyebrow.
            • Three sub-rating bars on the right (Food / Service /
              Ambiance) — pink-gradient fill proportional to value, value
              pinned to the right edge. Visual comparison beats a list of
              pills. */}
      <div className="bg-background flex flex-col gap-4 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <MesitaMark variant="sm" />
          <p className="text-foreground text-sm font-semibold">Mesita</p>
          <span className="text-muted-foreground ml-auto text-[11px]">
            {place.mesita_reviews.total} reviews
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-pink-500/10 ring-1 ring-pink-500/30">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-foreground text-2xl leading-none font-semibold">
                {formatRating(overall)!}
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

      {/* External platforms in a 3-up grid — same shape, different
          source. Three boxes paired with the Mesita box above form the
          "four boxes" reviews-summary grid. */}
      <div className="grid grid-cols-3 gap-2">
        <ExternalCard
          logo={<GoogleLogo />}
          icon="star"
          value={formatRating(place.google.rating)!}
          meta={`${formatCompactCount(place.google.count, true)} reviews`}
        />
        <ExternalCard
          logo={<InstagramLogo />}
          icon="users"
          value={formatCompactCount(place.instagram.followers, false)}
          meta="followers"
        />
        <ExternalCard
          logo={<FacebookLogo />}
          icon="users"
          value={formatCompactCount(place.facebook.followers, false)}
          meta="followers"
        />
      </div>
    </Box>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  // Pink-gradient fill proportional to value/5, value pinned to the right
  // edge in tabular nums so columns stay aligned across rows.
  const pct = Math.min(100, (value / 5) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-14 shrink-0 truncate text-[11px]">
        {label}
      </span>
      <div className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className="bg-pink-gradient absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-foreground w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums">
        {formatRating(value)!}
      </span>
    </div>
  );
}

function ExternalCard({
  logo,
  icon,
  value,
  meta,
}: {
  logo: React.ReactNode;
  icon: "star" | "users";
  value: string;
  meta: string;
}) {
  return (
    <div className="bg-background flex flex-col items-center gap-1.5 rounded-xl px-2 py-3">
      <div className="mb-1">{logo}</div>
      <div className="flex items-center gap-1 text-sm font-semibold">
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

// ── 4. Individual reviews (Reviews tab: Google + Mesita, one box each) ──

// decision: Pato — frontend-only review sort (no EF) for both Google and
// Mesita. Newest default; Highest / Lowest by rating. Google uses published
// date; Mesita uses avg(food/service/ambiance/value) and keeps source order
// for Newest until visitors carry a date field.
type ReviewSort = "newest" | "highest" | "lowest";

const REVIEW_SORTS: { key: ReviewSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "highest", label: "Highest" },
  { key: "lowest", label: "Lowest" },
];

function reviewTimeMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

function mesitaOverall(v: PlaceDetail["mesita_visitors"][number]): number {
  return (v.food + v.service + v.ambiance + v.value) / 4;
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
          className={cn(
            "flex-1 rounded-lg py-1.5 text-xs font-semibold transition",
            sort === mode.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

export function GoogleReviewsBox({ place }: { place: PlaceDetail }) {
  const [sort, setSort] = useState<ReviewSort>("newest");
  const reviews = place.google_reviews;
  const sorted = useMemo(() => {
    const copy = [...reviews];
    copy.sort((a, b) => {
      if (sort === "highest") {
        return (
          b.rating - a.rating || reviewTimeMs(b.date) - reviewTimeMs(a.date)
        );
      }
      if (sort === "lowest") {
        return (
          a.rating - b.rating || reviewTimeMs(b.date) - reviewTimeMs(a.date)
        );
      }
      return reviewTimeMs(b.date) - reviewTimeMs(a.date);
    });
    return copy;
  }, [reviews, sort]);

  if (reviews.length === 0) return null;
  return (
    <Box
      title="Google reviews"
      icon={Star}
      iconColor="text-amber-400"
      right={`${formatCompactCount(place.google.count, true)} total`}
    >
      <ReviewSortChips
        sort={sort}
        onSort={setSort}
        label="Sort Google reviews"
      />
      <BoxHScroll>
        {sorted.map((data, i) => (
          <ReviewCard
            key={`google-${data.author}-${data.date}-${i}`}
            kind="google"
            data={data}
          />
        ))}
      </BoxHScroll>
    </Box>
  );
}

export function MesitaReviewsBox({ place }: { place: PlaceDetail }) {
  // Always render below Google reviews — when there are no Mesita
  // visitors yet, show an explicit empty state instead of hiding the box
  // (Safi and other new places were dropping the section entirely).
  const [sort, setSort] = useState<ReviewSort>("newest");
  const visitors = place.mesita_visitors;
  const sorted = useMemo(() => {
    if (sort === "newest") return visitors;
    const copy = [...visitors];
    copy.sort((a, b) => {
      const diff = mesitaOverall(b) - mesitaOverall(a);
      return sort === "highest" ? diff : -diff;
    });
    return copy;
  }, [visitors, sort]);

  if (visitors.length === 0) {
    return (
      <Box
        title="Mesita reviews"
        icon={MessageCircle}
        iconColor="text-pink-400"
        right={`${place.mesita_reviews.total} total`}
      >
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
            <MessageCircle className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm font-semibold">
              No Mesita reviews yet
            </p>
            <p className="text-muted-foreground text-xs leading-snug">
              Be the first guest to leave a review after visiting.
            </p>
          </div>
        </div>
      </Box>
    );
  }
  return (
    <Box
      title="Mesita reviews"
      icon={MessageCircle}
      iconColor="text-pink-400"
      right={`${place.mesita_reviews.total} total`}
    >
      <ReviewSortChips
        sort={sort}
        onSort={setSort}
        label="Sort Mesita reviews"
      />
      <BoxHScroll>
        {sorted.map((data, i) => (
          <ReviewCard
            key={`mesita-${data.handle}-${i}`}
            kind="mesita"
            data={data}
          />
        ))}
      </BoxHScroll>
    </Box>
  );
}

// ── Individual review cards live in @/components/consumer/ReviewCard
//    (client) — taller layout, optional photo thumbnail, "Read more"
//    toggle when the quote runs long.
