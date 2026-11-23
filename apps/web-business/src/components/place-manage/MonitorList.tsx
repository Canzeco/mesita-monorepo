"use client";

// One Monitor list (MESITA-4538, Pato: "SIMPLE LISTS. NOTHING ELSE … the
// lists have ids and those ids redirect to other tickets"; the row redrawn by
// MESITA-4554, Pato: "more friendly profile picture"). One card, newest first,
// 50 at a time with Older. A row reads like a contacts list: the guest's face,
// their name, one quiet line of what happened and when, small chips to the
// related rows; the amount and the row's own #ID on the right. No buttons on a
// row (Pato: "don't add button to refund"). The server names guests (masked)
// and refuses editors before this renders.

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/shell/Page";
import { listMonitor } from "@/lib/business-api";
import {
  customerHref,
  customerLabel,
  customerListHref,
  EMPTY,
  linkHref,
  linkKindPage,
  linkLabel,
  NOUN,
  rowAmount,
  rowDetail,
  rowStatus,
  shortId,
  statusWorthShowing,
  when,
  type LinkKind,
  type MonitorFilter,
  type MonitorKind,
  type MonitorLink,
  type MonitorPage,
  type MonitorRow,
} from "@/lib/monitor";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { GuestAvatar } from "./GuestAvatar";
import { MonitorTable } from "./MonitorTable";
import { MONITOR_COLUMNS, TABLE_KINDS, unmatchedHandle, type TableKind } from "@/lib/monitor-columns";
import { CardBadge, CashBadge, CreditBadge, VisitBadge, VoucherBadge } from "./VoucherBadge";
import type { Icon } from "@phosphor-icons/react";
import { CoinsIcon, CreditCardIcon, ReceiptIcon, TicketIcon, UserCircleIcon, XIcon } from "@phosphor-icons/react/dist/ssr";

/** The row grid every Monitor list shares: face · text · amount. */
export const ROW = "grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-sm sm:px-5";
/** A small quiet link to a related row. */
export const CHIP =
  "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap tabular-nums";
const META = "text-muted-foreground text-sm";

/** Every chip wears its kind's icon (Pato: "USE ICONS ALWAYS"). */
const CHIP_ICON: Record<LinkKind | "customer", Icon> = {
  customer: UserCircleIcon,
  visit: ReceiptIcon,
  payment: CreditCardIcon,
  voucher: TicketIcon,
  credit: CoinsIcon,
};

function ChipIcon({ kind }: { kind: LinkKind | "customer" }) {
  const I = CHIP_ICON[kind];
  return <I size={12} weight="bold" aria-hidden />;
}

/** At most three chips of one kind, then "+N" to that page filtered to the guest. */
function Chips({ placeId, row }: { placeId: string; row: MonitorRow }) {
  const byKind = new Map<LinkKind, MonitorLink[]>();
  // Credits (MESITA-4555) have no list, so their links have nowhere to land;
  // a kind this app does not know (an old Story, MESITA-4641) neither.
  for (const l of row.links) if (l.kind !== "credit" && l.kind in CHIP_ICON) byKind.set(l.kind, [...(byKind.get(l.kind) ?? []), l]);
  const chips: React.ReactNode[] = [];
  if (row.customer) {
    chips.push(
      <Link key="customer" href={customerHref(placeId, row.customer)} className={cn(CHIP, "gap-1")}>
        <ChipIcon kind="customer" />
        {customerLabel(row.customer)}
      </Link>,
    );
  }
  for (const [kind, links] of byKind) {
    for (const l of links.slice(0, 3)) {
      chips.push(
        <Link key={`${kind}${l.id}`} href={linkHref(placeId, l)} className={cn(CHIP, "gap-1")}>
          <ChipIcon kind={kind} />
          {linkLabel(l)}
        </Link>,
      );
    }
    const page = linkKindPage(kind);
    if (links.length > 3 && page && row.customer) {
      chips.push(
        <Link key={`${kind}+`} href={customerListHref(placeId, page, row.customer)} className={CHIP}>
          +{links.length - 3}
        </Link>,
      );
    }
  }
  if (row.other_customer && row.other) {
    chips.push(
      <Link key="other" href={customerHref(placeId, row.other_customer)} className={cn(CHIP, "gap-1.5 pl-0.5")}>
        <GuestAvatar face={row.other_face ?? null} size={16} />
        {row.other}
      </Link>,
    );
  }
  return chips.length ? <>{chips}</> : null;
}

/** How a bill was paid: Card (through Stripe), Cash (the outside part, paid
 *  at the table), Credit; one badge per part that is not zero. */
function MethodBadges({ row }: { row: MonitorRow }) {
  const n = (k: string) => Number(row.payload[k] ?? 0);
  return (
    <>
      {n("card_cents") > 0 ? <CardBadge status="Card" /> : null}
      {n("outside_cents") > 0 ? <CashBadge /> : null}
      {n("credit_cents") > 0 ? <CreditBadge kind="credit" voucher={null} /> : null}
    </>
  );
}

export function MonitorRowItem({ placeId, kind, row, timezone }: { placeId: string; kind: MonitorKind; row: MonitorRow; timezone: string }) {
  const detail = rowDetail(kind, row);
  const lead = statusWorthShowing(kind, row) ? rowStatus(kind, row) : null;
  const name = row.guest ?? "Deleted guest";
  return (
    <li className={ROW} id={row.id}>
      {row.customer ? (
        <Link href={customerHref(placeId, row.customer)} aria-label={name}>
          <GuestAvatar face={row.face ?? null} size={32} />
        </Link>
      ) : (
        <GuestAvatar face={null} size={32} />
      )}
      {/* One line that wraps (Pato: "too big … make it cleaner"). */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {row.customer ? (
          <Link href={customerHref(placeId, row.customer)} className="truncate font-medium underline-offset-2 hover:underline">
            {name}
          </Link>
        ) : (
          <span className="text-muted-foreground font-medium">{name}</span>
        )}
        {kind === "vouchers" ? (
          <VoucherBadge code={(row.payload.voucher as string | null) ?? null} />
        ) : kind === "visits" ? (
          <VisitBadge status={rowStatus(kind, row)} />
        ) : kind === "payments" ? (
          // Card, Cash or Credit, one badge per part (MESITA-4567, Pato:
          // "payments must include cash option").
          <MethodBadges row={row} />
        ) : (
          <CreditBadge kind={kind === "gifts" ? "gift" : String(row.payload.kind ?? "")} voucher={(row.payload.voucher as string | null) ?? null} />
        )}
        <span className={META}>
          {[kind === "visits" ? null : lead, detail, when(row.at, timezone)].filter(Boolean).join(" · ")}
        </span>
        <Chips placeId={placeId} row={row} />
      </div>
      <div className="text-right">
        <p className="font-semibold whitespace-nowrap tabular-nums">{rowAmount(kind, row)}</p>
        <p className="text-muted-foreground/70 font-mono text-xs tabular-nums">{shortId(row.id)}</p>
      </div>
    </li>
  );
}

/** A table's guest cell: the face and the name, linked to the guest on
 *  Customers (MESITA-4682). */
export function GuestCell({ placeId, row }: { placeId: string; row: MonitorRow }) {
  // A story whose poster no guest matched shows their @handle (MESITA-4732).
  const name = row.guest ?? unmatchedHandle(row) ?? "Deleted guest";
  return (
    <span className="flex items-center gap-2.5">
      <GuestAvatar face={row.customer ? (row.face ?? null) : null} size={28} />
      {row.customer ? (
        <Link href={customerHref(placeId, row.customer)} className="max-w-[12rem] truncate font-medium underline-offset-2 hover:underline">
          {name}
        </Link>
      ) : (
        <span className="text-muted-foreground font-medium">{name}</span>
      )}
    </span>
  );
}

/** "Showing Ana's visits" with a Show all button (MESITA-4683, Pato: "the
 *  show all button must be bigger and clearer, more visible"; an underlined
 *  word before). */
export function FilterBanner({ text, clearHref }: { text: string; clearHref: string }) {
  return (
    <div className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 sm:px-6">
      <p className="text-sm font-medium">{text}</p>
      <Link
        href={clearHref}
        className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold hover:opacity-90"
      >
        <XIcon size={16} weight="bold" aria-hidden />
        Show all
      </Link>
    </div>
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
      ) : TABLE_KINDS.includes(kind) ? (
        <MonitorTable
          placeId={placeId}
          rows={page.rows}
          rowKey={(row) => row.id}
          rowId={(row) => row.id}
          guestLabel={kind === "gifts" ? "From" : "Guest"}
          guest={(row) => <GuestCell placeId={placeId} row={row} />}
          columns={MONITOR_COLUMNS[kind as TableKind]}
          timezone={page.timezone}
        />
      ) : (
        <ul className="divide-border divide-y">
          {page.rows.map((row) => (
            <MonitorRowItem key={row.id} placeId={placeId} kind={kind} row={row} timezone={page.timezone} />
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
