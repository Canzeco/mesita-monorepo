"use client";

// Reservations — table bookings, through the venue's own provider.
//
// Mesita does not hold the tables. The provider does, and this view is the
// window onto it — which is why a booking can be `requested` here and confirmed
// somewhere else, and why the state column is the only thing on the page that
// matters.
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { RESERVATIONS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockReservation } from "@/mock/types";
import { dayTime } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS } from "@/lib/ui-classes";

const STATE_TONE: Record<MockReservation["state"], "good" | "warn" | "bad" | "neutral"> = {
  confirmed: "good",
  seated: "good",
  requested: "warn",
  no_show: "bad",
  canceled: "neutral",
};

export function ReservationsView() {
  const place = useHeldPlace();
  const { scenario, now } = useMock();
  const rows = listFor(RESERVATIONS.filter((r) => r.placeId === place.id), scenario);

  const upcoming = rows.filter((r) => new Date(r.at) > now);

  const columns: Column<MockReservation>[] = [
    { key: "guest", head: "Guest", cell: (r) => <span className="font-medium">{r.guest}</span> },
    { key: "at", head: "When", cell: (r) => <span className="text-muted-foreground">{dayTime(r.at)}</span> },
    { key: "party", head: "Party", align: "right", cell: (r) => r.party },
    { key: "note", head: "Note", cell: (r) => <span className="text-muted-foreground">{r.note ?? "—"}</span> },
    { key: "state", head: "State", cell: (r) => <Badge tone={STATE_TONE[r.state]}>{r.state.replace("_", " ")}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tiles
        tiles={[
          { label: "Reservations", value: place.reservations ? "On" : "Off" },
          { label: "Upcoming", value: upcoming.length || null },
          { label: "Awaiting you", value: rows.filter((r) => r.state === "requested").length || null },
          { label: "No-shows", value: rows.filter((r) => r.state === "no_show").length || null, hint: "In the list below" },
        ]}
      />
      <Half label="Manage">
        <Section
          title="Your provider"
          description="Mesita shows the bookings and sends the guest. Your provider holds the tables."
          right={<button type="button" className={GHOST_PILL_BUTTON_CLASS}>Change provider</button>}
          lane
        >
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            {place.reservations
              ? "Bookings made in the Mesita app land with your provider immediately. A change made on their side shows up here on the next read."
              : "Reservations are off for this place, so the guest's app shows no Book button and nothing new can arrive."}
          </p>
        </Section>
      </Half>
      <Half label="Activity">
        <Section title="Bookings" description="Soonest first, then the ones that have passed.">
          <Table
            columns={columns}
            rows={rows}
            empty={
              <EmptyState
                title="No bookings"
                hint={place.reservations ? "Nothing booked yet." : "Reservations are off for this place."}
              />
            }
          />
        </Section>
      </Half>
    </div>
  );
}
