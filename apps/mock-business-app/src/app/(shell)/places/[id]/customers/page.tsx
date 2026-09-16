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
// Seven of the nine are free, and they are the guest's OWN facts: who they are
// (age, class, sex, plan) and what they have done here (total visits, total
// spent). None of them are things the place collected — they come off the
// guest's Mesita profile and its own ledger, which is the entire reason this
// product can work on day one for a venue that has never run a loyalty card in
// its life.
//
// CLASS IS MESITA'S LADDER — Bronze < Silver < Gold < Diamond — and not a
// census bracket. It shipped once as an AMAI socioeconomic level, which was
// wrong: "class" already means something exact in this product, and it is the
// thing the guest sees on their own phone. PLAN is the subscription beside it,
// Free or Premium, which the consumer app is careful to call "a subscription,
// not a class".
//
// TWO of them cost money, and they cost it TOGETHER. The handle and the phone
// number are both hidden until this place UNLOCKS the contact, one guest at a
// time, because having a way to reach that guest is what makes a promotion
// possible. They are not sold separately: they are one answer to one question,
// and two verbs in one row would make the reviewer price each half. So the
// pair is never empty and never half-open — masked values, and a single verb
// at the end of them.
//
// It is a phone, not a WhatsApp. WhatsApp is one channel you could use the
// number on, and naming the column after that channel promises an integration
// nobody has decided on, on a console where `whatsapp_url` already means the
// PLACE's own WhatsApp over on Profile.
import { useState } from "react";
import { notFound } from "next/navigation";
import { NotHeld, useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
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

// THE LOCKED FORM OF A VALUE: enough of it to prove there IS one, never enough
// to use it. A masked value reads as withheld; an empty cell reads as missing
// data; and those are opposite facts about the same guest.

function maskedPhone(phone: string): string {
  const parts = phone.split(" ");
  const tail = parts[parts.length - 1];
  return `${parts.slice(0, 2).join(" ")} •••• ••${tail.slice(-2)}`;
}

/** Two letters and a run of dots as long as the rest of the handle — the
 *  length is part of the proof that a real handle is behind it. */
function maskedHandle(handle: string): string {
  return `${handle.slice(0, 2)}${"•".repeat(Math.max(3, handle.length - 2))}`;
}

export default function PlaceCustomersPage() {
  const place = useHeldPlaceOrNull();
  const { pages } = usePlaceScope();
  const { scenario } = useMock();
  // Unlocking is local and free here, because there is nothing behind this app
  // to charge. It is wired anyway: a verb that does nothing leaves the reviewer
  // guessing what the row looks like afterwards, which is the one question
  // these two columns exist to answer.
  const [unlocked, setUnlocked] = useState<string[]>([]);
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;
  // AND HELD AS WHAT (MESITA-1933). Customers lost its rail row with the other
  // eight products, so it is reached from the catalogue — and the row leaving
  // took the `tabsForAccess` call that had been this page's only role check.
  // Every `PlacePage` gets the gate, not just the three still on the rail.
  if (!pages.includes("customers")) notFound();

  // Sorted HERE, not assumed. The card has said "sorted by visits" since the
  // day it shipped and the fixture handed it index order — a caption that
  // describes an order nobody applied is how a sort bug survives review.
  const rows = listFor(
    CUSTOMERS.filter((c) => c.placeId === place.id),
    scenario,
  )
    .slice()
    .sort((a, b) => b.visits - a.visits);

  // Read by BOTH contact cells, so they can never disagree about whether this
  // row is open.
  const isOpen = (c: MockCustomer) => c.contactUnlocked || unlocked.includes(c.id);

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
      cell: (c) => {
        // An em dash, not an empty cell, and it survives unlocking: a guest who
        // never connected a handle has none to reveal, and pretending the lock
        // is what hides it would sell a promise the purchase cannot keep.
        if (!c.instagram) return <span className="text-muted-foreground/60">—</span>;
        return isOpen(c) ? (
          <span>@{c.instagram}</span>
        ) : (
          <span className="text-muted-foreground">@{maskedHandle(c.instagram)}</span>
        );
      },
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
        if (isOpen(c)) return <span className="tabular-nums">{c.phone}</span>;
        return (
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground tabular-nums">{maskedPhone(c.phone)}</span>
            {/* ONE verb for the pair, and it sits at the end of the pair it
                opens. "Unlock contact" rather than "Buy" because what changes
                is this row, not a basket — and because the word has to say
                that the handle two columns left opens with it. */}
            <button
              type="button"
              onClick={() => setUnlocked((u) => [...u, c.id])}
              className={GHOST_PILL_BUTTON_CLASS}
            >
              Unlock contact
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
          Age, class, sex, plan and the two totals are the guest&rsquo;s own —
          not anything this place asked them for, which is why every guest on
          the list has them. Class is the ladder they see on their phone
          (Bronze, Silver, Gold, Diamond); Plan is the subscription beside it,
          and the two can differ: a Diamond guest is invited rather than
          paying, so Class alone never tells you who is on Premium. The handle
          and the phone number are the pair that is bought, together and never
          apart — both stay masked until this place unlocks that guest, and
          having them is what makes a promotion possible. What one contact
          costs, and whether it is unlocked a guest at a time or a list at a
          time, is not decided yet.
        </p>
      </Section>
    </>
  );
}
