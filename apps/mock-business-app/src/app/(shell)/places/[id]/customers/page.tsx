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
// Eight of the nine are free, and they are the guest's OWN facts: who they are
// (age, class, sex, plan, Instagram) and what they have done here (total
// visits, total spent). None of them are things the place collected — they
// come off the guest's Mesita profile and its own ledger, which is the entire
// reason this product can work on day one for a venue that has never run a
// loyalty card in its life.
//
// CLASS IS MESITA'S LADDER — Bronze < Silver < Gold < Diamond — and not a
// census bracket. It shipped once as an AMAI socioeconomic level, which was
// wrong: "class" already means something exact in this product, and it is the
// thing the guest sees on their own phone. PLAN is the subscription beside it,
// Free or Premium, which the consumer app is careful to call "a subscription,
// not a class".
//
// The ninth is the one that costs money. A guest's PHONE NUMBER is hidden
// until this place BUYS it, one guest at a time, because buying it is what
// makes reaching that guest with a promotion possible. So the column is never
// empty and never fully open: it is a masked number with a verb next to it.
// It is a phone, not a WhatsApp — WhatsApp is one channel you could use it on,
// and naming the column after that channel promises an integration nobody has
// decided on, on a console where `whatsapp_url` already means the PLACE's own
// WhatsApp over on Profile.
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
import { money } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS, INFO_BOX_CLASS } from "@/lib/ui-classes";

/** The locked form of a number: enough of it to prove there IS one, never
 *  enough to dial it. A masked value reads as withheld, an empty cell reads as
 *  missing data, and those are opposite facts. */
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
    { key: "class", head: "Class", cell: (c) => c.class },
    {
      key: "sex",
      head: "Sex",
      cell: (c) => <span className="text-muted-foreground">{SEX_LABEL[c.sex]}</span>,
    },
    {
      key: "plan",
      head: "Plan",
      // Free is the floor every account starts on, so it sits back; Premium is
      // the one worth spotting down a column of sixteen.
      cell: (c) =>
        c.plan === "Premium" ? (
          <span className="font-medium">Premium</span>
        ) : (
          <span className="text-muted-foreground">Free</span>
        ),
    },
    {
      key: "instagram",
      head: "Instagram",
      cell: (c) =>
        c.instagram ? (
          <span className="text-muted-foreground">@{c.instagram}</span>
        ) : (
          // An em dash, not an empty cell: nothing at all in a column reads as
          // a column that failed to load.
          <span className="text-muted-foreground/60">—</span>
        ),
    },
    { key: "visits", head: "Total visits", align: "right", cell: (c) => c.visits },
    {
      key: "spend",
      head: "Total spent",
      align: "right",
      cell: (c) => <span className="font-semibold">{money(c.spendCents)}</span>,
    },
    {
      key: "phone",
      head: "Phone",
      cell: (c) => {
        const open = c.phoneBought || bought.includes(c.id);
        if (open) return <span className="tabular-nums">{c.phone}</span>;
        return (
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground tabular-nums">{masked(c.phone)}</span>
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
          // Nine columns, and the last one carries a number and a button on one
          // line. Below this the table scrolls rather than folding a phone
          // number over four lines.
          minWidth={1040}
          empty={<EmptyState title="Nobody yet" hint="Guests appear here after their first visit." />}
        />
        <p className={INFO_BOX_CLASS}>
          Everything to the left of Phone is the guest&rsquo;s own — their Mesita
          class and plan, their handle, and what they have spent here — not
          anything this place asked them for, which is why every guest on the
          list has it. Class is the ladder they see on their phone (Bronze,
          Silver, Gold, Diamond); Plan is the subscription beside it, and the
          two can differ: a Diamond guest is invited rather than paying, so
          Class alone never tells you who is on Premium. The phone number is
          the one thing here that is bought: it stays masked until this place
          pays for that guest, and having it is what makes a promotion
          possible. What one number costs, and whether it is bought a guest at
          a time or a list at a time, is not decided yet.
        </p>
      </Section>
    </>
  );
}
