// The payment checklist (MESITA-3707/3708/3709): one guest payment is one
// list of events, the same on the guest's phone and on the waiter's. Amount ·
// Tip · one line per way it was paid · Waiter verified. Both apps render
// these steps; neither decides them on its own.
//
// A plain module (no React): web-consumer and web-visit import it from
// @mesita/place-profile/lib/pay-checklist.

export type ChecklistState = "done" | "waiting" | "failed";

export type ChecklistStep = {
  key: "amount" | "tip" | "credit" | "card" | "cash" | "verified";
  label: string;
  cents: number | null;
  state: ChecklistState;
  /** The line under the label, in the app's words; null for none. */
  note: string | null;
};

export type ChecklistInput = {
  billCents: number;
  creditCents: number;
  cardBillCents: number;
  cardTipCents: number;
  cashBillCents: number;
  cashTipCents: number;
  /** A card part is still going through (opening/open at Stripe). */
  cardPending: boolean;
  /** The tab is paid (every in-app part settled, and any cash verified). */
  paid: boolean;
  /** When the waiter verified; null until then. */
  verifiedAt: string | null;
  /** The window closed without a Verify. */
  closed: boolean;
  /** Whose screen: the guest gives the cash, the waiter collects it. */
  side: "guest" | "waiter";
};

export function payChecklist(i: ChecklistInput): ChecklistStep[] {
  const tip = i.cardTipCents + i.cashTipCents;
  const cash = i.cashBillCents + i.cashTipCents;
  const card = i.cardBillCents + i.cardTipCents;
  const steps: ChecklistStep[] = [
    { key: "amount", label: "Amount", cents: i.billCents, state: "done", note: null },
    { key: "tip", label: tip > 0 ? "Tip" : "No tip", cents: tip > 0 ? tip : null, state: "done", note: null },
  ];
  if (i.creditCents > 0) {
    // With a card the credit rides the card and is spent when it goes
    // through; with cash only, it is held until the waiter verifies.
    const held = card === 0 && cash > 0 && !i.verifiedAt && !i.paid;
    const riding = card > 0 && i.cardPending;
    steps.push({
      key: "credit",
      label: "Credit",
      cents: i.creditCents,
      state: held || riding ? "waiting" : "done",
      note: held ? "Held until the waiter verifies" : riding ? "With the card" : null,
    });
  }
  if (card > 0) {
    steps.push({
      key: "card",
      label: "Card",
      cents: card,
      state: i.cardPending ? "waiting" : "done",
      note: i.cardPending ? "Going through" : null,
    });
  }
  if (cash > 0) {
    const collected = i.verifiedAt !== null || (i.paid && !i.closed);
    steps.push({
      key: "cash",
      label: "Cash",
      cents: cash,
      state: collected ? "done" : i.closed ? "failed" : "waiting",
      note: collected
        ? null
        : i.closed
        ? "Not verified · no cashback"
        : i.side === "guest"
        ? "Give it to the waiter"
        : "Collect it",
    });
  }
  steps.push({
    key: "verified",
    label: "Waiter verified",
    cents: null,
    state: i.verifiedAt ? "done" : i.closed ? "failed" : "waiting",
    note: null,
  });
  return steps;
}

/** What the waiter's button says: the action, never the total. */
export function verifyLabel(i: Pick<ChecklistInput, "cashBillCents" | "cashTipCents">, money: (cents: number) => string): string {
  const cash = i.cashBillCents + i.cashTipCents;
  return cash > 0 ? `Verify · collect ${money(cash)}` : "Verify · paid in the app";
}
