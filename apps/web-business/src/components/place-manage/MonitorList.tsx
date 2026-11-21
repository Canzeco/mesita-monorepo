"use client";

// One Monitor list (MESITA-4538, Pato: "SIMPLE LISTS. NOTHING ELSE … the
// lists have ids and those ids redirect to other tickets"). A table since
// MESITA-4566 (Pato: "make all those tables in table format"): one column per
// field, newest first, 50 at a time with Older. The guest's face and name, a
// Customer #ID, the kind's own fields, chips to the related rows, the amount
// and the row's own #ID. No buttons on a row (Pato: "don't add button to
// refund"). The server names guests (masked) and refuses editors before this
// renders.

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/shell/Page";
import { listMonitor } from "@/lib/business-api";
import {
  customerListHref,
  EMPTY,
  linkHref,
  linkKindPage,
  linkLabel,
  money,
  NOUN,
  rowAmount,
  rowStatus,
  shortId,
  when,
  type LinkKind,
  type MonitorFilter,
  type MonitorKind,
  type MonitorPage,
  type MonitorRow,
} from "@/lib/monitor";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { GuestAvatar } from "./GuestAvatar";
import { CHIP, CustomerChip, Dash, GuestCell, IdCell, MonitorTable, type Column } from "./MonitorTable";
import { CardBadge, CreditBadge, VisitBadge, VoucherBadge } from "./VoucherBadge";
import type { Icon } from "@phosphor-icons/react";
import { CoinsIcon, CreditCardIcon, FootprintsIcon, TicketIcon } from "@phosphor-icons/react/dist/ssr";

export { CHIP };

/** Every chip wears its kind's icon (Pato: "USE ICONS ALWAYS"). */
const CHIP_ICON: Record<LinkKind, Icon> = {
  visit: FootprintsIcon,
  payment: CreditCardIcon,
  voucher: TicketIcon,
  credit: CoinsIcon,
  story: TicketIcon,
};

/** The related rows of some kinds: at most three chips, then "+N" to that
 *  page filtered to the guest. Stories and Credits have no list, so their
 *  links have nowhere to land. */
function Related({ placeId, row, kinds }: { placeId: string; row: MonitorRow; kinds: LinkKind[] }) {
  const links = row.links.filter((l) => kinds.includes(l.kind));
  if (links.length === 0) return <Dash />;
  const chips: React.ReactNode[] = [];
  for (const kind of kinds) {
    const mine = links.filter((l) => l.kind === kind);
    const I = CHIP_ICON[kind];
    for (const l of mine.slice(0, 3)) {
      chips.push(
        <Link key={`${kind}${l.id}`} href={linkHref(placeId, l)} className={cn(CHIP, "gap-1")}>
          <I size={12} weight="bold" aria-hidden />
          {linkLabel(l)}
        </Link>,
      );
    }
    const page = linkKindPage(kind);
    if (mine.length > 3 && page && row.customer) {
      chips.push(
        <Link key={`${kind}+`} href={customerListHref(placeId, page, row.customer)} className={CHIP}>
          +{mine.length - 3}
        </Link>,
      );
    }
  }
  return <span className="flex gap-1.5">{chips}</span>;
}

/** A money field of the payload, or "—" when it is zero. */
function cents(row: MonitorRow, ...keys: string[]): React.ReactNode {
  const n = keys.reduce((sum, k) => sum + Number(row.payload[k] ?? 0), 0);
  return n > 0 ? money(n) : <Dash />;
}

function text(v: unknown): React.ReactNode {
  return v == null || v === "" ? <Dash /> : String(v);
}

/** The columns of each kind's table. */
function columnsFor(kind: MonitorKind, placeId: string, timezone: string): Column<MonitorRow>[] {
  const id: Column<MonitorRow> = { head: "ID", cell: (r) => <IdCell id={shortId(r.id)} /> };
  const date: Column<MonitorRow> = { head: "Date", cell: (r) => when(r.at, timezone) };
  const guest: Column<MonitorRow> = {
    head: "Guest",
    cell: (r) => <GuestCell placeId={placeId} customer={r.customer} name={r.guest} face={r.face ?? null} />,
  };
  const customer: Column<MonitorRow> = { head: "Customer", cell: (r) => <CustomerChip placeId={placeId} customer={r.customer} /> };
  const amount = (head: string): Column<MonitorRow> => ({ head, align: "right", cell: (r) => <span className="font-semibold">{rowAmount(kind, r)}</span> });

  if (kind === "visits") {
    return [
      id,
      date,
      guest,
      customer,
      { head: "Status", cell: (r) => <VisitBadge status={rowStatus(kind, r)} /> },
      { head: "Waiter", cell: (r) => text(r.payload.waiter_name) },
      { head: "Ticket", cell: (r) => text(r.payload.ticket) },
      { head: "Payment", cell: (r) => <Related placeId={placeId} row={r} kinds={["payment"]} /> },
      { head: "Bill", align: "right", cell: (r) => cents(r, "bill_cents") },
      { head: "Tip", align: "right", cell: (r) => cents(r, "tip_cents") },
      amount("Total"),
    ];
  }
  if (kind === "vouchers") {
    return [
      id,
      date,
      guest,
      customer,
      { head: "Voucher", cell: (r) => <VoucherBadge code={(r.payload.voucher as string | null) ?? null} /> },
      { head: "Status", cell: (r) => rowStatus(kind, r) },
      { head: "Related", cell: (r) => <Related placeId={placeId} row={r} kinds={["visit", "payment"]} /> },
      { head: "Bonus", align: "right", cell: (r) => cents(r, "bonus_cents") },
      amount("Paid"),
    ];
  }
  if (kind === "gifts") {
    return [
      id,
      date,
      { ...guest, head: "From" },
      {
        head: "To",
        cell: (r) =>
          r.other ? (
            <GuestCell placeId={placeId} customer={r.other_customer} name={r.other} face={r.other_face ?? null} />
          ) : (
            <span className="text-muted-foreground flex items-center gap-2">
              <GuestAvatar face={null} size={24} />
              Not claimed
            </span>
          ),
      },
      { head: "Status", cell: (r) => rowStatus(kind, r) },
      amount("Amount"),
    ];
  }
  if (kind === "payments") {
    return [
      id,
      date,
      guest,
      customer,
      { head: "Status", cell: (r) => <CardBadge status={rowStatus(kind, r)} /> },
      { head: "Visit", cell: (r) => <Related placeId={placeId} row={r} kinds={["visit"]} /> },
      { head: "Card", align: "right", cell: (r) => cents(r, "card_cents") },
      { head: "Credit", align: "right", cell: (r) => cents(r, "credit_cents") },
      { head: "Tip", align: "right", cell: (r) => cents(r, "tip_cents") },
      { head: "Refunded", align: "right", cell: (r) => cents(r, "refunded_cents", "credit_refunded_cents") },
      amount("Total"),
    ];
  }
  // Credits and Stories have no page today; a plain table still reads.
  return [
    id,
    date,
    guest,
    customer,
    { head: "What", cell: (r) => <CreditBadge kind={String(r.payload.kind ?? "")} voucher={(r.payload.voucher as string | null) ?? null} /> },
    { head: "Detail", cell: (r) => rowStatus(kind, r) },
    amount("Amount"),
  ];
}

/** "Showing visit #A1B2C3 · Show all" or "Showing Ana's visits · Show all". */
export function FilterBanner({ text, clearHref }: { text: string; clearHref: string }) {
  return (
    <p className="border-border bg-muted/40 border-b px-5 py-2.5 text-sm sm:px-6">
      {text} ·{" "}
      <Link href={clearHref} className="font-semibold underline underline-offset-2">
        Show all
      </Link>
    </p>
  );
}

/** A card's title row: the title on the left, one quiet action on the right. */
export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3.5 sm:px-6">
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
  );
}

export function MonitorList({
  placeId,
  kind,
  initial,
  filter = {},
  clearHref,
}: {
  placeId: string;
  kind: MonitorKind;
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
  const noun = NOUN[kind];

  async function older() {
    if (!page.next || busy) return;
    setBusy(true);
    setError(null);
    const r = await listMonitor(placeId, kind, filter, page.next);
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
        <p className="text-muted-foreground px-5 py-6 text-sm sm:px-6">{filtered ? "Nothing matches this filter." : EMPTY[kind]}</p>
      ) : (
        <MonitorTable columns={columnsFor(kind, placeId, page.timezone)} rows={page.rows} rowKey={(r) => r.id} rowId={(r) => r.id} />
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

/** The card every Monitor page wears around its list. */
export function MonitorCard({ children }: { children: React.ReactNode }) {
  return <Card className="flex min-w-0 flex-col overflow-hidden p-0 sm:p-0">{children}</Card>;
}

/** The server refused or failed: the owner-only card, or what went wrong. */
export function MonitorError({ code, error }: { code?: string | null; error: string }) {
  const owner = code === "owner_only" || code === "forbidden";
  return (
    <div className="flex flex-col gap-4 pb-8">
      <Card>
        <p className="font-semibold">{owner ? "Only the owner sees these." : "These didn't load."}</p>
        <p className="text-muted-foreground mt-1 text-sm">{owner ? "Money at this place is the owner's to read." : error}</p>
      </Card>
    </div>
  );
}
