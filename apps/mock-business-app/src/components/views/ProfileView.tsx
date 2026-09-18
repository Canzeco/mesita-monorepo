"use client";

// Profile — the place's public page, and the only view a POOL place has.
//
// IT IS THE REAL SCREEN NOW (MESITA-1907). What stood here was a sketch: four
// tiles, one read-only six-field form, a grid of empty squares and a row of
// day chips. It was smaller, quieter and easier than the console's tallest
// form, which made it useless for the one thing this app exists to do — a
// harness whose most-looked-at screen is a DIFFERENT screen proves nothing
// about the screen it stands in for.
//
// `ProfileCompleteness` over `PlaceSection`'s five-card masonry, with the one
// floating save, is what `apps/web-business`'s `ProfileTab` renders. The
// differences are catalogued in those files and every one of them is the
// absent backend.
//
// Always free, on every place, partner or not. It is also the only view that
// renders for a place the caller holds no membership on.
import { NotHeld, usePlaceScope } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { PlaceFormProvider } from "@/components/place-manage/PlaceContext";
import { PlaceSaveBar } from "@/components/place-manage/PlaceSaveBar";
import { PlaceSection } from "@/components/place-manage/PlaceSection";
import { ProfileCompleteness } from "@/components/place-manage/ProfileCompleteness";
import { useMock } from "@/mock/MockStore";
import { PILL_BUTTON_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";

export function ProfileView() {
  const { place, pool } = usePlaceScope();
  const { world } = useMock();

  if (!place && pool) {
    return (
      <div className="flex flex-col gap-4">
        <Section
          title="Nobody holds this place"
          description="Mesita knows it is real. Until somebody claims it, there is no owner to edit it and no manage surface under it."
          right={<button type="button" className={PILL_BUTTON_CLASS}>Claim</button>}
          lane
        >
          <dl className="@container grid grid-cols-1 gap-3 @lg:grid-cols-2">
            <div>
              <dt className={TINY_LABEL_CLASS}>Category</dt>
              <dd className="text-sm">{pool.category}</dd>
            </div>
            <div>
              <dt className={TINY_LABEL_CLASS}>City</dt>
              <dd className="text-sm">{pool.city}</dd>
            </div>
          </dl>
        </Section>
      </div>
    );
  }

  // Neither held nor in the pool: the read failed. A blank page was the old
  // answer, which reads as a place with nothing in it.
  if (!place) return <NotHeld />;

  const profile = world.profiles[place.id];
  // A held place with no profile record cannot happen — `PROFILES` is keyed by
  // the same four ids `PLACES` is — so this is a bug, not a state, and the
  // failed-read empty state is the honest thing to show if it ever is one.
  if (!profile) return <NotHeld />;

  // A VIEWER GETS THE SAME SCREEN, and the same save bar. Nothing in the real
  // `PlaceSection` reads the role, so a viewer there types into every field
  // and presses Save; the EF is what refuses. Hiding the bar here would be a
  // kinder screen than the one it stands in for, which is the one thing a
  // harness may not be. See `VIEWER_REFUSAL`.
  const readOnly = place.myRole === "viewer";

  return (
    <PlaceFormProvider placeId={place.id} profile={profile} readOnly={readOnly}>
      {/* `key` on the place id, so switching places in the rail rebuilds the
          form from the new place's record rather than carrying the old one's
          unsaved text across — the same reason the real screen remounts on a
          `placeId` change. */}
      <div key={place.id} className="flex flex-col">
        <ProfileCompleteness place={profile} />
        <PlaceSection place={profile}>
        </PlaceSection>
        <PlaceSaveBar />
      </div>
    </PlaceFormProvider>
  );
}
