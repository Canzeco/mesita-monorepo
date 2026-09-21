"use client";

// Reservations — table bookings, through the venue's own provider.
//
// Mesita does not hold the tables. The provider does, and this view is the
// window onto it — which is why a booking can be `requested` here and confirmed
// somewhere else, and why the state column is the only thing on the page that
// matters.
//
// ── SETUP STANDARD (MESITA-2034) ────────────────────────────────────────────
//
// Three Groups: Rules (4 rows), Where new bookings are announced (1 input
// row), Your provider (one row, `allowOneRow` — a single fact with a single
// action, the same shape Visits' door row uses).
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Group } from "@/components/shared/Group";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Rule } from "@/components/shared/Rule";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { RESERVATIONS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockReservation } from "@/mock/types";
import { dayTime } from "@/lib/format";

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
        <Group title="Rules" description="What a guest may book. Everything else — which table, who is seated — stays with your provider." footer="Every owner and editor can change these rules.">
          <Rule label="Hours" note="When a booking may start." control={{ kind: "value", text: "Your opening hours" }} />
          <Rule label="Party size" note="Bigger groups go to a person." control={{ kind: "value", text: "1 – 8" }} />
          <Rule label="Lead time" note="How far ahead a guest may book." control={{ kind: "value", text: "1 h – 30 days" }} />
          <Rule label="Confirmation" note="Confirm each one by hand, or let the provider hold it at once." control={{ kind: "value", text: <Badge tone="on">Automatic</Badge> }} />
        </Group>
        <Group title="Where new bookings are announced" description="Always here. And on one WhatsApp number per place, the same one Online Orders uses — set it on either screen.">
          <Rule
            label="Notifications number"
            note={place.notificationsNumber ? "New, changed and cancelled bookings, and reminders, arrive here." : "None yet. Until there is one, bookings are only on this screen."}
            control={{
              kind: "input",
              value: place.notificationsNumber ?? "",
              onChange: () => {},
              placeholder: "+52 81 …",
            }}
          />
        </Group>
        <Group title="Your provider" allowOneRow>
          <Rule
            label={place.reservations ? "Bookings sync automatically" : "Reservations are off"}
            note={
              place.reservations
                ? "Bookings made in the Mesita app land with your provider immediately. A change made on their side shows up here on the next read."
                : "The guest's app shows no Book button and nothing new can arrive."
            }
            control={{ kind: "button", label: "Change provider", onClick: () => {} }}
          />
        </Group>
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
