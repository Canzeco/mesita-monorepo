"use client";

// Customers — a PAGE under the place, and the one product that is Soon.
//
// SOON LIVES HERE, ON THE PAGE, not on the rail row that opens it. The row is
// live like every other row, and this strip is what says the product is not
// running yet. The table below it is what the page will be — shown so that the
// shape can be argued about before it is built, and labelled so that nobody
// mistakes it for live.
//
// ── THE COLUMNS ARE THE ARGUMENT ───────────────────────────────────────────
//
// Six, and the first five are free: guest, age, class, sex, total visits.
// None of those are facts the place collected — they come off the guest's own
// Mesita profile, which is the entire reason this product can exist on day one
// for a venue that has never run a loyalty card in its life.
//
// The sixth is the one that costs money. A guest's WhatsApp number is hidden
// until this place BUYS it, one guest at a time, because buying it is what
// makes sending that guest a promotion possible. So the column is never empty
// and never fully open: it is a masked number with a verb next to it.
import { useState } from "react";
import { NotHeld, useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { Section } from "@/components/shared/Section";
import { SoonStrip } from "@/components/shared/SoonStrip";
import { Table, type Column } from "@/components/shared/Table";
import { EmptyState } from "@/components/shared/EmptyState";
import { CUSTOMERS } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { SEX_LABEL, type MockCustomer } from "@/mock/types";
import { GHOST_PILL_BUTTON_CLASS, INFO_BOX_CLASS } from "@/lib/ui-classes";

/** The locked form of a number: enough of it to prove there IS one, never
 *  enough to dial it. The same shape this console already uses for a payout
 *  account — a masked value reads as withheld, an empty cell reads as missing
 *  data, and those are opposite facts. */
function masked(phone: string): string {
  const parts = phone.split(" ");
  const tail = parts[parts.length - 1];
  return `${parts.slice(0, 2).join(" ")} •••• ••${tail.slice(-2)}`;
}

export default function PlaceCustomersPage() {
  const place = useHeldPlaceOrNull();
  const { scenario } = useMock();
  // Buying is local and free here, because there is nothing behind this app to
  // charge. It is wired anyway: a Buy that does nothing leaves the reviewer
  // guessing what the row looks like afterwards, which is the one question the
  // column exists to answer.
  const [bought, setBought] = useState<string[]>([]);
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;

  // Sorted HERE, not assumed. The card has said "sorted by visits" since the
  // day it shipped and the fixture handed it index order — a caption that
  // describes an order nobody applied is how a sort bug survives review.
  const rows = listFor(
    CUSTOMERS.filter((c) => c.placeId === place.id),
    scenario,
  )
    .slice()
    .sort((a, b) => b.visits - a.visits);

  const columns: Column<MockCustomer>[] = [
    { key: "name", head: "Guest", cell: (c) => <span className="font-medium">{c.name}</span> },
    { key: "age", head: "Age", align: "right", cell: (c) => c.age },
    {
      key: "class",
      head: "Class",
      cell: (c) => <span className="text-muted-foreground tabular-nums">{c.class}</span>,
    },
    {
      key: "sex",
      head: "Sex",
      cell: (c) => <span className="text-muted-foreground">{SEX_LABEL[c.sex]}</span>,
    },
    { key: "visits", head: "Total visits", align: "right", cell: (c) => c.visits },
    {
      key: "whatsapp",
      head: "WhatsApp",
      cell: (c) => {
        const open = c.whatsappBought || bought.includes(c.id);
        if (open) return <span className="tabular-nums">{c.whatsapp}</span>;
        return (
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground tabular-nums">{masked(c.whatsapp)}</span>
            <button
              type="button"
              onClick={() => setBought((b) => [...b, c.id])}
              className={GHOST_PILL_BUTTON_CLASS}
            >
              Buy
            </button>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PlaceHeading place={place} view="Customers" />

      <SoonStrip title="Mesita Customers is not live yet">
        Always free when it ships. Nothing below has been read from anywhere —
        it is the shape of the page, put on screen early so the columns can be
        argued about while changing them is still cheap.
      </SoonStrip>

      <Section title="Who keeps coming back" description="Most visits first. Not live.">
        <Table
          columns={columns}
          rows={rows}
          empty={<EmptyState title="Nobody yet" hint="Guests appear here after their first visit." />}
        />
        <p className={INFO_BOX_CLASS}>
          Age, class and sex are read from the guest&rsquo;s own Mesita profile,
          not from anything this place asked them for — which is why every guest
          on the list has them. The WhatsApp number is the one thing here that
          is bought: it stays masked until this place pays for that guest, and
          having it is what makes a promotion possible. What one number costs,
          and whether it is bought a guest at a time or a list at a time, is not
          decided yet.
        </p>
      </Section>
    </>
  );
}
