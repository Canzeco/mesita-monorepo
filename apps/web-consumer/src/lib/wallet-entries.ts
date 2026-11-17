// A Loyalty Card's rows (MESITA-3750). The server writes a voucher (or prepay)
// and its bonus as two entries; since MESITA-4257 (Pato: "remember the
// transaction when buying a voucher, like credits received, and the bonus
// lands after so it might be pending") they read as two rows too: Credits
// received, then Bonus. Each keeps its own pending flag and countdown, so a
// bonus that lands later waits on its own. Nothing is summed here: every
// amount is the server's.
//
//   voucher + bonus (same purchase_id)   ─► two rows, Bonus right above its
//                                            purchase in History (it lands
//                                            after), right under it in Pending
//   spend + extra (same at)              ─► two rows
//   pending purchase with a reversal on its id ─► both rows refunded: History
//
// MESITA-3750 folded the bonus into one "includes $X bonus" row until then.

import type { WalletEntry } from "@/lib/api/wallet";

export type EntryGroup = WalletEntry & {
  /** A purchase refunded before it turned Available: no countdown. */
  refunded?: boolean;
};

const BASE = new Set(["voucher", "prepay"]);
const PURCHASE = new Set(["voucher", "prepay", "bonus"]);

/** One row per entry, in the server's order (newest first), except that a
 *  bonus moves to sit right above its purchase: the read sorts by `at` only,
 *  so a bonus may come anywhere around its voucher. */
export function groupEntries(entries: WalletEntry[]): EntryGroup[] {
  const bases = new Set(entries.filter((e) => BASE.has(e.kind) && e.purchase_id).map((e) => e.purchase_id));
  const bonusesOf = new Map<string, WalletEntry[]>();
  for (const e of entries) {
    if (e.kind === "bonus" && e.purchase_id && bases.has(e.purchase_id)) {
      bonusesOf.set(e.purchase_id, [...(bonusesOf.get(e.purchase_id) ?? []), e]);
    }
  }
  const ordered: WalletEntry[] = [];
  const placed = new Set<string>();
  for (const e of entries) {
    if (e.kind === "bonus" && e.purchase_id && bonusesOf.has(e.purchase_id)) continue;
    if (BASE.has(e.kind) && e.purchase_id && bonusesOf.has(e.purchase_id) && !placed.has(e.purchase_id)) {
      ordered.push(...bonusesOf.get(e.purchase_id)!);
      placed.add(e.purchase_id);
    }
    ordered.push(e);
  }
  const reversed = new Set(entries.filter((e) => e.kind === "reversal" && e.purchase_id).map((e) => e.purchase_id));
  return ordered.map((e): EntryGroup => {
    const g: EntryGroup = { ...e };
    if (e.pending && PURCHASE.has(e.kind) && e.purchase_id && reversed.has(e.purchase_id)) g.refunded = true;
    return g;
  });
}

/** Pending Vouchers (soonest to land first, no time last) and History
 *  (newest first). A refunded purchase never reads as money on its way. */
export function splitEntries(entries: WalletEntry[]): { pending: EntryGroup[]; history: EntryGroup[] } {
  const groups = groupEntries(entries);
  const at = (g: EntryGroup) => (g.available_at ? Date.parse(g.available_at) : Infinity);
  // Soonest first; on a tie a purchase before its bonus (the bonus lands after).
  const bonusLast = (g: EntryGroup) => (g.kind === "bonus" ? 1 : 0);
  const pending = groups
    .filter((g) => g.pending && !g.refunded)
    .sort((a, b) => at(a) - at(b) || bonusLast(a) - bonusLast(b));
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
