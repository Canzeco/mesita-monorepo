"use client";

// THE THREE PASSIVE BOXES that close Profile (MESITA-1930), and the one
// wrapper that keeps them together.
//
//   1. Digital Presence — four numbers: Google · Mesita · Instagram · Facebook.
//   2. Google Reviews   — what Maps carries, sideways.
//   3. Mesita Reviews   — what guests wrote here, sideways, under the four
//                         sub-scores that used to sit on box 1.
//
// ONE COLUMN, and that is what the wrapper is for. Every other card on Profile
// is a direct `<section>` child of the masonry, which deals them into whatever
// column has room — fine for cards that are independent, wrong for three that
// are one subject read top to bottom. Wrapping them in a single
// `break-inside-avoid` block makes the masonry treat the trio as one card, so
// the aggregate always sits above the reviews it aggregates. The gap and the
// bottom margin are hand-set here because the masonry's `[&>section]` rules
// only reach DIRECT section children, and these three are now nested.
//
// Everything in all three is read-only. None of them registers a dirty
// section, so the save bar still never learns any of them exist.

import { DigitalPresence } from "./DigitalPresence";
import { ReviewsList } from "./ReviewsList";
import { usePlaceContext } from "./PlaceContext";
import { GOOGLE_REVIEWS, REVIEWS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockPlaceProfile } from "@/mock/types";

function SubScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground type-label">{label}</span>
      <span
        className={
          "text-sm font-semibold tabular-nums " +
          (value == null ? "text-muted-foreground" : "text-foreground")
        }
      >
        {value == null ? "—" : value.toFixed(1)}
      </span>
    </div>
  );
}

export function ReviewBoxes({ place }: { place: MockPlaceProfile }) {
  const { placeId } = usePlaceContext();
  const { scenario } = useMock();

  const google = listFor(
    GOOGLE_REVIEWS.filter((r) => r.placeId === placeId),
    scenario,
  );
  const mesita = listFor(
    REVIEWS.filter((r) => r.placeId === placeId),
    scenario,
  );

  const mesitaCount = place.mesita_review_count ?? 0;
  // The breakdown only exists once a guest has actually scored the place — an
  // unreviewed place must never render four fabricated numbers.
  const subScores =
    mesitaCount > 0
      ? ([
          { label: "Food", value: place.mesita_stars_food },
          { label: "Service", value: place.mesita_stars_service },
          { label: "Ambience", value: place.mesita_stars_ambience },
          { label: "Value", value: place.mesita_stars_value },
        ] as const)
      : null;

  return (
    <div className="mb-4 flex break-inside-avoid flex-col gap-4 lg:mb-5 lg:gap-5">
      <DigitalPresence place={place} />

      <ReviewsList
        source="google"
        title="Google Reviews"
        subtitle="What people wrote on Maps, including the ones who never used Mesita."
        reviews={google}
        emptyTitle="Nothing scraped yet"
        emptyHint="Google reviews land here once this place has been enriched. Nothing to do — it is not a step anybody takes."
      />

      <ReviewsList
        source="mesita"
        title="Mesita Reviews"
        subtitle="What guests scored after a visit here, and the four things they scored."
        reviews={mesita}
        emptyTitle="No reviews yet"
        emptyHint="A guest can only review a visit Mesita settled. The first one arrives on its own."
      >
        {subScores ? (
          <div className="border-border/60 mt-5 grid grid-cols-2 gap-3 rounded-xl border px-3.5 py-3 sm:grid-cols-4">
            {subScores.map((s) => (
              <SubScore key={s.label} label={s.label} value={s.value} />
            ))}
          </div>
        ) : null}
      </ReviewsList>
    </div>
  );
}
