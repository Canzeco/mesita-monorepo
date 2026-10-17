"use client";

import { useState } from "react";
import { GoogleLogo } from "./BrandLogos";
import { Header, Quote, StarRow, Thumbnail } from "./review-card-parts";
import { firstInitial } from "../lib/format";
import type { PlaceDetail } from "../place-detail";

// One Google review card. Lives in its own client file because the
// long-quote read-more toggle needs state.
//
//   [Avatar] [Name + date]                          [Google logo]
//   ★★★★★
//   "Quote..." (truncated)
//   [Read more]                                     (when truncated)
//   [Photo thumbnail]                               (when present)

const LONG_QUOTE_THRESHOLD = 220;

export function ReviewCard({
  review,
}: {
  review: PlaceDetail["google_reviews"][number];
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.quote.length > LONG_QUOTE_THRESHOLD;
  return (
    <article className="bg-background flex w-full flex-col gap-3 rounded-2xl p-4">
      <Header
        avatar={
          <div className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
            {firstInitial(review.author)}
          </div>
        }
        name={review.author}
        sub={formatReviewDate(review.date)}
        sourceLogo={<GoogleLogo />}
      />
      <StarRow rating={review.rating} />
      <Quote
        text={review.quote}
        truncated={isLong && !expanded}
        onExpand={isLong && !expanded ? () => setExpanded(true) : undefined}
      />
      {review.photo_url && (
        <Thumbnail
          src={review.photo_url}
          alt={`${review.author}'s photo`}
          aspect={review.photo_aspect ?? "landscape"}
        />
      )}
    </article>
  );
}

/** Enricher stores ISO `published`; mocks use relative strings — show either cleanly. */
function formatReviewDate(raw: string): string {
  if (!raw) return "";
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return raw;
  const diffMs = Date.now() - t;
  if (diffMs < 0) {
    return new Date(t).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const day = 86_400_000;
  if (diffMs < day) return "Today";
  if (diffMs < 2 * day) return "Yesterday";
  if (diffMs < 7 * day) {
    const n = Math.floor(diffMs / day);
    return `${n} day${n === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 30 * day) {
    const n = Math.floor(diffMs / (7 * day));
    return `${n} week${n === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 365 * day) {
    const n = Math.floor(diffMs / (30 * day));
    return `${n} month${n === 1 ? "" : "s"} ago`;
  }
  const n = Math.floor(diffMs / (365 * day));
  return `${n} year${n === 1 ? "" : "s"} ago`;
}
