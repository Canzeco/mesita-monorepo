// What prepaying would have saved on a paid bill (MESITA-4878, Pato: "how much
// you would have saved"). Pure. Only the part of the bill paid outside counts:
// credit never pays a tip, and what credits already paid was prepaid. Prepaid
// credit earns no cashback, so what that part earned comes off the saving.

export type PrepayOption = { voucher: string; price_cents: number; credit_cents: number };
export type PrepayTip = PrepayOption & { saving_cents: number };

/** The smallest voucher whose credit covers the part paid outside, else the
 *  biggest (its credit then covers a part). Null when it saves nothing. */
export function prepayTip(outsideBillCents: number, cashbackCents: number, options: PrepayOption[]): PrepayTip | null {
  if (outsideBillCents <= 0) return null;
  const sorted = options.filter((o) => o.price_cents > 0 && o.credit_cents > o.price_cents).sort((a, b) => a.credit_cents - b.credit_cents);
  const pick = sorted.find((o) => o.credit_cents >= outsideBillCents) ?? sorted.at(-1);
  if (!pick) return null;
  const covered = Math.min(outsideBillCents, pick.credit_cents);
  const cost = Math.ceil((covered * pick.price_cents) / pick.credit_cents);
  const lost = Math.ceil((Math.max(cashbackCents, 0) * covered) / outsideBillCents);
  const saving = covered - cost - lost;
  return saving > 0 ? { ...pick, saving_cents: saving } : null;
}
