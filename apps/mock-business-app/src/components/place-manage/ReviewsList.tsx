"use client";

// THE REVIEWS THEMSELVES — one box per platform, each a sideways scroller.
//
// New with MESITA-1930. Profile used to close with one card of aggregates: it
// said a place scored 4.6 and never showed a single sentence anybody wrote,
// which is the half an operator actually reads.
//
// SIDEWAYS, NOT STACKED, and the masonry is the reason. These boxes live in a
// column beside Basics and Photos — ~440px at lg, ~700px at the two-column
// ceiling (MESITA-1940); twenty reviews stacked there would
// make Profile scroll for a screen and a half and push every other card out of
// reach. A scroller keeps each box the height of ONE review and puts the rest
// one swipe away — a card and a half is visible at rest, which is what says
// there are more.
//
// PASSIVE. No reply box, no moderation, no sort. Every row is somebody else's
// writing, and the console has no verb for it today; an affordance that did
// nothing would be worse than the absence. Both boxes wear the same `auto`
// pill Digital Presence does, for the same reason.
//
// GOOGLE ROWS ARE A MOCK-ONLY PROPOSAL. The real console does not proxy them —
// `apps/web-business/.../ReviewsSummary.tsx` says Google reviews "stay one
// click away on Google" — so this box stands for a screen the product has not
// built. Reaching a state nobody can reach yet is what this app is for; the
// Mesita box below it is a snapshot of `MesitaReviewsList`, which is real.

import { MessageSquare, Star } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionCard } from "@/components/admin-ui/manage";
import { AutoPill, Stars } from "./DigitalPresence";
import { day } from "@/lib/format";
import type { MockReview } from "@/mock/types";

/** The scrollport. The padding sits on the SCROLLER, not the track, so the
 *  swipe reaches the edge of the card and the first review is not flush
 *  against it — the same solution the Rewards tables use. The negative margins
 *  match `SectionCard`'s own `p-5 sm:p-6`. */
const SCROLLPORT =
  "-mx-5 mt-5 overflow-x-auto px-5 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:thin]";

/** Fixed width, not a fraction: a percentage would show exactly one card in a
 *  narrow column and nothing would say the box scrolls. 17rem leaves a slice
 *  of the next card visible at every width this column takes. */
const CARD =
  "border-border/60 bg-muted/40 flex w-[17rem] shrink-0 snap-start flex-col gap-2.5 rounded-xl border px-3.5 py-3";

function ReviewCard({ review }: { review: MockReview }) {
  return (
    <article className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="text-base leading-none font-semibold tabular-nums">
            {review.stars.toFixed(1)}
          </span>
          <Stars value={review.stars} />
        </span>
        <span className="text-muted-foreground type-label">{day(review.at)}</span>
      </div>

      <p className="truncate text-sm font-semibold">{review.guest}</p>

      {/* Four lines, then an ellipsis. A card that grows to fit its longest
          review would set the height of the whole scroller from one outlier,
          and every other card would sit in a field of white. */}
      <p className="text-foreground/90 line-clamp-4 text-[13px] leading-relaxed">
        {review.body}
      </p>

      {/* Only Mesita rows can carry one — `reply` is always null on Google
          (see MockReview), because Google's owner replies are written on
          Google and this console has no way to send one. */}
      {review.reply ? (
        <p className="border-border/60 text-muted-foreground border-t pt-2 text-[12px] leading-relaxed">
          <span className="text-foreground/70 font-semibold">You replied · </span>
          {review.reply}
        </p>
      ) : null}
    </article>
  );
}

export function ReviewsList({
  title,
  subtitle,
  source,
  reviews,
  emptyTitle,
  emptyHint,
  children,
}: {
  title: string;
  subtitle: string;
  source: "google" | "mesita";
  reviews: MockReview[];
  emptyTitle: string;
  emptyHint: string;
  /** Rides above the scroller — today only Mesita's sub-score row. */
  children?: React.ReactNode;
}) {
  return (
    <SectionCard
      icon={
        source === "google" ? (
          <Star className="h-4 w-4" />
        ) : (
          <MessageSquare className="h-4 w-4" />
        )
      }
      title={title}
      subtitle={subtitle}
      action={<AutoPill />}
    >
      {children}

      {reviews.length === 0 ? (
        // "empty", never "failed": a place with no reviews is a successful
        // read of nothing, and there is no Retry for it — and no invitation
        // either, because the operator cannot write one of these.
        <EmptyState className="mt-5" title={emptyTitle} hint={emptyHint} />
      ) : (
        <div className={SCROLLPORT}>
          <div className="flex snap-x gap-3">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
