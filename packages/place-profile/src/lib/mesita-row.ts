// What the place screen's pinned row says (MESITA-3581, Pato: "black if it
// doesn't work, green if it does"; option B: "all top buttons are black, the
// buttons that work at the bottom are green, and the ones that don't are
// gray"). Each of Reserve · Prepay · Wallet · Pay either WORKS at this place
// (green, its real number in the pill) or does not (grey, "Off"). Nothing is
// typed in here: the bonus and the balance come from the server's
// list-vouchers read (place.money), Reserve from the place's own bit.

import type { PlaceDetail, PlaceMoney } from "../place-detail";
import { moneyLabel } from "./money";
import { isReserveActionEnabled } from "./place-profile-actions";

/** Cashback on a bill paid by card with Mesita Pay. Twin of
 *  supabase/functions/_shared/money.ts CASHBACK_BPS (500 bps). */
export const CARD_CASHBACK_PCT = 5;
/** Cashback on a bill paid to the waiter, confirmed by Received. Twin of
 *  _shared/money.ts OUTSIDE_CASHBACK_BPS (200 bps, MESITA-3545). */
export const OUTSIDE_CASHBACK_PCT = 2;

/** The pill while the first money read is out. */
export const MESITA_ROW_LOADING = "…";

export type MesitaTileState = { works: boolean; pill: string };
export type MesitaRowState = {
  reserve: MesitaTileState;
  prepay: MesitaTileState;
  wallet: MesitaTileState;
  pay: MesitaTileState;
};

const OFF: MesitaTileState = { works: false, pill: "Off" };
const LOADING: MesitaTileState = { works: false, pill: MESITA_ROW_LOADING };

/** The best bonus among the vouchers a guest can buy here now, in whole
 *  percent of the price (the server's catalog: bonus over price). */
export function bestVoucherBonusPct(money: PlaceMoney): number {
  let best = 0;
  for (const key of money.sell ?? []) {
    const line = money.catalog?.[key];
    if (!line || line.price_cents <= 0) continue;
    best = Math.max(best, Math.round((line.bonus_cents * 100) / line.price_cents));
  }
  return best;
}

export function mesitaRowState(place: Pick<PlaceDetail, "reservations_enabled" | "money">, loading = false): MesitaRowState {
  const reserve: MesitaTileState = isReserveActionEnabled(place) ? { works: true, pill: "On" } : OFF;
  const money = place.money;
  if (!money) {
    // No read yet: a quiet "…" while it is out; none coming (admin's preview,
    // a Google-only card): nothing Mesita runs here is shown as working.
    return loading
      ? { reserve, prepay: LOADING, wallet: LOADING, pay: LOADING }
      : { reserve, prepay: OFF, wallet: OFF, pay: OFF };
  }
  const bonus = bestVoucherBonusPct(money);
  const prepay: MesitaTileState = (money.sell ?? []).length > 0 ? { works: true, pill: bonus > 0 ? `${bonus}% Bonus` : "On" } : OFF;
  const available = Math.max(money.balance?.available_cents ?? 0, 0);
  const wallet: MesitaTileState = available > 0 ? { works: true, pill: moneyLabel(available, money.currency ?? "mxn") } : OFF;
  const pay: MesitaTileState = money.cashback
    ? { works: true, pill: `${CARD_CASHBACK_PCT}% Back` }
    : money.outside_cashback
      ? { works: true, pill: `${OUTSIDE_CASHBACK_PCT}% Back` }
      : money.charges_enabled || available > 0
        ? { works: true, pill: "On" }
        : OFF;
  return { reserve, prepay, wallet, pay };
}
