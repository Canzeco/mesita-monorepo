"use client";

import { useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";

import { GoogleLogo } from "../BrandLogos";
import { ReviewCard } from "../ReviewCard";
import type { PlaceActions } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { PlaceEmptyScreen } from "./empty-screen";
import { OutboundLink } from "./location-hours";

// decision: Pato (2026-10-16) — the channel counts live in the header and
// hide while this tab is selected. What remains is Google's reviews, stacked
// like comments: a first batch, then Show more. Not a sideways carousel.
// Show more reveals more reviews; a long quote still uses its own Read more.
//
// decision: Pato (2026-10-18, MESITA-2309) — one flat list on the page, the
// way Google Maps lists them: no box, no "Google reviews" title (each
// review's G already says where it came from), no card per review, a
// hairline between reviews.
//
// THE LIST STARTS AT THE FIRST REVIEW (Pato, MESITA-2618: "remove the stupid
// sorting of reviews. neither mention the number of reviews ... just show
// the reviews directly. the number of reviews its already told upside").
// The Newest · Highest · Lowest chips and the "395 reviews" line are gone:
// the header's Google column already prints the count ("4.9 ★ (395)"), and
// the one order is newest first.

/** How many reviews the list shows before the next Show more. */
export const REVIEW_PAGE = 5;

function reviewTimeMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

// ANONYMOUS (Pato, MESITA-2916: "to minimize legal problems ... don't
// mention the names, just mention the stars and the comments"). Each review
// is stars · date · comment; one line above the list says why there are no
// names. consumer-web-get-place strips the author before the payload leaves.
//
// LEAVE A REVIEW (Pato, MESITA-2916: "a button pointing to google to leave
// reviews"): Google's own write-review form for this place, under the list
// and on the empty screen. No Google id, no button.

function LeaveGoogleReview({
  url,
  onOpenLink,
}: {
  url: string | undefined;
  onOpenLink?: PlaceActions["onOpenLink"];
}) {
  if (!url) return null;
  return (
    <OutboundLink
      url={url}
      onOpenLink={onOpenLink}
      className="border-border text-foreground hover:bg-muted mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold"
    >
      <GoogleLogo compact />
      Leave a review on Google
    </OutboundLink>
  );
}

export function GoogleReviewsBox({
  place,
  onOpenLink,
}: {
  place: PlaceDetail;
  onOpenLink?: PlaceActions["onOpenLink"];
}) {
  const reviewUrl = place.reviews_maps.google_review_url;
  const [shown, setShown] = useState(REVIEW_PAGE);
  const reviews = place.google_reviews;
  const sorted = useMemo(
    () =>
      [...reviews].sort(
        (a, b) => reviewTimeMs(b.date) - reviewTimeMs(a.date),
      ),
    [reviews],
  );

  // NO REVIEWS YET (Pato, MESITA-2682: "write the frontend in the case a
  // place doesn't has reviews yet"): the tab used to draw nothing at all.
  // It is the Soon tabs' empty screen, with a speech bubble.
  if (reviews.length === 0) {
    return (
      <div className="flex flex-col pb-4">
        <PlaceEmptyScreen
          icon={MessageSquare}
          title="No reviews yet"
          line="Reviews of this place will show up here."
        />
        <LeaveGoogleReview url={reviewUrl} onOpenLink={onOpenLink} />
      </div>
    );
  }
  return (
    <section className="flex flex-col pb-4" aria-label="Reviews">
      <p className="text-muted-foreground pt-4 text-xs">
        Reviewer names are hidden to respect their privacy.
      </p>
      <ul className="divide-border divide-y">
        {sorted.slice(0, shown).map((review, i) => (
          <li
            key={`google-${review.date}-${i}`}
            className="py-4"
          >
            <ReviewCard review={review} />
          </li>
        ))}
      </ul>
      {shown < sorted.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + REVIEW_PAGE)}
          className="border-border text-foreground hover:bg-muted w-full border-t py-3 text-sm font-semibold"
        >
          Show more
        </button>
      )}
      <LeaveGoogleReview url={reviewUrl} onOpenLink={onOpenLink} />
    </section>
  );
}

// ── Individual review cards live in ../ReviewCard (client) — stars,
//    date, and a "Read more" toggle when the quote runs long.
