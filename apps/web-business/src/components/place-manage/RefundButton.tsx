"use client";

// The owner gives a guest's money back (MESITA-3381; moved out of MoneyPanel
// by MESITA-4538 so the plain Payments and Vouchers lists keep it). A quiet
// grey button: Refund opens the amount (all that is left), Confirm says the
// amount and the guest. The card part goes back to the card first, then the
// credit part as credit; the server decides and answers the new status.

import { useState } from "react";
import { refundPlaceMoneyRow } from "@/lib/business-api";
import { money } from "@/lib/monitor";

/** Pesos typed by the owner as cents, or null when it is not a positive amount. */
function centsOf(text: string): number | null {
  const n = Number(text.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export function RefundButton({
  placeId,
  kind,
  id,
  leftCents,
  guest,
  onDone,
}: {
  placeId: string;
  kind: "voucher" | "payment";
  id: string;
  leftCents: number;
  guest: string | null;
  onDone: (status: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState((leftCents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (leftCents <= 0) return null;
  if (!open) {
    return (
      <button
        type="button"
        className="bg-muted text-foreground hover:bg-muted/70 h-8 rounded-full px-3 text-xs font-semibold"
        onClick={() => setOpen(true)}
      >
        Refund
      </button>
    );
  }
  const cents = centsOf(amount);
  const valid = cents !== null && cents <= leftCents;
  return (
    <form
      className="flex flex-wrap items-center justify-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || busy) return;
        setBusy(true);
        setError(null);
        const r = await refundPlaceMoneyRow(placeId, { kind, id }, cents === leftCents ? null : cents);
        setBusy(false);
        if (!r.ok) return setError(r.error);
        setOpen(false);
        onDone(r.data.status);
      }}
    >
      <input
        aria-label="Amount to refund"
        inputMode="decimal"
        placeholder="0.00"
        className="border-border bg-background h-8 w-24 rounded-lg border px-2 text-sm tabular-nums"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button type="submit" className="bg-muted text-foreground h-8 rounded-full px-3 text-xs font-semibold disabled:opacity-50" disabled={!valid || busy}>
        {busy ? "Refunding…" : `Refund ${valid ? money(cents) : ""}${guest ? ` to ${guest}` : ""}`}
      </button>
      <button type="button" className="text-muted-foreground text-xs" disabled={busy} onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error ? <p className="text-destructive w-full text-right text-xs">{error}</p> : null}
    </form>
  );
}
