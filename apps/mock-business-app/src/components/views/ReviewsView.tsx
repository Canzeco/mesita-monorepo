"use client";

// MESITA REVIEWS — reputation, off Profile and on its own (MESITA-1993).
//
// Pato, reading the Products index: *"move — Mesita Partner / Mesita Profile /
// Mesita Reviews (separate reviews shit)."*
//
// ── WHY IT LEFT ────────────────────────────────────────────────────────────
//
// `ReviewBoxes` was the tail of Profile's masonry: three read-only cards under
// twelve editable ones, inside a form with a floating save bar that none of
// them could ever dirty. PROFILE IS WHAT AN OPERATOR SETS — the name, the
// hours, the photos, the channels. This is the one thing on that screen the
// world says back, and a read-only trio at the bottom of a twelve-card form is
// where a subject goes to not be found.
//
// ── THE TRIO STAYS A TRIO ──────────────────────────────────────────────────
//
// The aggregate and the two lists it aggregates stay on ONE screen, which is
// the whole reason `ReviewBoxes` is a wrapper rather than three siblings
// (MESITA-1930): the masonry used to deal them into three columns and strand a
// number above evidence that was not its own.
//
// ── AND IT RENDERS ON BOTH SURFACES, DELIBERATELY ──────────────────────────
//
// Nothing here sits inside a `Half`, which `Half` documents as meaning "both",
// and it is the right answer for this product rather than a shortcut around
// the seam. A REVIEW IS A RECORD, NOT A SETTING: there is nothing to
// configure, so a Manage half would be empty, and putting the four counts on
// Products and the two lists on Activity would put a number on one screen and
// its evidence on another — the exact split MESITA-1930 wrapped these three to
// prevent.
import { NotHeld, usePlaceScope } from "@/components/console/PlaceScope";
import { ReviewBoxes } from "@/components/place-manage/ReviewBoxes";
import { useMock } from "@/mock/MockStore";

export function ReviewsView() {
  const { place } = usePlaceScope();
  const { world } = useMock();

  if (!place) return <NotHeld />;
  const profile = world.profiles[place.id];
  // Same impossible-state guard ProfileView carries: `PROFILES` is keyed by
  // the ids `PLACES` uses, so a held place with no record is a bug rather than
  // a state, and the failed-read screen is the honest thing to show if it ever
  // becomes one.
  if (!profile) return <NotHeld />;

  // NO `PlaceFormProvider`. These three cards register no dirty section and
  // save nothing, so wrapping them in a form context to satisfy one `placeId`
  // read would be a save bar this screen has no use for — which is why
  // `ReviewBoxes` takes the id as a prop now.
  return (
    <div key={place.id} className="flex flex-col">
      <ReviewBoxes place={profile} placeId={place.id} />
    </div>
  );
}
