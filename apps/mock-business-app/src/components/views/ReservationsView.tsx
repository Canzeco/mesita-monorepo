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
import { Rule, RULES_CARD } from "@/components/shared/Rule";
import { RESERVATIONS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockReservation } from "@/mock/types";
import { dayTime } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS, INPUT_CLASS } from "@/lib/ui-classes";

const STATE_TONE: Record<MockReservation["state"], "on" | "soon" | "bad" | "neutral"> = {
  confirmed: "on",
  seated: "on",
  requested: "soon",
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
      <Half label="Activity">
        <Tiles
          tiles={[
            { label: "Reservations", value: place.reservations ? "On" : "Off" },
            { label: "Upcoming", value: upcoming.length || null },
            { label: "Awaiting you", value: rows.filter((r) => r.state === "requested").length || null },
            { label: "No-shows", value: rows.filter((r) => r.state === "no_show").length || null, hint: "In the list below" },
          ]}
        />
      </Half>
      <Half label="Manage">
        {/* THE RULES (MESITA-2017). Pato: inputs (the app, your site), rules,
            outputs. The provider holds the tables; these are the rules Mesita
            asks a guest against before it sends them there. */}
        <Section
          title="Rules"
          description="What a guest may book. Everything else — which table, who is seated — stays with your provider."
          lane
          right={<button type="button" className={`${GHOST_PILL_BUTTON_CLASS} self-start`}>Change rules</button>}
        >
          <div className={RULES_CARD}>
            <Rule label="Hours" note="When a booking may start." value="Your opening hours" />
            <Rule label="Party size" note="Bigger groups go to a person." value="1 – 8" />
            <Rule label="Lead time" note="How far ahead a guest may book." value="1 h – 30 days" />
            <Rule label="Confirmation" note="Confirm each one by hand, or let the provider hold it at once." value={<Badge tone="on">Automatic</Badge>} />
          </div>
        </Section>
        <Section
          title="Where new bookings are announced"
          description="Always here. And on one WhatsApp number per place, the same one Online Orders uses — set it on either screen."
          lane
        >
          <div className={RULES_CARD}>
            <Rule
              label="Notifications number"
              note={place.notificationsNumber ? "New, changed and cancelled bookings, and reminders, arrive here." : "None yet. Until there is one, bookings are only on this screen."}
              value={
                <input
                  aria-label="Notifications number"
                  defaultValue={place.notificationsNumber ?? ""}
                  placeholder="+52 81 …"
                  className={`${INPUT_CLASS} h-9 w-44`}
                />
              }
            />
          </div>
        </Section>
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
