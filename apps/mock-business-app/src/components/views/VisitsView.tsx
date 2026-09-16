"use client";

// Visits — the container guests arrive through, and the in-person checkout.
//
// VISITS' ZONE IS EMPTY, deliberately. Rewards is its own product again and
// owns the strategy dial; the Visits card carries no rewards clause, and this
// view carries no rewards box. One product's state must be settable in one
// place, or two screens will disagree about which dial is live.
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { VISITS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockVisit } from "@/mock/types";
import { dayTime, money } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

const STATE_TONE: Record<MockVisit["state"], "good" | "warn" | "bad"> = {
  settled: "good",
  open: "warn",
  voided: "bad",
};

export function VisitsView() {
  const place = useHeldPlace();
  const { scenario } = useMock();
  const rows = listFor(VISITS.filter((v) => v.placeId === place.id), scenario);

  const settled = rows.filter((v) => v.state === "settled");
  const columns: Column<MockVisit>[] = [
    { key: "guest", head: "Guest", cell: (v) => <span className="font-medium">{v.guest}</span> },
    { key: "at", head: "When", cell: (v) => <span className="text-muted-foreground">{dayTime(v.at)}</span> },
    { key: "method", head: "Paid with", cell: (v) => <Badge>{v.method}</Badge> },
    { key: "reward", head: "Reward", align: "right", cell: (v) => (v.rewardCents ? money(v.rewardCents) : "—") },
    { key: "total", head: "Total", align: "right", cell: (v) => <span className="font-semibold">{money(v.totalCents)}</span> },
    { key: "state", head: "State", cell: (v) => <Badge tone={STATE_TONE[v.state]}>{v.state}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tiles
        tiles={[
          { label: "Visits shown", value: rows.length || null },
          { label: "Settled", value: settled.length || null },
          {
            label: "Settled total",
            // A sum OF THE ROWS ON SCREEN, labelled as such. The moment a
            // total's scope is not written on it, somebody reads it as the
            // place's revenue.
            value: settled.length ? money(settled.reduce((n, v) => n + v.totalCents, 0)) : null,
            hint: "Of the visits below",
          },
          { label: "Open now", value: rows.filter((v) => v.state === "open").length || null },
        ]}
      />
      <Section
        title="Visit checkout"
        description="How a bill is closed at the table. The guest scans, the reward applies, and the visit settles."
        right={<button type="button" className={GHOST_PILL_BUTTON_CLASS}>How it works</button>}
        lane
      >
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          Every visit below arrived through the guest&rsquo;s own app. There is no
          terminal to install and nothing for staff to press: the reward is
          applied before the total is shown, which is the only moment a guest
          will believe it.
        </p>
      </Section>
      <Section title="Recent visits" description="Newest first.">
        <Table
          columns={columns}
          rows={rows}
          empty={
            <EmptyState
              title="No visits yet"
              hint="A visit appears the first time a guest closes a bill here with Mesita."
            />
          }
        />
      </Section>
    </div>
  );
}
