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
  money,
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
import { CardBadge, CashBadge, CreditBadge, VisitBadge, VoucherBadge } from "./VoucherBadge";
import type { Icon } from "@phosphor-icons/react";
import { CoinsIcon, CreditCardIcon, FootprintsIcon, TicketIcon, UserCircleIcon, XIcon } from "@phosphor-icons/react/dist/ssr";

/** The row grid every Monitor list shares: face · text · amount. */
export const ROW = "grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 text-sm sm:px-5";
/** A small quiet link to a related row. */
export const CHIP =
  "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap tabular-nums";
const META = "text-muted-foreground text-sm";

/** Every chip wears its kind's icon (Pato: "USE ICONS ALWAYS"). */
const CHIP_ICON: Record<LinkKind | "customer", Icon> = {
  customer: UserCircleIcon,
  visit: FootprintsIcon,
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

// ── Payments is a table (MESITA-4683, Pato: "payments in a table too") ────
// A header row and one column per field; money sits right so the digits line
// up. It scrolls sideways inside its card on a narrow screen; the page never
// does. The other Monitor pages keep their rows (MESITA-4568).

const TH = "text-muted-foreground px-3 py-2 text-xs font-medium whitespace-nowrap first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";
const TD = "px-3 py-2 align-middle whitespace-nowrap first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";
const NUM = "text-right tabular-nums";

/** "—" for an empty cell, so a column never reads as broken. */
function Dash() {
  return <span className="text-muted-foreground/60">—</span>;
}

/** A money field of the payload, or "—" when it is zero. */
function cents(row: MonitorRow, ...keys: string[]): React.ReactNode {
  const n = keys.reduce((sum, k) => sum + Number(row.payload[k] ?? 0), 0);
  return n > 0 ? money(n) : <Dash />;
}

const PAYMENT_MONEY: readonly [string, string[]][] = [
  ["Card", ["card_cents"]],
  ["Cash", ["outside_cents"]],
  ["Credit", ["credit_cents"]],
  ["Tip", ["tip_cents"]],
  ["Refunded", ["refunded_cents", "credit_refunded_cents"]],
];

function PaymentsTable({ placeId, rows, timezone }: { placeId: string; rows: MonitorRow[]; timezone: string }) {
  return (
    <div className="scrollbar-thin-dark min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted/40 border-border border-b">
          <tr>
            {["Guest", "Method", "Date", "Customer", "Visit"].map((h) => (
              <th key={h} scope="col" className={TH}>{h}</th>
            ))}
            {PAYMENT_MONEY.map(([h]) => (
              <th key={h} scope="col" className={cn(TH, "text-right")}>{h}</th>
            ))}
            <th scope="col" className={cn(TH, "text-right")}>Total</th>
            <th scope="col" className={cn(TH, "text-right")}>ID</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((row) => {
            const name = row.guest ?? "Deleted guest";
            const visits = row.links.filter((l) => l.kind === "visit");
            return (
              <tr key={row.id} id={row.id} className="hover:bg-muted/30">
                <td className={TD}>
                  <span className="flex items-center gap-2">
                    <GuestAvatar face={row.customer ? (row.face ?? null) : null} size={24} />
                    {row.customer ? (
                      <Link href={customerHref(placeId, row.customer)} className="font-medium underline-offset-2 hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground font-medium">{name}</span>
                    )}
                  </span>
                </td>
                <td className={TD}>
                  <span className="flex gap-1.5">
                    <MethodBadges row={row} />
                  </span>
                </td>
                <td className={cn(TD, "text-muted-foreground")}>{when(row.at, timezone)}</td>
                <td className={TD}>
                  {row.customer ? (
                    <Link href={customerHref(placeId, row.customer)} className={cn(CHIP, "gap-1")}>
                      <ChipIcon kind="customer" />
                      {customerLabel(row.customer)}
                    </Link>
                  ) : (
                    <Dash />
                  )}
                </td>
                <td className={TD}>
                  {visits.length ? (
                    <span className="flex gap-1.5">
                      {visits.slice(0, 3).map((l) => (
                        <Link key={l.id} href={linkHref(placeId, l)} className={cn(CHIP, "gap-1")}>
                          <ChipIcon kind="visit" />
                          {linkLabel(l)}
                        </Link>
                      ))}
                    </span>
                  ) : (
                    <Dash />
                  )}
                </td>
                {PAYMENT_MONEY.map(([h, keys]) => (
                  <td key={h} className={cn(TD, NUM)}>{cents(row, ...keys)}</td>
                ))}
                <td className={cn(TD, NUM, "font-semibold")}>{rowAmount("payments", row)}</td>
                <td className={cn(TD, "text-muted-foreground/70 text-right font-mono text-xs tabular-nums")}>{shortId(row.id)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
      ) : kind === "payments" ? (
        <PaymentsTable placeId={placeId} rows={page.rows} timezone={page.timezone} />
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
