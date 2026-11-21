"use client";

// Monitor › Customers (MESITA-4538, Pato: "it counts the people and how much
// you owe them … relational"). One line on top, then one row per guest with
// money rows here: what the place owes them and when they were last seen, and
// chips to their own Views, Visits, Vouchers, Payments and Credits.

import { useState } from "react";
import Link from "next/link";
import { listCustomers } from "@/lib/business-api";
import { customerListHref, EMPTY, money, when, type CustomersPage } from "@/lib/monitor";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { CHIP, FilterBanner } from "./MonitorList";

const PAGES = [
  ["views", "Views"],
  ["visits", "Visits"],
  ["vouchers", "Vouchers"],
  ["money", "Payments"],
  ["credits", "Credits"],
] as const;

export function CustomersList({ placeId, initial, customer }: { placeId: string; initial: CustomersPage; customer: string | null }) {
  const [page, setPage] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function older() {
    if (!page.next || busy) return;
    setBusy(true);
    setError(null);
    const r = await listCustomers(placeId, customer, page.next);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setPage({ ...r.data, rows: [...page.rows, ...r.data.rows] });
  }

  return (
    <div className="flex min-w-0 flex-col">
      {customer ? (
        <FilterBanner text={`Showing ${page.rows[0]?.guest ?? "one guest"}`} clearHref={`/places/${encodeURIComponent(placeId)}/customers`} />
      ) : (
        <p className="border-border border-b px-5 py-3 text-sm font-semibold sm:px-6">
          {page.count.toLocaleString("en-US")} {page.count === 1 ? "customer" : "customers"} · You owe {money(page.owed_cents)}
        </p>
      )}
      {page.rows.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">
          {customer ? "This guest has no visits, payments or credit here yet." : EMPTY.customers}
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {page.rows.map((c) => (
            <li key={c.customer} className="flex flex-col gap-1 px-5 py-3 text-sm sm:px-6">
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 font-medium">{c.guest}</p>
                <p className="shrink-0 font-semibold tabular-nums">{money(c.owed_cents)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <p className="text-muted-foreground">Owed · last seen {when(c.last_seen, page.timezone)}</p>
                <span className="flex flex-wrap gap-1.5">
                  {PAGES.map(([p, label]) => (
                    <Link key={p} href={customerListHref(placeId, p, c.customer)} className={CHIP}>
                      {label}
                    </Link>
                  ))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className={cn(ERROR_BOX_CLASS, "mx-5 my-3 sm:mx-6")}>{error}</p> : null}
      {page.next ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground border-border border-t px-5 py-3 text-left text-sm font-semibold sm:px-6"
          disabled={busy}
          onClick={() => void older()}
        >
          {busy ? "Loading…" : "Older"}
        </button>
      ) : null}
    </div>
  );
}
