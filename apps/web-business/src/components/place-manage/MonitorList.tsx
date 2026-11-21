"use client";

// One Monitor list (MESITA-4538, Pato: "SIMPLE LISTS. NOTHING ELSE … the
// lists have ids and those ids redirect to other tickets"). One card, newest
// first, 50 at a time with Older. A row: guest · amount, then a grey line with
// the row's #ID, its status, the time, what it is, and labelled chips to the
// rows it relates to. No chart, no totals. The server names guests (masked)
// and refuses editors before this renders.

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/shell/Page";
import { listMonitor } from "@/lib/business-api";
import {
  customerHref,
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
import { RefundButton } from "./RefundButton";

const ROW = "flex flex-col gap-1 px-5 py-3 text-sm sm:px-6";
export const CHIP =
  "bg-muted text-muted-foreground hover:text-foreground inline-flex h-8 items-center rounded-full px-3 text-xs font-medium whitespace-nowrap";

/** At most three chips of one kind, then "+N" to that page filtered to the guest. */
function Chips({ placeId, row }: { placeId: string; row: MonitorRow }) {
  const byKind = new Map<LinkKind, MonitorLink[]>();
  // Stories has no list since MESITA-4553 (config only on General), so a
  // story link has nowhere to land.
  for (const l of row.links) if (l.kind !== "story") byKind.set(l.kind, [...(byKind.get(l.kind) ?? []), l]);
  const chips: React.ReactNode[] = [];
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
      <Link key="other" href={customerHref(placeId, row.other_customer)} className={CHIP}>
        {row.other}
      </Link>,
    );
  }
  return chips.length ? <span className="flex flex-wrap gap-1.5">{chips}</span> : null;
}

/** Whether a row still has money the owner can give back. */
function refundLeft(kind: MonitorKind, row: MonitorRow): number {
  const p = row.payload;
  const n = (k: string) => Number(p[k] ?? 0);
  if (p.status === "refunded") return 0;
  if (kind === "vouchers") return n("amount_cents") - n("refunded_cents");
  if (kind === "payments") return n("amount_cents") - n("refunded_cents") - n("credit_refunded_cents");
  return 0;
}

export function MonitorRowItem({
  placeId,
  kind,
  row,
  timezone,
  onRefunded,
}: {
  placeId: string;
  kind: MonitorKind;
  row: MonitorRow;
  timezone: string;
  onRefunded?: (id: string, status: string | null) => void;
}) {
  const detail = rowDetail(kind, row);
  const refundable = (kind === "payments" || kind === "vouchers") && onRefunded ? refundLeft(kind, row) : 0;
  return (
    <li className={ROW} id={row.id}>
      <div className="flex items-start gap-3">
        <p className="min-w-0 flex-1 font-medium">
          {row.customer && row.guest ? (
            <Link href={customerHref(placeId, row.customer)} className="hover:underline underline-offset-2">
              {row.guest}
            </Link>
          ) : (
            (row.guest ?? "Deleted guest")
          )}
        </p>
        <p className="shrink-0 font-semibold tabular-nums">{rowAmount(kind, row)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <p className="text-muted-foreground min-w-0">
          <span className="tabular-nums">{shortId(row.id)}</span> · {rowStatus(kind, row)} · {when(row.at, timezone)}
          {detail ? ` · ${detail}` : ""}
        </p>
        <Chips placeId={placeId} row={row} />
        {refundable > 0 ? (
          <span className="ml-auto">
            <RefundButton
              placeId={placeId}
              kind={kind === "vouchers" ? "voucher" : "payment"}
              id={row.id}
              leftCents={refundable}
              guest={row.guest}
              onDone={(status) => onRefunded?.(row.id, status)}
            />
          </span>
        ) : null}
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

export function MonitorList({
  placeId,
  kind,
  initial,
  filter = {},
  clearHref,
  title,
  refund = false,
}: {
  placeId: string;
  kind: MonitorKind;
  initial: MonitorPage;
  filter?: MonitorFilter;
  /** The unfiltered page, for Show all. */
  clearHref: string;
  /** A sub-heading when the card holds more than this list. */
  title?: string;
  refund?: boolean;
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

  async function reload() {
    const r = await listMonitor(placeId, kind, filter);
    if (r.ok) setPage(r.data);
  }

  return (
    <div className="flex min-w-0 flex-col">
      {title ? <h2 className="px-5 pt-4 pb-2 font-semibold sm:px-6">{title}</h2> : null}
      {filtered ? (
        <FilterBanner
          text={filter.id ? `Showing ${noun.one} ${shortId(filter.id)}` : `Showing ${guest}'s ${noun.many}`}
          clearHref={clearHref}
        />
      ) : null}
      {page.rows.length === 0 ? (
        <p className="text-muted-foreground px-5 py-4 text-sm sm:px-6">
          {filtered ? "Nothing matches this filter." : EMPTY[kind]}
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {page.rows.map((row) => (
            <MonitorRowItem
              key={row.id}
              placeId={placeId}
              kind={kind}
              row={row}
              timezone={page.timezone}
              onRefunded={refund ? () => void reload() : undefined}
            />
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
  return <Card className="flex min-w-0 flex-col p-0 sm:p-0">{children}</Card>;
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
