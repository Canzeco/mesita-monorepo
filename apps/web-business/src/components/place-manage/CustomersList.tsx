"use client";

// Monitor › Customers (MESITA-4538, Pato: "it counts the people and how much
// you owe them … relational"). One line on top, then one row per guest with
// money rows here: what the place owes them and when they were last seen, and
// chips to their own Views, Visits, Vouchers, Gifts and Payments.

import { useState } from "react";
import Link from "next/link";
import { listCustomers } from "@/lib/business-api";
import { customerLabel, customerListHref, EMPTY, money, when, type CustomersPage } from "@/lib/monitor";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { CHIP, FilterBanner, ROW } from "./MonitorList";
import { GuestAvatar } from "./GuestAvatar";
import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

const PAGES = [
  ["views", "Views"],
  ["visits", "Visits"],
  ["vouchers", "Vouchers"],
  ["gifts", "Gifts"],
  ["money", "Payments"],
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
            <li key={c.customer} className={ROW}>
              <GuestAvatar face={c.face ?? null} size={32} />
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate font-medium">{c.guest}</span>
                <span className="text-muted-foreground text-sm">Last seen {when(c.last_seen, page.timezone)}</span>
                <span className={cn(CHIP, "gap-1")}>
                  <UserCircleIcon size={12} weight="bold" aria-hidden />
                  {customerLabel(c.customer)}
                </span>
                {PAGES.map(([p, label]) => (
                  <Link key={p} href={customerListHref(placeId, p, c.customer)} className={CHIP}>
                    {label}
                  </Link>
                ))}
              </div>
              <div className="text-right">
                <p className="font-semibold whitespace-nowrap tabular-nums">{money(c.owed_cents)}</p>
                <p className="text-muted-foreground text-xs">owed</p>
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
