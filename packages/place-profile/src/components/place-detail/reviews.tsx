"use client";

import { useMemo, useState } from "react";
import { ChevronDown, MessageSquare } from "lucide-react";

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
//
// SORT IS BACK AS ONE MENU (Pato, MESITA-2927: "add something to sort
// reviews by ... time or best or worst"). Not the old chip row: a small
// "Newest ▾" pill at the right end of the privacy line, so the first review
// stays where it was. Newest · Best · Worst, over the reviews we store (the
// newest 100, render/src/reviews.ts), ties newest first. Google's own
// "relevant" order would need a second scrape, so it is not offered.
// The red G moved off every row to that line: it says the source once.
//
// NO PILL (Pato, MESITA-2956: "the newest / best / worst sorting looks like
// shit"). The white pill was a native select, so the browser drew its own
// chevron jammed against the pill's edge. Now the select draws nothing of
// its own (appearance-none): "Newest" and a lucide chevron in the line's own
// type, on the grey page. Still a native select, so a phone opens its own
// picker; the 44px tap height is padding, cancelled by negative margin so
// the line keeps its height.
//
// ONE WHITE CARD (Pato, MESITA-2944: "white backgrounf for the reviews with
// a small gray border beteween them"). The reviews sit in one white card on
// the grey page, a hairline between rows, and Show more is the card's last
// row instead of a floating pill. This reverses MESITA-2309's "no box"; the
// privacy line stays above the card, Leave a review stays its own card.

/** How many reviews the list shows before the next Show more. */
export const REVIEW_PAGE = 5;

type ReviewSort = "newest" | "best" | "worst";

const SORT_LABEL: Record<ReviewSort, string> = {
  newest: "Newest",
  best: "Best",
  worst: "Worst",
};

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
      className="bg-card text-card-foreground hover:bg-card/80 mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
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
  const [sort, setSort] = useState<ReviewSort>("newest");
  const reviews = place.google_reviews;
  const sorted = useMemo(
    () =>
      [...reviews].sort((a, b) => {
        if (sort === "best" && a.rating !== b.rating)
          return b.rating - a.rating;
        if (sort === "worst" && a.rating !== b.rating)
          return a.rating - b.rating;
        return reviewTimeMs(b.date) - reviewTimeMs(a.date);
      }),
    [reviews, sort],
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
      <div className="text-muted-foreground flex items-center gap-1.5 pt-5 text-xs">
        <GoogleLogo tiny />
        <span className="flex-1">Names hidden for privacy</span>
        {sorted.length > 1 && (
          <div className="text-foreground relative -my-3.5 flex items-center">
            <select
              aria-label="Sort reviews"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ReviewSort);
                setShown(REVIEW_PAGE);
              }}
              className="h-11 cursor-pointer appearance-none bg-transparent pr-5 pl-3 text-xs font-semibold"
            >
              {(Object.keys(SORT_LABEL) as ReviewSort[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABEL[key]}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-0 size-3.5"
              strokeWidth={2.5}
            />
          </div>
        )}
      </div>
      <div className="bg-card divide-border mt-3 flex flex-col divide-y overflow-hidden rounded-xl">
        <ul className="divide-border divide-y">
          {sorted.slice(0, shown).map((review, i) => (
            <li key={`google-${review.date}-${i}`} className="p-4">
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
        {shown < sorted.length && (
          <button
            type="button"
            onClick={() => setShown((n) => n + REVIEW_PAGE)}
            className="text-foreground hover:bg-muted/50 min-h-12 w-full text-sm font-semibold"
          >
            Show more
          </button>
        )}
      </div>
      <LeaveGoogleReview url={reviewUrl} onOpenLink={onOpenLink} />
    </section>
  );
}

// ── Individual review cards live in ../ReviewCard (client) — stars,
//    date, and a "Read more" toggle when the quote runs long.
