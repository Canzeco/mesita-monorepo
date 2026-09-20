"use client";

// ONLINE REVIEWS — reputation, off Profile and on its own (MESITA-1993).
//
// THE PRODUCT IS "ONLINE REVIEWS"; THE CARD INSIDE IT IS "MESITA REVIEWS"
// (MESITA-1995), and the two names being different is the point. This screen
// holds what the whole internet says — Maps, Mesita, Instagram, Facebook — and
// naming the row after one of its own sections said the section was the whole
// thing.
//
// ── IT HAS TWO HALVES NOW (MESITA-2017) ────────────────────────────────────
//
// Until this issue nothing here sat inside a `Half`, on the argument that a
// review is a record, not a setting. The voice session put ONE thing an
// operator does above the records: connect the sources. Google, Instagram and
// Facebook each need a connection that can lapse, and "reconnect" is a verb
// with a place to live. So the sources are the Manage half, the trio is the
// Activity half, and `PRODUCT_HALVES` says BOTH.
//
// THE TRIO STAYS A TRIO. The aggregate and the two lists it aggregates stay
// on one screen, which is the whole reason `ReviewBoxes` is a wrapper rather
// than three siblings (MESITA-1930).
import { NotHeld, usePlaceScope } from "@/components/console/PlaceScope";
import { ReviewBoxes } from "@/components/place-manage/ReviewBoxes";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Badge } from "@/components/shared/Badges";
import { Rule, RULES_CARD } from "@/components/shared/Rule";
import { useMock } from "@/mock/MockStore";
import { REVIEW_SOURCES, REVIEW_SOURCE_LABEL } from "@/mock/types";
import { since } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

export function ReviewsView() {
  const { place } = usePlaceScope();
  const { world, now } = useMock();

  if (!place) return <NotHeld />;
  const profile = world.profiles[place.id];
  // Same impossible-state guard ProfileView carries: `PROFILES` is keyed by
  // the ids `PLACES` uses, so a held place with no record is a bug rather than
  // a state, and the failed-read screen is the honest thing to show if it ever
  // becomes one.
  if (!profile) return <NotHeld />;

  return (
    <div key={place.id} className="flex flex-col gap-4">
      <Half label="Manage">
        <Section
          title="Sources"
          description="Where the stars come from. Mesita's own never disconnects; the other three are accounts you connect once and reconnect when they lapse."
        >
          <div className={RULES_CARD}>
            {REVIEW_SOURCES.map((s) => {
              const src = place.reviewSources[s];
              return (
                <Rule
                  key={s}
                  label={REVIEW_SOURCE_LABEL[s]}
                  note={
                    src.connected
                      ? `Synced ${src.lastSyncedAt ? since(src.lastSyncedAt, now) : "just now"}.`
                      : s === "mesita"
                        ? "Always on."
                        : "Not connected. Nothing from here is counted below."
                  }
                  value={
                    <>
                      <Badge tone={src.connected ? "live" : "off"}>{src.connected ? "Connected" : "Off"}</Badge>
                      {s !== "mesita" && (
                        <button type="button" className={GHOST_PILL_BUTTON_CLASS}>
                          {src.connected ? "Reconnect" : "Connect"}
                        </button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </Section>
      </Half>
      <Half label="Activity">
        {/* NO `PlaceFormProvider`. These three cards register no dirty section
            and save nothing, which is why `ReviewBoxes` takes the id as a
            prop. */}
        <ReviewBoxes place={profile} placeId={place.id} />
      </Half>
    </div>
  );
}
