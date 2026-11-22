"use client";

// Monitor › Customers (MESITA-4538, Pato: "it counts the people and how much
// you owe them"; a table since MESITA-4682, Pato: "THE CUSTOMERS PAGE CAN DO
// BE A TABLE"). One line on top, then one row per guest who saved the place,
// visited, paid, bought or holds credit here (gifted credit too): Saved ·
// Visits · Spent · Credit · Vouchers · Last seen. The name opens their Views;
// the Visits and Vouchers figures open those pages filtered to them.

import { useState } from "react";
import Link from "next/link";
import { listCustomers } from "@/lib/business-api";
import { customerLabel, customerListHref, EMPTY, money, type CustomersPage } from "@/lib/monitor";
import { CUSTOMER_COLUMNS } from "@/lib/monitor-columns";
import { MonitorTable } from "./MonitorTable";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { FilterBanner } from "./MonitorList";
import { GuestAvatar } from "./GuestAvatar";

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
          {customer ? "This guest has not saved, visited or bought anything here yet." : EMPTY.customers}
        </p>
      ) : (
        <MonitorTable
          placeId={placeId}
          rows={page.rows}
          rowKey={(c) => c.customer}
          guestLabel="Guest"
          guest={(c) => (
            <span className="flex items-center gap-2.5">
              <GuestAvatar face={c.face ?? null} size={28} />
              <span className="flex min-w-0 flex-col">
                <Link
                  href={customerListHref(placeId, "views", c.customer)}
                  className="max-w-[12rem] truncate font-medium underline-offset-2 hover:underline"
                >
                  {c.guest}
                </Link>
                <span className="text-muted-foreground text-xs">{customerLabel(c.customer)}</span>
              </span>
            </span>
          )}
          columns={CUSTOMER_COLUMNS}
          timezone={page.timezone}
        />
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
