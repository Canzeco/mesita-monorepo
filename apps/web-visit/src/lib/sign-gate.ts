// When the waiter's Confirm button may send, and what it sends (MESITA-3799,
// MESITA-4521). Money and auth: the waiter types the 4-digit waiter code for
// every Confirm (Pato, 2026-11-21: "To avoid trolls, use mesita code to accept
// payments"; one click confirmed from MESITA-4485 until then). When cash is
// owed, Yes means exactly what is owed was received; No (or no answer) never
// confirms. A card still going through never confirms.

export type CashAnswer = "yes" | "no" | null;

/** The waiter code as typed, spaces dropped; null unless it is 6 digits. */
export function waiterCode(typed: string): string | null {
  const code = typed.replace(/\s/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** What Confirm sends, or null while Confirm stays disabled. */
export function signRequest(i: {
  owedCents: number;
  cashAnswer: CashAnswer;
  typedCode: string;
  cardPending: boolean;
}): { place_code: string; cash_received_cents: number | null } | null {
  const code = waiterCode(i.typedCode);
  if (!code || i.cardPending) return null;
  if (i.owedCents > 0 && i.cashAnswer !== "yes") return null;
  return { place_code: code, cash_received_cents: i.owedCents > 0 ? i.owedCents : null };
}
