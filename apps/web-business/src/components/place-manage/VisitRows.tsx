"use client";

// Visits as expandable rows (MESITA-4732, design review 2026-11-23: "Visits is
// expandable rows, not a table"). A closed row reads guest · time · status ·
// total, with a short "$X in credit" line when credit paid part of the bill;
// opening it shows the bill's breakdown (bill, tip, card, cash, credit,
// cashback), the ticket and the visit's id, and a chip to the guest. No
// payment chips: a visit's bill is paid by credit or cash, which Payments
// (card charges only) does not list. Same data, filters (?id=, ?customer=) and Older
// paging as every Monitor list; the server names guests (masked).

import { useState } from "react";
import Link from "next/link";
import { listMonitor } from "@/lib/business-api";
import {
  customerHref,
  customerLabel,
  EMPTY,
  money,
  NOUN,
  rowStatus,
  shortId,
  when,
  type MonitorFilter,
  type MonitorPage,
  type MonitorRow,
} from "@/lib/monitor";
import { collectedCents } from "@/lib/monitor-columns";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { GuestAvatar } from "./GuestAvatar";
import { CHIP, FilterBanner } from "./MonitorList";
import { VisitBadge } from "./VoucherBadge";
import { CaretDownIcon, UserCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { attempt } from "@/lib/attempt";

const n = (row: MonitorRow, k: string) => Number(row.payload[k] ?? 0);
const isSplit = (row: MonitorRow) => row.payload.split === true;

/** The closed row's total: the bill plus the tip, or the shares' sum on a
 *  split bill; nothing yet while the bill is not in. */
function total(row: MonitorRow): string {
  if (isSplit(row)) return money(n(row, "shares_total_cents"));
  return row.payload.bill_cents == null ? "No bill yet" : money(collectedCents(row));
}

function status(row: MonitorRow): string {
  return isSplit(row) ? `Split · ${n(row, "shares")}` : rowStatus("visits", row);
}

/** One line of the open row: a label on the left, the figure on the right. */
function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-sm">
      <dt className={cn("text-muted-foreground", strong && "text-foreground font-semibold")}>{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-semibold", muted && "text-muted-foreground")}>{value}</dd>
    </div>
  );
}

/** The bill's breakdown, every part the server sent; a zero part reads "—". */
function Breakdown({ row }: { row: MonitorRow }) {
  const part = (k: string) => (n(row, k) > 0 ? money(n(row, k)) : "—");
  if (isSplit(row)) {
    return (
      <dl className="flex flex-col">
        <Line label="Shares" value={String(n(row, "shares"))} />
        <Line label="Tip" value={part("tip_cents")} />
        <Line label="Cashback earned" value={part("cashback_cents")} muted />
        <Line label="Total" value={money(n(row, "shares_total_cents"))} strong />
      </dl>
    );
  }
  const billed = row.payload.bill_cents != null;
  return (
    <dl className="flex flex-col">
      <Line label="Bill" value={billed ? money(n(row, "bill_cents")) : "—"} />
      <Line label="Tip" value={part("tip_cents")} />
      {n(row, "card_cents") > 0 ? <Line label="Card" value={part("card_cents")} /> : null}
      <Line label="Cash" value={part("outside_cents")} />
      <Line label="Credit" value={part("credit_cents")} />
      <Line label="Cashback earned" value={part("cashback_cents")} muted />
      <Line label="Total" value={billed ? money(collectedCents(row)) : "—"} strong />
    </dl>
  );
}

function VisitRow({ placeId, row, timezone, initiallyOpen }: { placeId: string; row: MonitorRow; timezone: string; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const name = row.guest ?? "Deleted guest";
  const credit = isSplit(row) ? 0 : n(row, "credit_cents");
  const panel = `visit-${row.id}`;
  const ticket = row.payload.ticket ? String(row.payload.ticket) : null;
  const waiter = row.payload.waiter_name ? String(row.payload.waiter_name) : null;
  return (
    <li id={row.id}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panel : undefined}
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-muted/40 grid w-full grid-cols-[32px_minmax(0,1fr)_auto_16px] items-center gap-x-3 px-4 py-2.5 text-left text-sm sm:px-5"
      >
        <GuestAvatar face={row.customer ? (row.face ?? null) : null} size={32} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("truncate font-medium", !row.customer && "text-muted-foreground")}>{name}</span>
            <VisitBadge status={status(row)} />
          </span>
          <span className="text-muted-foreground text-sm">{when(row.at, timezone)}</span>
        </span>
        <span className="flex flex-col items-end">
          <span className="font-semibold whitespace-nowrap tabular-nums">{total(row)}</span>
          {credit > 0 ? <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">{money(credit)} in credit</span> : null}
        </span>
        <CaretDownIcon size={16} weight="bold" aria-hidden className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div id={panel} className="bg-muted/30 border-border flex flex-col gap-3 border-t px-4 py-3 sm:px-5 sm:pl-[64px]">
          <Breakdown row={row} />
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {ticket ? <span>Ticket {ticket}</span> : null}
            {waiter ? <span>{waiter}</span> : null}
            <span className="font-mono tabular-nums">Visit {shortId(row.id)}</span>
          </div>
          {row.customer ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={customerHref(placeId, row.customer)} className={cn(CHIP, "gap-1")}>
                <UserCircleIcon size={12} weight="bold" aria-hidden />
                {customerLabel(row.customer)}
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function VisitRows({
  placeId,
  initial,
  filter = {},
  clearHref,
}: {
  placeId: string;
  initial: MonitorPage;
  filter?: MonitorFilter;
  /** The unfiltered page, for Show all. */
  clearHref: string;
}) {
  const [page, setPage] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtered = Boolean(filter.id || filter.customer);
  const guest = filter.customer ? (page.rows.find((r) => r.customer === filter.customer)?.guest ?? "this guest") : null;
  const noun = NOUN.visits;
  const wanted = filter.id?.toLowerCase() ?? null;
  const opensOnLoad = (row: MonitorRow) => wanted !== null && (row.id.toLowerCase() === wanted || initial.rows.length === 1);

  async function older() {
    if (!page.next || busy) return;
    setBusy(true);
    setError(null);
    const r = await attempt(listMonitor(placeId, "visits", filter, page.next));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setPage({ ...r.data, rows: [...page.rows, ...r.data.rows] });
  }

  return (
    <div className="flex min-w-0 flex-col">
      {filtered ? (
        <FilterBanner
          text={filter.id ? `Showing ${noun.one} ${shortId(filter.id)}` : `Showing ${guest}'s ${noun.many}`}
          clearHref={clearHref}
        />
      ) : null}
      {page.rows.length === 0 ? (
        <p className="text-muted-foreground px-5 py-6 text-sm sm:px-6">{filtered ? "Nothing matches this filter." : EMPTY.visits}</p>
      ) : (
        <ul className="divide-border divide-y">
          {page.rows.map((row) => (
            // A ?id= deep link lands on its visit already open: the visit's own
            // id in any case, or the one row a linked id (a payment's) found.
            <VisitRow key={row.id} placeId={placeId} row={row} timezone={page.timezone} initiallyOpen={opensOnLoad(row)} />
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
