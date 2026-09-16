"use client";

// THE PLACE HEADING, NOT A PLACE BAR.
//
// It is the page's `h1` and it scrolls with the page. A sticky row restating
// the place's name and its views would be 48px of chrome saying what the rail
// beside it already says — and the sticky version of this once carried a
// hard-coded offset for a top nav that no longer existed, which put it 57px
// down its own card.
import { PlaceFacts } from "@/components/shared/Badges";
import type { MockPlace } from "@/mock/types";

export function PlaceHeading({
  place,
  view,
}: {
  place: Pick<MockPlace, "name" | "photoUrl" | "category" | "city" | "verified" | "partnered" | "promoting">;
  view: string;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3">
      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
        {place.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URI
          <img src={place.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="bg-muted block h-full w-full" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="font-display truncate text-2xl font-semibold tracking-tight">
          {place.name}
        </h1>
        <p className="text-muted-foreground truncate text-[12px]">
          {view} · {place.category} · {place.city}
        </p>
      </div>
      <PlaceFacts
        verified={place.verified}
        partnered={place.partnered}
        promoting={place.promoting}
      />
    </header>
  );
}
