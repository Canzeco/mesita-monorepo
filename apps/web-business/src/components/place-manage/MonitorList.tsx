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
import { CreditBadge, VoucherBadge } from "./VoucherBadge";

/** The row grid every Monitor list shares: face · text · amount. */
export const ROW = "grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-x-3 px-5 py-3.5 text-sm sm:px-6";
/** A small quiet link to a related row. */
export const CHIP =
  "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap tabular-nums";
const META = "text-muted-foreground text-sm";

/** At most three chips of one kind, then "+N" to that page filtered to the guest. */
function Chips({ placeId, row }: { placeId: string; row: MonitorRow }) {
  const byKind = new Map<LinkKind, MonitorLink[]>();
  // Stories (MESITA-4553) and Credits (MESITA-4555) have no list, so their
  // links have nowhere to land.
  for (const l of row.links) if (l.kind !== "story" && l.kind !== "credit") byKind.set(l.kind, [...(byKind.get(l.kind) ?? []), l]);
  const chips: React.ReactNode[] = [];
  if (row.customer) {
    chips.push(
      <Link key="customer" href={customerHref(placeId, row.customer)} className={CHIP}>
        {customerLabel(row.customer)}
      </Link>,
    );
  }
  for (const [kind, links] of byKind) {
    for (const l of links.slice(0, 3)) {
      chips.push(
        <Link key={`${kind}${l.id}`} href={linkHref(placeId, l)} className={CHIP}>
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
        <GuestAvatar face={row.other_face ?? null} size={20} />
        {row.other}
      </Link>,
    );
  }
  return chips.length ? <span className="mt-2 flex flex-wrap gap-1.5">{chips}</span> : null;
}

export function MonitorRowItem({ placeId, kind, row, timezone }: { placeId: string; kind: MonitorKind; row: MonitorRow; timezone: string }) {
  const detail = rowDetail(kind, row);
  const lead = statusWorthShowing(kind, row) ? rowStatus(kind, row) : null;
  const name = row.guest ?? "Deleted guest";
  return (
    <li className={ROW} id={row.id}>
      {row.customer ? (
        <Link href={customerHref(placeId, row.customer)} aria-label={name}>
          <GuestAvatar face={row.face ?? null} />
        </Link>
      ) : (
        <GuestAvatar face={null} />
      )}
      <div className="min-w-0">
        <p className="truncate font-medium">
          {row.customer ? (
            <Link href={customerHref(placeId, row.customer)} className="underline-offset-2 hover:underline">
              {name}
            </Link>
          ) : (
            <span className="text-muted-foreground">{name}</span>
          )}
        </p>
        {kind === "vouchers" || kind === "credits" || kind === "gifts" ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {kind === "vouchers" ? (
              <VoucherBadge code={(row.payload.voucher as string | null) ?? null} />
            ) : (
              <CreditBadge kind={kind === "gifts" ? "gift" : String(row.payload.kind ?? "")} voucher={(row.payload.voucher as string | null) ?? null} />
            )}
            <span className={META}>{[lead, detail, when(row.at, timezone)].filter(Boolean).join(" · ")}</span>
          </p>
        ) : (
          <p className={META}>{[lead, detail, when(row.at, timezone)].filter(Boolean).join(" · ")}</p>
        )}
        <Chips placeId={placeId} row={row} />
      </div>
      <div className="text-right">
        <p className="font-semibold whitespace-nowrap tabular-nums">{rowAmount(kind, row)}</p>
        <p className="text-muted-foreground/70 mt-0.5 font-mono text-xs tabular-nums">{shortId(row.id)}</p>
      </div>
    </li>
  );
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
