"use client";

import { readAmount } from "@mesita/place-profile/lib/money";

// The bill and the tip the waiter types, and the place's code (MESITA-4827).
// The tip is never picked for the guest.

const TIP_PCTS = [10, 15, 20] as const;

/** A tip box: empty or 0 is no tip. */
export function readTip(text: string): number | null {
  const t = text.trim();
  return t === "" || /^0+([.,]0*)?$/.test(t) ? 0 : readAmount(t);
}

export function BillFields({ bill, tip, onBill, onTip }: { bill: string; tip: string; onBill: (t: string) => void; onTip: (t: string) => void }) {
  const billCents = readAmount(bill);
  const tipCents = readTip(tip);
  const pct = (p: number) => Math.round(((billCents ?? 0) * p) / 100);
  return (
    <>
      <label className="field">
        Bill, before tip
        <input inputMode="decimal" autoComplete="off" placeholder="0" value={bill} onChange={(e) => onBill(e.target.value)} />
      </label>
      <label className="field">
        Tip (ask the guest)
        <input inputMode="decimal" autoComplete="off" placeholder="None" value={tip} onChange={(e) => onTip(e.target.value)} />
      </label>
      <div className="tip-chips" role="group" aria-label="Tip">
        {TIP_PCTS.map((p) => (
          <button
            key={p}
            type="button"
            className="quiet"
            disabled={billCents === null}
            aria-pressed={billCents !== null && tipCents !== null && tipCents > 0 && tipCents === pct(p)}
            onClick={() => onTip(String(pct(p) / 100))}
          >
            {p}%
          </button>
        ))}
        <button type="button" className="quiet" aria-pressed={tipCents === 0} onClick={() => onTip("")}>
          None
        </button>
      </div>
      {billCents !== null && tipCents !== null && tipCents * 2 > billCents ? (
        <p className="proof-status warn" role="status">
          Tip is more than half the bill. Check it.
        </p>
      ) : null}
    </>
  );
}

export function CodeField({ code, onCode }: { code: string; onCode: (c: string) => void }) {
  return (
    <label className="field">
      6-digit code of your restaurant
      <input
        inputMode="numeric"
        autoComplete="off"
        maxLength={7}
        placeholder="000000"
        value={code}
        onChange={(e) => onCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
    </label>
  );
}
