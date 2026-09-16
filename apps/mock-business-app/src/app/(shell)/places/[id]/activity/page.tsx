"use client";

// Activity — counts over time, and the payments log.
//
// It is a PAGE under the place, not a view of it, and it came back to the place
// after a spell under a layer that no longer exists.
import { NotHeld, useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { Section } from "@/components/shared/Section";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { ACTIVITY } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { money, since } from "@/lib/format";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";

export default function PlaceActivityPage() {
  const place = useHeldPlaceOrNull();
  const { scenario, now } = useMock();
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;

  const events = listFor(ACTIVITY.filter((e) => e.placeId === place.id), scenario);

  const payouts = events.filter((e) => e.kind === "payout");

  return (
    <>
      <PlaceHeading place={place} view="Activity" />

      <Tiles
        tiles={[
          { label: "Events shown", value: events.length || null },
          { label: "Payouts", value: payouts.length || null },
          {
            label: "Paid out",
            value: payouts.length ? money(payouts.reduce((n, e) => n + (e.amountCents ?? 0), 0)) : null,
            hint: "Of the payouts below",
          },
          { label: "Newest", value: events[0] ? since(events[0].at, now) : null },
        ]}
      />

      <Section title="Everything that happened here" description="Newest first. The payments log lives here, not on the Payments view.">
        {events.length === 0 ? (
          <EmptyState title="Nothing yet" hint="Activity starts the first time a guest does something here." />
        ) : (
          <ol className="flex flex-col">
            {events.map((e) => (
              <li
                key={e.id}
                className="border-border flex items-center gap-3 border-b py-2.5 last:border-0"
              >
                <Badge>{e.kind}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{e.title}</p>
                  <p className="text-muted-foreground truncate text-[11px]">{e.detail}</p>
                </div>
                {e.amountCents !== null && (
                  <p className="text-[13px] font-semibold tabular-nums">{money(e.amountCents)}</p>
                )}
                <p className={`${TINY_LABEL_CLASS} w-16 shrink-0 text-right`}>{since(e.at, now)}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}
