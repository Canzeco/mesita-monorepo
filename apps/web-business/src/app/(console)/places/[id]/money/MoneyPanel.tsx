"use client";

// The owner's money on Operations › Money (MESITA-3307, W3; moved off
// Payments by MESITA-3596, Pato: "that box of MONEY goes into operations
// money, not in payments. in payments its just to configure"): one card of
// four rows (Money received · Mesita's fee · Credit outstanding · Tips), the
// fee rates and the test-mode cap in one grey note under it, then the Log:
// what each guest paid, newest first, 50 at a time, Older for more. No date
// inputs (MESITA-3596). The owner and Mesita staff only (the server answers
// editors 403). Who paid is
// masked by the server; the page never sees an email. Each row the guest
// still has money on carries Refund (MESITA-3381): the owner gives back all
// of it or part, the card part to the card first, then the credit part as
// credit; a row given back whole reads Refunded.
//
// MESITA-3548 (Payments Flow v2, step D): the cash side. Money received
// counts outside bills the waiter marked Received; Tips count card tips only
// (a cash tip is collected in person). Each payment line says who confirmed
// it (Stripe · Waiter · Credit) and, when it paid a waiter's bill that Mesita
// did not cover whole, "Bill $Y · on Mesita $X · rest at the table $Y−X",
// once per bill: Pay at the table can write a card row and a cash row for one
// tab, and the bill line sums them on the first. Every new field may be
// missing (the old RPC shape) and then shows nothing.

import { useState } from "react";
import { moneyLabel } from "@mesita/place-profile/lib/money";
import { SIGN } from "@mesita/place-profile/lib/pay-steps";
import { Card } from "@/components/shell/Page";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { getPlaceMoney, refundPlaceMoneyRow, type PlaceMoney, type PlaceMoneyRow } from "@/lib/business-api";

const CURRENCY = "MXN";
const ROW = "flex min-h-14 items-center gap-4 px-5 py-3 text-sm sm:px-6";
const NOTE = "text-muted-foreground text-xs";

/** Shown under the totals, never in the TestBand. */
export const FEE_NOTE = "Mesita's fee: 5% on vouchers, 5% on card payments.";
export const CAP_NOTE = "In test mode a place holds at most $20,000.00MX of guests' credit.";

const KIND: Record<string, string> = {
  voucher_200: "Small Voucher",
  voucher_1000: "Medium Voucher",
  voucher_5000: "Big Voucher",
  voucher_welcome: "Welcome Voucher",
  voucher_story: "Story Voucher",
  voucher_vip: "VIP Voucher",
};

const CONFIRMER: Record<string, string> = { stripe: "Stripe", waiter: "Waiter", credit: "Credit" };

/** One waiter's bill across the loaded rows: a charge's one row, or a tab's
 *  card and cash rows. The bill line goes on the first row only. */
type Bill = { first: string; bill: number; onMesita: number };

/** What Mesita covered of a payment: its credit and card parts. */
function onMesitaOf(r: PlaceMoneyRow): number {
  if (typeof r.credit_cents === "number" && typeof r.card_cents === "number") return r.credit_cents + r.card_cents;
  return Math.max(r.amount_cents - r.tip_cents - (r.outside_cents ?? 0), 0);
}

export function billsOf(rows: PlaceMoneyRow[]): Map<string, Bill> {
  const out = new Map<string, Bill>();
  for (const r of rows) {
    if (r.kind !== "payment" || r.charge_amount_cents == null) continue;
    const key = r.tab_id ?? r.id;
    const b = out.get(key);
    if (b) b.onMesita += onMesitaOf(r);
    else out.set(key, { first: r.id, bill: r.charge_amount_cents, onMesita: onMesitaOf(r) });
  }
  return out;
}

function money(cents: number): string {
  return moneyLabel(cents, CURRENCY);
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Pesos typed by the owner as cents, or null when it is not a positive amount. */
function centsOf(text: string): number | null {
  const n = Number(text.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** The Refund action on one row: Refund opens the amount (all that is left),
 *  Confirm sends it. */
function RefundAction({ placeId, row, onDone }: { placeId: string; row: PlaceMoneyRow; onDone: (error: string | null) => void }) {
  const left = row.status === "refunded" ? 0 : row.amount_cents - row.refunded_cents;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((left / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  if (left <= 0) return <p className="text-muted-foreground shrink-0 text-xs font-medium" data-refunded>Refunded</p>;
  if (!open) {
    return (
      <button type="button" className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-medium" onClick={() => setOpen(true)}>
        Refund
      </button>
    );
  }
  const cents = centsOf(amount);
  const valid = cents !== null && cents <= left;
  return (
    <form
      className="flex shrink-0 items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        const r = await refundPlaceMoneyRow(placeId, row, cents === left ? null : cents);
        setBusy(false);
        if (r.ok) setOpen(false);
        onDone(r.ok ? null : r.error);
      }}
    >
      <input
        aria-label="Amount to refund"
        inputMode="decimal"
        className="border-border bg-background h-8 w-24 rounded-lg border px-2 text-sm tabular-nums"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button type="submit" className="text-foreground text-xs font-semibold disabled:opacity-50" disabled={!valid || busy}>
        {busy ? "Refunding…" : "Confirm"}
      </button>
      <button type="button" className="text-muted-foreground text-xs" disabled={busy} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

export function MoneyPanel({ placeId, initial }: { placeId: string; initial: PlaceMoney }) {
  const [money_, setMoney] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(more: boolean) {
    setBusy(true);
    setError(null);
    const r = await getPlaceMoney(placeId, { before: more ? money_.next : null });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setMoney(more ? { ...r.data, rows: [...money_.rows, ...r.data.rows] } : r.data);
  }

  const totals: { label: string; value: string; line?: string }[] = [
    {
      label: "Money received",
      value: money(money_.received_cents),
      line: "Vouchers, card payments and cash bills your waiters marked Received, after refunds. Credit spent is not new money.",
    },
    { label: "Mesita's fee", value: money(money_.fee_cents) },
    {
      label: "Credit outstanding",
      value: money(money_.available_cents + money_.pending_cents),
      line: `${money(money_.available_cents)} available · ${money(money_.pending_cents)} pending. Guests spend it here.`,
    },
    { label: "Tips", value: money(money_.tips_cents), line: "Tips paid by card. Yours in full; no fee. Cash tips stay with your staff and are not counted." },
  ];
  const share = money_.received_share;
  const ceiling = money_.outside_cashback_ceiling_cents ?? 0;
  const bills = billsOf(money_.rows);

  return (
    <div className="grid grid-cols-1 items-start gap-4 pb-8 lg:grid-cols-2 lg:gap-5">
      <Card className="flex min-w-0 flex-col p-0 sm:p-0">
        <h2 className="px-5 pt-4 pb-2 font-semibold sm:px-6">Money</h2>
        <ul className="divide-border divide-y">
          {totals.map((t) => (
            <li key={t.label} className={ROW}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.label}</p>
                {t.line ? <p className="text-muted-foreground">{t.line}</p> : null}
              </div>
              <p className="font-semibold whitespace-nowrap tabular-nums">{t.value}</p>
            </li>
          ))}
        </ul>
        <p className={`${NOTE} px-5 pb-4 sm:px-6`} data-fee-note>
          {FEE_NOTE}
          {money_.test_mode ? ` ${CAP_NOTE}` : ""}
        </p>
        {share && share.total > 0 ? (
          <p className={`${NOTE} px-5 pb-4 sm:px-6`} data-received-share>
            {share.received} of {share.total} waiter&apos;s bills ended in Received (paid in cash).
          </p>
        ) : null}
        {ceiling > 0 && (money_.outside_cashback_today_cents ?? 0) > 0 ? (
          <p className={`${NOTE} px-5 pb-4 sm:px-6`} data-outside-cap>
            Cashback on cash bills in the last 24 hours: {money(money_.outside_cashback_today_cents ?? 0)} of {money(ceiling)} a day.
          </p>
        ) : null}
      </Card>

      <Card className="flex min-w-0 flex-col p-0 sm:p-0">
        <div className="px-5 pt-4 pb-3 sm:px-6">
          <h2 className="font-semibold">Log</h2>
          <p className="text-muted-foreground text-sm">Every payment, voucher and refund, newest first.</p>
        </div>
        {money_.rows.length === 0 ? (
          <p className="text-muted-foreground px-5 pb-5 text-sm sm:px-6">
            No payments yet. Vouchers guests buy and bills they pay on Mesita show here.
          </p>
        ) : (
          <ul className="divide-border divide-y border-t">
            {money_.rows.map((r) => {
              const outside = (r.outside_cents ?? 0) > 0 || r.part === "outside";
              const bill = bills.get(r.tab_id ?? r.id);
              const rest = bill && bill.first === r.id ? bill.bill - bill.onMesita : 0;
              const fullBack = outside ? Math.floor(((r.outside_cents ?? 0) * (r.outside_cashback_bps ?? 0)) / 10000) : 0;
              const cut = fullBack > 0 && (r.cashback_cents ?? 0) < fullBack && r.status !== "refunded";
              return (
              <li key={r.id} className={`${ROW} flex-wrap`}>
                <p className="w-28 shrink-0 font-semibold tabular-nums">{money(r.amount_cents)}</p>
                <p className="text-muted-foreground min-w-0 flex-1 truncate">
                  {r.kind === "voucher" ? KIND[r.voucher ?? ""] ?? "Voucher" : outside ? "Cash bill" : "Payment"}
                  {r.tip_cents > 0 ? ` (${outside ? "cash tip" : "tip"} ${money(r.tip_cents)})` : ""} · {r.guest}
                  {r.ticket ? ` · ${r.ticket}` : ""}
                  {r.confirmed_by && CONFIRMER[r.confirmed_by] ? ` · Confirmed by ${CONFIRMER[r.confirmed_by]}` : ""}
                  {r.refunded_cents > 0 && r.refunded_cents < r.amount_cents && r.status !== "refunded" ? ` · ${money(r.refunded_cents)} refunded` : ""}
                  {r.guest_verify
                    ? r.guest_verify.verified_at
                      ? SIGN.ownerSigned(when(r.guest_verify.verified_at), r.guest_verify.phone ?? null)
                      : r.guest_verify.closed && r.guest_verify.cash
                      ? " · Cash not collected"
                      : SIGN.ownerNotSigned
                    : ""}
                </p>
                {r.guest_verify?.check_phone ? (
                  <p className="w-full text-sm font-semibold text-amber-700" data-check-phone>
                    {SIGN.ownerCheckPhone}
                  </p>
                ) : null}
                <p className="text-muted-foreground shrink-0 tabular-nums">{when(r.created_at)}</p>
                <RefundAction
                  placeId={placeId}
                  row={r}
                  onDone={(err) => {
                    if (err) return setError(err);
                    void load(false);
                  }}
                />
                {bill && bill.first === r.id && rest !== 0 ? (
                  <p className={`${NOTE} w-full tabular-nums`} data-bill-line>
                    Bill {money(bill.bill)} · on Mesita {money(bill.onMesita)} · rest at the table {money(rest)}
                  </p>
                ) : null}
                {cut ? (
                  <p className={`${NOTE} w-full`} data-cashback-cut>
                    {(r.cashback_cents ?? 0) > 0
                      ? `Cashback cut to ${money(r.cashback_cents ?? 0)} (of ${money(fullBack)}): the daily limit for cash bills was reached.`
                      : `No cashback: the daily limit for cash bills was reached.`}
                  </p>
                ) : null}
              </li>
              );
            })}
          </ul>
        )}
        {money_.next ? (
          <button type="button" className="text-muted-foreground hover:text-foreground border-t px-5 py-3 text-left text-sm sm:px-6" disabled={busy} onClick={() => void load(true)}>
            {busy ? "Loading…" : "Older"}
          </button>
        ) : null}
      </Card>
      {error ? <p className={`${ERROR_BOX_CLASS} lg:col-span-2`}>{error}</p> : null}
    </div>
  );
}
