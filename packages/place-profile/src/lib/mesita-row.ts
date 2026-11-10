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

/** A rate in bps as the pill says it: 700 → "7%" (MESITA-3589: each place
 *  sets its own, whole percents 1..20). */
export function ratePct(bps: number): string {
  return `${Math.round(bps) / 100}%`;
}

/** The pill while the first money read is out. */
export const MESITA_ROW_LOADING = "…";

/** `note`: what the Off sheet says instead of its standard line (MESITA-3604). */
export type MesitaTileState = { works: boolean; pill: string; note?: string };
export type MesitaRowState = {
  reserve: MesitaTileState;
  prepay: MesitaTileState;
  wallet: MesitaTileState;
  pay: MesitaTileState;
};

/** The Prepay Off sheet while Mesita pauses voucher sales. */
export const PREPAY_PAUSED = "Prepay is paused for a moment. Try again soon.";

/** The Wallet Off sheet where the place has House Credits Off (MESITA-3610). */
export const WALLET_NO_HOUSE_CREDITS = "This place doesn't use House Credits.";

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

/** `inWallet`: this place's House Card is in the guest's Wallet (MESITA-3608). */
export function mesitaRowState(place: Pick<PlaceDetail, "reservations_enabled" | "money">, loading = false, inWallet = false): MesitaRowState {
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
  // Mesita's own "Pause voucher sales" is not the place's choice (MESITA-3604).
  const paused = Object.values(money.unavailable ?? {}).includes("paused");
  const prepay: MesitaTileState = (money.sell ?? []).length > 0
    ? { works: true, pill: bonus > 0 ? `${bonus}% Bonus` : "On" }
    : paused
      ? { ...OFF, note: PREPAY_PAUSED }
      : OFF;
  const available = Math.max(money.balance?.available_cents ?? 0, 0);
  // Wallet is green once the House Card is in the guest's Wallet, $0MX
  // included; Off means the card is not there (Pato, MESITA-3608).
  // House Credits Off: no card can be added (MESITA-3610); credit a guest
  // already holds still shows.
  const houseCredits = money.house_credits !== false;
  const wallet: MesitaTileState = available > 0 || (inWallet && houseCredits)
    ? { works: true, pill: moneyLabel(available, money.currency ?? "mxn") }
    : houseCredits ? OFF : { ...OFF, note: WALLET_NO_HOUSE_CREDITS };
  // The place's own rates (MESITA-3589); an older read without them says On.
  const cardBps = money.card_cashback_bps ?? 0;
  const cashBps = money.cash_cashback_bps ?? 0;
  const pay: MesitaTileState = money.cashback && cardBps > 0
    ? { works: true, pill: `${ratePct(cardBps)} Back` }
    : money.outside_cashback && cashBps > 0
      ? { works: true, pill: `${ratePct(cashBps)} Back` }
      : money.charges_enabled || money.cash === true || available > 0
        ? { works: true, pill: "On" }
        : OFF;
  return { reserve, prepay, wallet, pay };
}
