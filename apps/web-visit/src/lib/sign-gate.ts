// When the waiter's Sign button may send, and what it sends (MESITA-3799,
// MESITA-4485). A click signs. A half-typed code does not. When cash is owed,
// Yes means exactly what is owed was received; No (or no answer) never signs.
// A card still going through never signs.

export type CashAnswer = "yes" | "no" | null;

/** The waiter code as typed, spaces dropped; null unless it is 6 digits. */
export function waiterCode(typed: string): string | null {
  const code = typed.replace(/\s/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** What Sign sends, or null while Sign stays disabled. */
export function signRequest(i: {
  owedCents: number;
  cashAnswer: CashAnswer;
  typedCode: string;
  cardPending: boolean;
}): { place_code: string | null; cash_received_cents: number | null } | null {
  const typed = i.typedCode.trim();
  const code = waiterCode(i.typedCode);
  if ((typed !== "" && !code) || i.cardPending) return null;
  if (i.owedCents > 0 && i.cashAnswer !== "yes") return null;
  return { place_code: code, cash_received_cents: i.owedCents > 0 ? i.owedCents : null };
}
