"use client";

// THE VENUE, NAMED ON THE PAGE — back on exactly two screens (MESITA-1975).
//
// MESITA-1943 deleted this component's ancestor from all seven place screens,
// and the argument was sound at the time: *"the rail says the name, the photo
// and the view"*, so a heading repeating them was chrome restating the column
// beside it. THE RAIL IS GONE. The menu above is four words — Place, Setup,
// Activity, Settings — and not one of them says which venue you are editing.
// An operator holding two restaurants had nothing on Setup to tell them apart.
//
// SO IT COMES BACK WHERE THE PREMISE BROKE, AND NOWHERE ELSE. Setup and
// Activity are the two place-scoped PAGES. The nine product VIEWS
// (`/places/<id>/visits` and friends) are drilled into from Setup, which is on
// screen behind them and still lit in the menu, and they keep `AppShell`'s
// sr-only `h1`. Restoring a visible heading there would put the venue's name on
// thirteen screens to solve it on two.
//
// IT IS ALSO THE OUTLINE'S ROOT. `Section` renders `h3`, so with no heading at
// all these pages opened on an h3 with h1 AND h2 skipped — axe flags it, and
// VoiceOver's rotor has nothing to land on. `AppShell` therefore stops emitting
// its sr-only title for these two: two `h1`s saying the same words is worse for
// a rotor than the missing root this replaces.
//
// THE PAGE NAME IS A KICKER, NOT THE HEADING. The subject is the venue; "Setup"
// is which of its screens you are on. Sized and coloured to sit under the name
// rather than beside it as an equal, and baseline-aligned so the two read as
// one line rather than as a title and a badge.
import { PlaceChip } from "@/components/console/PlaceChip";

export function PlaceHeading({
  name,
  photoUrl,
  page,
}: {
  name: string;
  photoUrl: string | null;
  /** The page's own label — "Setup", "Activity". */
  page: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="flex items-center gap-2.5 self-center">
        <PlaceChip photoUrl={photoUrl} />
        <h1 className="font-display truncate text-xl font-semibold tracking-tight">
          {name}
        </h1>
      </span>
      <p className="text-muted-foreground text-[12px] font-medium">{page}</p>
    </div>
  );
}
