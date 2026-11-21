"use client";

// Operations' ticket desk (MESITA-4487). The Views frame: the last 30 days
// and the totals on the left, every ticket of this kind on the right, 50 at
// a time. No mock rows. The owner and Mesita staff only; the server refuses
// an editor before this renders.

import { useState } from "react";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { Card } from "@/components/shell/Page";
import { listPlaceTickets } from "@/lib/business-api";
import {
  ticketLine,
  ticketStatus,
  ticketWhen,
  type GiftTicket,
  type PlaceTicketDesk,
  type StoryTicket,
  type TicketKind,
  type TicketRow,
  type VisitTicket,
  type VoucherTicket,
} from "@/lib/ticket-desk";
import { TicketChart } from "./TicketChart";

const ROW = "flex min-h-14 items-center gap-3 px-5 py-3 text-sm sm:px-6";

const COPY: Record<TicketKind, { chart: string; log: string; empty: string; rows: { key: string; name: string; line: string; money?: boolean }[] }> = {
  visits: {
    chart: "Every visit.",
    log: "Who came, when, and what they paid.",
    empty: "No visits yet. A visit is a guest paying here with Mesita.",
    rows: [
      { key: "visits", name: "Visits", line: "Bills a guest paid here, and a waiter's bill still open." },
      { key: "guests", name: "Guests", line: "Different guests on those visits." },
      { key: "open", name: "Open", line: "A waiter started the bill and it is not paid yet." },
      { key: "paid_cents", name: "Paid", line: "Bills and tips on paid visits.", money: true },
    ],
  },
  vouchers: {
    chart: "Every prepayment.",
    log: "Vouchers guests bought here, newest first.",
    empty: "No vouchers yet. A voucher is a prepayment a guest buys here.",
    rows: [
      { key: "vouchers", name: "Vouchers", line: "Prepayments guests bought." },
      { key: "guests", name: "Guests", line: "Different guests who bought one." },
      { key: "paid_cents", name: "Paid", line: "What they paid, after refunds.", money: true },
      { key: "bonus_cents", name: "Bonus", line: "Extra credit those vouchers gave.", money: true },
    ],
  },
  stories: {
    chart: "Every story ticket.",
    log: "A posted story that nobody has looked at comes first.",
    empty: "No stories yet. A story ticket starts when a guest buys a Story voucher.",
    rows: [
      { key: "needs_look", name: "Needs a look", line: "Posted. Someone at the place still has to look." },
      { key: "waiting_post", name: "Waiting for the post", line: "Bought. The guest has not posted yet." },
      { key: "approved", name: "Approved", line: "Looked at. The bonus waits for the re-check." },
      { key: "released", name: "Bonus paid", line: "The re-check paid the bonus." },
      { key: "void", name: "Void", line: "Expired, deleted, refunded, or could not be re-checked." },
    ],
  },
  gifts: {
    chart: "Every gift.",
    log: "Credit guests sent each other here.",
    empty: "No gifts yet. A gift is credit one guest sends a friend, to spend here.",
    rows: [
      { key: "open", name: "Open links", line: "Sent, and nobody has taken them yet." },
      { key: "claimed", name: "Claimed", line: "A friend took the credit." },
      { key: "taken_back", name: "Taken back", line: "The sender undid the link." },
      { key: "open_cents", name: "Still open", line: "Credit sitting on open links.", money: true },
    ],
  },
};

function money(cents: number): string {
  return moneyLabel(cents, "MXN");
}

function amount(kind: TicketKind, row: TicketRow): string {
  if (kind === "visits") {
    const v = row as VisitTicket;
    if (v.bill_cents == null) return "Waiting for the bill";
    return money(v.bill_cents + v.tip_cents);
  }
  if (kind === "vouchers") {
    const v = row as VoucherTicket;
    return money(v.amount_cents);
  }
  if (kind === "stories") return money((row as StoryTicket).bonus_cents);
  return moneyLabel((row as GiftTicket).amount_cents, (row as GiftTicket).currency.toUpperCase());
}

export function TicketDesk({ placeId, kind, initial }: { placeId: string; kind: TicketKind; initial: PlaceTicketDesk }) {
  const [desk, setDesk] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[kind];

  async function older() {
    if (!desk.next || busy) return;
    setBusy(true);
    setError(null);
    const r = await listPlaceTickets(placeId, kind, desk.next);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDesk({ ...r.data, rows: [...desk.rows, ...r.data.rows] });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 pb-8 lg:grid-cols-2 lg:gap-5">
      <Card className="flex min-w-0 flex-col p-0 sm:p-0">
        <TicketChart days={desk.days} line={copy.chart} money={money} />
        <ul className="divide-border border-border divide-y border-t">
          {copy.rows.map((row) => (
            <li key={row.key} className={ROW}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{row.name}</p>
                <p className="text-muted-foreground">{row.line}</p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {row.money ? money(Number(desk.totals[row.key] ?? 0)) : Number(desk.totals[row.key] ?? 0).toLocaleString("en-US")}
              </p>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex min-w-0 flex-col p-0 sm:p-0">
        <div className="px-5 py-4 sm:px-6">
          <h2 className="font-sans text-sm font-medium tracking-normal">Log</h2>
          <p className="text-muted-foreground text-sm">{copy.log}</p>
        </div>
        {desk.rows.length === 0 ? (
          <p className="text-muted-foreground border-border border-t px-5 py-4 text-sm sm:px-6">{copy.empty}</p>
        ) : (
          <ul className="divide-border border-border divide-y border-t">
            {desk.rows.map((row) => {
              const line = ticketLine(kind, row);
              return (
                <li key={row.id} className={ROW}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{row.guest}</p>
                    <p className="text-muted-foreground">
                      {ticketStatus(kind, row)}
                      {line ? ` · ${line}` : ""} · {ticketWhen(row.at, desk.timezone)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{amount(kind, row)}</p>
                </li>
              );
            })}
          </ul>
        )}
        {error ? <p className="text-destructive px-5 py-3 text-sm sm:px-6">{error}</p> : null}
        {desk.next ? (
          <div className="px-5 py-3 sm:px-6">
            <button type="button" className="text-sm font-semibold disabled:opacity-50" disabled={busy} onClick={older}>
              {busy ? "Loading…" : "Older"}
            </button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
