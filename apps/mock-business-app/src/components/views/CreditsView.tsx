"use client";

// Credits — branded money a guest buys once and spends here.
//
// ── THERE IS NO GRAND TOTAL ON THIS PAGE, AND THERE MUST NOT BE ────────────
//
// The balances list is PAGINATED and the endpoint returns no aggregate. A
// `reduce()` over the page on screen would print a number that looks like
// "money our guests are holding" and is actually "money the first twenty-five
// guests are holding" — confidently wrong, in the one place on this console
// where being wrong about a number is a liability.
//
// So the tiles below count what this page can DEFEND: how many balances it
// read, and how big the largest one on this page is. The outstanding total is
// deliberately absent, and the note says why rather than leaving a hole
// somebody helpfully fills in later.
//
// Credits are ORG-scoped in the real product, not universal, because Stripe has
// no account merge: money taken under one place's Stripe account cannot be
// spent against another's.
import { useState } from "react";
import { useHeldPlace } from "@/components/console/PlaceScope";
import { Section } from "@/components/shared/Section";
import { Half } from "@/components/shared/Half";
import { Table, type Column } from "@/components/shared/Table";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { CREDIT_BALANCES } from "@/mock/fixtures";
import { listFor } from "@/mock/scenario";
import { useMock } from "@/mock/MockStore";
import type { MockCreditBalance } from "@/mock/types";
import { day, money } from "@/lib/format";
import { GHOST_PILL_BUTTON_CLASS, INFO_BOX_CLASS } from "@/lib/ui-classes";

const PAGE = 8;

export function CreditsView() {
  const place = useHeldPlace();
  const { scenario } = useMock();
  const all = listFor(CREDIT_BALANCES.filter((b) => b.placeId === place.id), scenario);
  const [page, setPage] = useState(0);
  const rows = all.slice(page * PAGE, page * PAGE + PAGE);
  const lastPage = Math.max(0, Math.ceil(all.length / PAGE) - 1);

  const columns: Column<MockCreditBalance>[] = [
    { key: "guest", head: "Guest", cell: (b) => <span className="font-medium">{b.guest}</span> },
    { key: "last", head: "Last move", cell: (b) => <span className="text-muted-foreground">{day(b.lastMoveAt)}</span> },
    {
      key: "balance",
      head: "Balance",
      align: "right",
      cell: (b) => <span className="font-semibold">{money(b.balanceCents)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tiles
        tiles={[
          { label: "Credits", value: place.credits ? "On" : "Off" },
          { label: "Balances on this page", value: rows.length || null },
          {
            label: "Largest on this page",
            value: rows.length ? money(Math.max(...rows.map((b) => b.balanceCents))) : null,
          },
          // NOT a total. See the file header.
          { label: "Outstanding total", value: null, hint: "Not available — see below" },
        ]}
      />

      <Half label="Activity">
        <Section
          title="What guests are holding"
          description="One page at a time. Credits bought here can only be spent here."
          right={
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className={GHOST_PILL_BUTTON_CLASS}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                className={GHOST_PILL_BUTTON_CLASS}
              >
                Next
              </button>
            </div>
          }
        >
          <Table
            columns={columns}
            rows={rows}
            empty={
              <EmptyState
                title="No balances"
                hint={
                  place.credits
                    ? "Nobody is holding credits for this place yet."
                    : "Credits are off for this place, so none can be sold."
                }
              />
            }
          />
          <p className={INFO_BOX_CLASS}>
            There is no outstanding total on this screen, on purpose. This list is
            paginated and the balance endpoint returns no aggregate, so any total
            computed here would be the total of the page you happen to be on —
            which reads as the total of the place. When the number matters, it has
            to come from a source that can count all of them.
          </p>
        </Section>
      </Half>
    </div>
  );
}
