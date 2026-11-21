// The Offers page's saved cards (MESITA-4065). The package draws them and
// never fetches: the host reads the guest's cards and passes them in. One
// rule picks the card a Pay charges by default, in one place.

/** A saved card as the Offers page draws it. `label` is the host's brand
 *  name ("Visa"). */
export type PayCard = { id: string; label: string; last4: string; exp_month: number; exp_year: number };

/** The host's read of the guest's cards. Absent on the actions: signed out,
 *  or a host with no cards (admin, business). */
export type PayCards =
  | { state: "loading" }
  | { state: "error" }
  | {
      state: "ready";
      cards: PayCard[];
      /** The guest chose the card as their default way to pay (MESITA-4529,
       *  web-consumer's Payment methods): Pay with the card leads, Apple Pay /
       *  Google Pay follows under "or". Absent or false keeps the wallet first. */
      cardFirst?: boolean;
    };

/** How many cards one guest may save (the server's rule: one since MESITA-4168). */
export const MAX_PAY_CARDS = 1;

export function isCardExpired(c: Pick<PayCard, "exp_month" | "exp_year">, now: Date = new Date()): boolean {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return c.exp_year < y || (c.exp_year === y && c.exp_month < m);
}

/** The card a Pay charges by default: the one the guest paid with last when
 *  it is still saved and not expired, else the first card that is not
 *  expired, else none. */
export function pickPayCard(cards: readonly PayCard[], remembered: string | null, now: Date = new Date()): string | null {
  const usable = cards.filter((c) => !isCardExpired(c, now));
  if (remembered && usable.some((c) => c.id === remembered)) return remembered;
  return usable[0]?.id ?? null;
}

/** "Expires 08/29" */
export function cardExpiry(c: Pick<PayCard, "exp_month" | "exp_year">): string {
  return `${String(c.exp_month).padStart(2, "0")}/${String(c.exp_year % 100).padStart(2, "0")}`;
}
