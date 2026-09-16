"use client";

// Customers — a PAGE under the place, and the one product that is Soon.
//
// SOON LIVES HERE, ON THE PAGE, not on the rail row that opens it. The row is
// live like every other row, and this strip is what says the product is not
// running yet. The table below it is what the page will be — shown so that the
// shape can be argued about before it is built, and labelled so that nobody
// mistakes it for live.
import { NotHeld, useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { Section } from "@/components/shared/Section";
import { SoonStrip } from "@/components/shared/SoonStrip";
import { Table, type Column } from "@/components/shared/Table";
import { EmptyState } from "@/components/shared/EmptyState";
import { CUSTOMERS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockCustomer } from "@/mock/types";
import { day, money } from "@/lib/format";

export default function PlaceCustomersPage() {
  const place = useHeldPlaceOrNull();
  const { scenario } = useMock();
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;

  const rows = listFor(CUSTOMERS.filter((c) => c.placeId === place.id), scenario);

  const columns: Column<MockCustomer>[] = [
    { key: "name", head: "Guest", cell: (c) => <span className="font-medium">{c.name}</span> },
    { key: "visits", head: "Visits", align: "right", cell: (c) => c.visits },
    { key: "last", head: "Last seen", cell: (c) => <span className="text-muted-foreground">{day(c.lastSeen)}</span> },
    { key: "spend", head: "Spent", align: "right", cell: (c) => <span className="font-semibold">{money(c.spendCents)}</span> },
  ];

  return (
    <>
      <PlaceHeading place={place} view="Customers" />

      <SoonStrip title="Mesita Customers is not live yet">
        Always free when it ships. Nothing below has been read from anywhere —
        it is the shape of the page, put on screen early so the columns can be
        argued about while changing them is still cheap.
      </SoonStrip>

      <Section title="Who keeps coming back" description="Sorted by visits. Not live.">
        <Table
          columns={columns}
          rows={rows}
          empty={<EmptyState title="Nobody yet" hint="Guests appear here after their first visit." />}
        />
      </Section>
    </>
  );
}
