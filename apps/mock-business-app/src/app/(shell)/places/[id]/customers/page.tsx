"use client";

// Customers — a PAGE under the place, and the one product that is Soon.
//
// SOON LIVES HERE, ON THE PAGE, not on the rail row that opens it. The row is
// live like every other row, and this strip is what says the product is not
// running yet. The table below it is what the page will be — shown so that the
// shape can be argued about before it is built, and labelled so that nobody
// mistakes it for live.
//
// ── THE MODEL: RENTED, NOT BOUGHT (MESITA-1941) ────────────────────────────
//
// Pato, 2026-09-16: *"you don't buy the data forever, you subscribe to a
// catalog of customers and you can track their activity, visits per month,
// spent per month"*. This page used to sell a CONTACT, one guest at a time,
// forever. Both halves of that were wrong:
//
//   · FOREVER IS THE WRONG WORD for a row that keeps changing. The place pays
//     once for a phone number that goes stale, and Mesita is paid once for
//     keeping it true — so the longer the product works, the worse the deal
//     gets for whichever side is still doing the work.
//   · A CONTACT IS NOT THE PRODUCT. Knowing how to reach a guest is worth
//     something only after you know which guest to reach, and that is what the
//     monthly columns say. The contact comes with the catalog now instead of
//     being metered out of it.
//
// So: `place.customerIntel` is a subscription, and it opens the whole table.
//
// COUNTS ARE FREE, NAMES ARE NOT. The closed state still says how many guests
// the catalog holds and how many came back this month, because a pitch with no
// number in it is not a pitch — and an aggregate names nobody. The rows below
// it are the real ones, masked: proof that there is something behind the
// glass, which an empty state could never be.
//
// ── THE COLUMNS ARE THE ARGUMENT ───────────────────────────────────────────
//
// The guest's OWN facts (age, class, sex, plan) come off their Mesita profile,
// not from anything this place collected — that is the entire reason this
// product can work on day one for a venue that has never run a loyalty card in
// its life.
//
// THE LIFETIME PAIR ONLY GROWS. Total visits and total spent cannot tell a
// regular from somebody who came eleven times two years ago, which is why the
// month is beside them: visits this month, spent this month, last seen. Those
// three are what is worth reading AGAIN next month, and a subscription has to
// be worth reading again.
//
// CLASS IS MESITA'S LADDER — Bronze < Silver < Gold < Diamond — and not a
// census bracket. It shipped once as an AMAI socioeconomic level, which was
// wrong: "class" already means something exact in this product, and it is the
// thing the guest sees on their own phone. PLAN is the subscription beside it,
// Free or Premium, which the consumer app is careful to call "a subscription,
// not a class".
//
// It is a phone, not a WhatsApp. WhatsApp is one channel you could use the
// number on, and naming the column after that channel promises an integration
// nobody has decided on, on a console where `whatsapp_url` already means the
// PLACE's own WhatsApp over on Profile.
import { notFound } from "next/navigation";
import { NotHeld, useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { SoonStrip } from "@/components/shared/SoonStrip";
import { Table, type Column } from "@/components/shared/Table";
import { EmptyState } from "@/components/shared/EmptyState";
import { CUSTOMERS, MOCK_NOW } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import { SEX_LABEL, type MockCustomer } from "@/mock/types";
import { money, since } from "@/lib/format";
import { CTA_BUTTON_CLASS, INFO_BOX_CLASS } from "@/lib/ui-classes";

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

/** A name keeps its initials and its SHAPE — two words stay two words. A row
 *  of identical blocks would read as a placeholder the console is still
 *  loading rather than as a guest it is not going to name. */
function maskedName(name: string): string {
  return name
    .split(" ")
    .map((word) => `${word.slice(0, 1)}${"•".repeat(Math.max(1, word.length - 1))}`)
    .join(" ");
}

/** Dots, as many as the number has digits. The WIDTH of a hidden number is the
 *  only honest thing about it: it says an eleven-visit guest and a one-visit
 *  guest are not the same row without saying which is which. */
function maskedNumber(value: number | string): string {
  return "•".repeat(Math.max(1, String(value).replace(/[^\d]/g, "").length));
}

/** The closed catalog shows SIX rows, not sixteen. Enough that the columns are
 *  legible; not so many that the page becomes a wall of dots. */
const PREVIEW_ROWS = 6;

export default function PlaceCustomersPage() {
  const place = useHeldPlaceOrNull();
  const { pages } = usePlaceScope();
  const { scenario } = useMock();
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

  const open = place.customerIntel;

  // Sorted HERE, not assumed. The card has said "sorted by visits" since the
  // day it shipped and the fixture handed it index order — a caption that
  // describes an order nobody applied is how a sort bug survives review.
  const all = listFor(
    CUSTOMERS.filter((c) => c.placeId === place.id),
    scenario,
  )
    .slice()
    .sort((a, b) => b.visits - a.visits);

  const rows = open ? all : all.slice(0, PREVIEW_ROWS);
  // The two free numbers. Both are counts of rows, never a sum of money: an
  // aggregate over a list the server would paginate is the Credits mistake,
  // and a count survives pagination where a total does not.
  const returning = all.filter((c) => c.visitsPerMonth > 0).length;
  // Counted, never typed. The preview is `slice(0, 6)` of a list the scenario
  // can empty, so a hand-written "ten more" is a sentence that goes wrong the
  // first time somebody flips a switch.
  const hidden = all.length - rows.length;

  const columns: Column<MockCustomer>[] = [
    {
      key: "name",
      head: "Guest",
      cell: (c) =>
        open ? (
          <span className="font-medium">{c.name}</span>
        ) : (
          <span className="text-muted-foreground">{maskedName(c.name)}</span>
        ),
    },
    {
      key: "age",
      head: "Age",
      align: "right",
      cell: (c) => (open ? c.age : <span className="text-muted-foreground">{maskedNumber(c.age)}</span>),
    },
    {
      key: "class",
      head: "Class",
      cell: (c) => (open ? c.class : <span className="text-muted-foreground">••••</span>),
    },
    {
      key: "sex",
      head: "Sex",
      cell: (c) => (
        <span className="text-muted-foreground">{open ? SEX_LABEL[c.sex] : "•••"}</span>
      ),
    },
    {
      key: "plan",
      head: "Plan",
      // Free is the floor every account starts on, so it sits back; Premium is
      // the one worth spotting down a column of sixteen.
      cell: (c) => {
        if (!open) return <span className="text-muted-foreground">••••</span>;
        return c.plan === "Premium" ? (
          <span className="font-medium">Premium</span>
        ) : (
          <span className="text-muted-foreground">Free</span>
        );
      },
    },
    {
      key: "visitsMonth",
      head: "Visits / mo",
      align: "right",
      cell: (c) => {
        if (!open) return <span className="text-muted-foreground">{maskedNumber(c.visitsPerMonth || 1)}</span>;
        // A ZERO IS A FINDING, not a blank. It is the regular who stopped —
        // the one row on this page worth doing something about — so it prints
        // as a number and leans back rather than disappearing.
        return c.visitsPerMonth === 0 ? (
          <span className="text-muted-foreground">0</span>
        ) : (
          <span className="font-medium">{c.visitsPerMonth}</span>
        );
      },
    },
    {
      key: "spendMonth",
      head: "Spent / mo",
      align: "right",
      cell: (c) => {
        if (!open) return <span className="text-muted-foreground">••••••</span>;
        return c.spendPerMonthCents === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="font-semibold">{money(c.spendPerMonthCents)}</span>
        );
      },
    },
    {
      key: "lastSeen",
      head: "Last seen",
      align: "right",
      cell: (c) => (
        <span className="text-muted-foreground">
          {open ? since(c.lastVisitAt, MOCK_NOW) : "•••"}
        </span>
      ),
    },
    {
      key: "visits",
      head: "Total visits",
      align: "right",
      cell: (c) => (
        <span className="text-muted-foreground">{open ? c.visits : maskedNumber(c.visits)}</span>
      ),
    },
    {
      key: "spend",
      head: "Total spent",
      align: "right",
      cell: (c) => (
        <span className="text-muted-foreground">
          {open ? money(c.spendCents) : "••••••"}
        </span>
      ),
    },
    {
      key: "instagram",
      head: "Instagram",
      cell: (c) => {
        // An em dash, not an empty cell, and it survives the subscription: a
        // guest who never connected a handle has none to reveal, and
        // pretending the lock is what hides it would sell a promise the
        // subscription cannot keep.
        if (!c.instagram) return <span className="text-muted-foreground/60">—</span>;
        return open ? (
          <span>@{c.instagram}</span>
        ) : (
          <span className="text-muted-foreground">@{maskedHandle(c.instagram)}</span>
        );
      },
    },
    {
      key: "phone",
      head: "Phone",
      cell: (c) =>
        open ? (
          <span className="tabular-nums">{c.phone}</span>
        ) : (
          <span className="text-muted-foreground tabular-nums">{maskedPhone(c.phone)}</span>
        ),
    },
  ];

  return (
    <>
      <SoonStrip title="Mesita Customers is not live yet">
        A subscription when it ships, not a purchase. Nothing below has been
        read from anywhere — it is the shape of the page, put on screen early
        so the columns can be argued about while changing them is still cheap.
      </SoonStrip>

      {!open && (
        // THE PITCH IS A BAND, NOT A CARD, for the same reason PartnerBanner
        // is: it is the one thing on the page that is not the table, and a
        // second card would make the closed catalog look like a second
        // subject.
        <Section
          title="This catalog is not open here"
          description="Customer intelligence is a subscription. While it runs you read who your guests are and what they did this month; stop, and the table below goes back behind the glass — nothing here is bought once and kept."
          right={
            <button type="button" className={CTA_BUTTON_CLASS}>
              Subscribe
            </button>
          }
          lane
        >
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            {[
              ["In the catalog", `${all.length} guests`],
              ["Came back this month", `${returning} of them`],
              ["What it costs", "Not decided yet"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                  {k}
                </dt>
                <dd className="font-display mt-0.5 text-lg font-semibold tracking-tight">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground max-w-[68ch] text-[12px] leading-snug">
            The two numbers above are free and always will be: a count names
            nobody. What the subscription opens is every row below it — the
            guest, their own profile facts, what they did this month, and the
            two ways to reach them.
          </p>
        </Section>
      )}

      <Section
        title={open ? "Who keeps coming back" : "What the subscription opens"}
        description={
          open
            ? "Most visits first. Not live."
            : `${rows.length} of ${all.length}, masked. Real rows, and the width of every hidden number is the guest's own.`
        }
      >
        <Table
          columns={columns}
          rows={rows}
          // Twelve columns, five of them numeric. Below this the table
          // compresses instead of scrolling, and a phone number folds over
          // four lines.
          minWidth={1320}
          empty={<EmptyState title="Nobody yet" hint="Guests appear here after their first visit." />}
        />
        {open ? (
          <p className={INFO_BOX_CLASS}>
            Age, class, sex and plan are the guest&rsquo;s own — not anything
            this place asked them for, which is why every guest on the list has
            them. Class is the ladder they see on their phone (Bronze, Silver,
            Gold, Diamond); Plan is the subscription beside it, and the two can
            differ: a Diamond guest is invited rather than paying, so Class
            alone never tells you who is on Premium. The month — visits, spend,
            last seen — is the half of the row that moves, and the reason to
            come back next month; the lifetime pair only ever grows. The handle
            and the phone number come with the subscription and go with it:
            this place is renting a catalog, not buying a list.
          </p>
        ) : (
          <p className={INFO_BOX_CLASS}>
            Every row here is a real guest of this place, with their own values
            hidden rather than invented — the dots are as wide as the number
            behind them.
            {hidden > 0 && ` ${hidden} more are not shown at all.`}
          </p>
        )}
      </Section>
    </>
  );
}
