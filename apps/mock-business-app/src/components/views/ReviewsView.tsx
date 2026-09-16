"use client";

// Reviews — what guests wrote, and the one reply the venue gets.
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { REVIEWS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { day, stars } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";

export function ReviewsView() {
  const place = useHeldPlace();
  const { scenario } = useMock();
  const reviews = listFor(REVIEWS.filter((r) => r.placeId === place.id), scenario);

  // The count is the PLACE's own, not this page's: the list is the most recent
  // handful, and printing `reviews.length` beside "reviews" would quietly
  // redefine the word to mean "reviews on this screen".
  return (
    <div className="flex flex-col gap-4">
      <Tiles
        tiles={[
          { label: "Rating", value: place.rating.toFixed(1) },
          { label: "Reviews", value: place.reviewCount, hint: "All time" },
          { label: "Replied", value: reviews.filter((r) => r.reply).length, hint: "Of the recent ones" },
          { label: "Recent", value: reviews.length || null, hint: "Shown below" },
        ]}
      />
      <Section title="Recent reviews" description="Newest first. A reply is public and cannot be edited after a day.">
        {reviews.length === 0 ? (
          <EmptyState title="No reviews yet" hint="They arrive after guests visit." />
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="border-border rounded-xl border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{r.guest}</p>
                  <p className="text-muted-foreground text-[12px]">
                    <span aria-hidden className="text-[color:var(--tier-gold)]">{stars(r.stars)}</span>
                    <span className="sr-only">{r.stars} out of 5</span> · {day(r.at)}
                  </p>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed">{r.body}</p>
                {r.reply ? (
                  <div className="border-border mt-2 border-l-2 pl-3">
                    <p className={TINY_LABEL_CLASS}>Your reply</p>
                    <p className="text-muted-foreground text-[12px] leading-relaxed">{r.reply}</p>
                  </div>
                ) : (
                  <button type="button" className={`${GHOST_PILL_BUTTON_CLASS} mt-2`}>
                    Reply
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
