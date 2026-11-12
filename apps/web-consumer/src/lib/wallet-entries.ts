// A House Card's rows (MESITA-3750). The server writes a voucher (or prepay)
// and its bonus as two entries in one transaction; the guest bought one
// thing, so they read as one row. This is the only sum the House Card makes,
// and it is display only: both amounts are the server's.
//
//   bonus ─┐ same purchase_id + same pending flag   ─► one row, amount = sum,
//   voucher┘ (no purchase_id: same at + available_at)   bonus_cents kept
//   spend + cashback (same at)                        ─► two rows, never merged
//   pending purchase with a reversal on its id        ─► refunded: History
//
// The at + available_at fallback exists only for the minutes between the web
// deploy and the wallet read returning purchase_id; settled rows carry a null
// available_at, so there it is effectively "same at".

import type { WalletEntry } from "@/lib/api/wallet";

export type EntryGroup = WalletEntry & {
  /** The bonus folded into this row, for its "includes $X bonus" line. */
  bonus_cents?: number;
  /** A purchase refunded before it turned Available: no countdown. */
  refunded?: boolean;
};

const BASE = new Set(["voucher", "prepay"]);

function key(e: WalletEntry): string {
  return e.purchase_id
    ? `p:${e.purchase_id}:${e.pending}`
    : `t:${e.at}:${e.available_at ?? ""}:${e.pending}`;
}

/** One row per purchase; every other entry stays its own row, in the
 *  server's order (newest first). Matching is by key, not position: the read
 *  sorts by `at` only, so a bonus may come before its voucher. */
export function groupEntries(entries: WalletEntry[]): EntryGroup[] {
  const baseAt = new Map<string, number>();
  entries.forEach((e, i) => {
    if (BASE.has(e.kind) && !baseAt.has(key(e))) baseAt.set(key(e), i);
  });
  const bonusFor = new Map<number, number>();
  const folded = new Set<number>();
  entries.forEach((e, i) => {
    if (e.kind !== "bonus") return;
    const b = baseAt.get(key(e));
    if (b === undefined) return; // a lone bonus: the data is off; it still shows
    folded.add(i);
    bonusFor.set(b, (bonusFor.get(b) ?? 0) + e.amount_cents);
  });
  const reversed = new Set(entries.filter((e) => e.kind === "reversal" && e.purchase_id).map((e) => e.purchase_id));
  return entries.flatMap((e, i): EntryGroup[] => {
    if (folded.has(i)) return [];
    const bonus = bonusFor.get(i);
    const g: EntryGroup = bonus ? { ...e, amount_cents: e.amount_cents + bonus, bonus_cents: bonus } : { ...e };
    if (e.pending && BASE.has(e.kind) && e.purchase_id && reversed.has(e.purchase_id)) g.refunded = true;
    return [g];
  });
}

/** Pending Vouchers (soonest to land first, no time last) and History
 *  (newest first). A refunded purchase never reads as money on its way. */
export function splitEntries(entries: WalletEntry[]): { pending: EntryGroup[]; history: EntryGroup[] } {
  const groups = groupEntries(entries);
  const at = (g: EntryGroup) => (g.available_at ? Date.parse(g.available_at) : Infinity);
  const pending = groups.filter((g) => g.pending && !g.refunded).sort((a, b) => at(a) - at(b));
  const history = groups.filter((g) => !g.pending || g.refunded);
  return { pending, history };
}

/** React keys that stay put across re-reads: the row's id, then its place
 *  among rows sharing it (gift rows carry no id). */
export function groupKeys(groups: EntryGroup[]): string[] {
  const seen = new Map<string, number>();
  return groups.map((g) => {
    const base = `${g.kind}-${g.purchase_id ?? g.payment_id ?? g.at}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}-${n}`;
  });
}
