// SAVED CARDS ON THE PAY SCREEN (MESITA-3758). The guest's saved cards are
// read once when a place takes cards. These are the pure rules around that
// read, React-free so they are tested on their own:
//
//   cardsFailure     what a failed read is: "signed_out" only for a 401 (the
//                    session is gone; Retry would loop), "failed" for no
//                    response or a server error (Retry). Never "empty": a
//                    failed read must not tell a guest with cards to add one.
//   acceptCardsAnswer  an answer from an earlier attempt is dropped.
//   pickCard         the card the guest picked if it is still in the list,
//                    else the first saved card, else none.
//   methodsWaitOnCards  Next waits on Methods while the cards are unknown at
//                    a place that takes them and the guest has picked no
//                    method: the default would otherwise change under them.
//   fixedMethod      the method the guest left Methods with stays, so a late
//                    card list never turns a cash payment into a card charge.

import type { SavedCard } from "@/lib/api/cards";
import type { PayWith } from "@/lib/api/tab";

export type CardsLoad =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "signed_out" }
  | { state: "loaded"; cards: SavedCard[] };

/** A failed read: only a 401 is a dead session; everything else is Retry. */
export function cardsFailure(err: unknown): CardsLoad {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 401 ? { state: "signed_out" } : { state: "failed" };
}

/** Whether an answer belongs to the latest attempt (a slow first answer
 *  landing after Retry is dropped). */
export function acceptCardsAnswer(answerAttempt: number, latestAttempt: number): boolean {
  return answerAttempt === latestAttempt;
}

/** The list once it is known; null while loading, failed or signed out. */
export function loadedCards(load: CardsLoad): SavedCard[] | null {
  return load.state === "loaded" ? load.cards : null;
}

/** The remembered card if it is still saved, else the first, else none. */
export function pickCard(cards: SavedCard[] | null, remembered: string | null): string | null {
  if (!cards) return null;
  if (remembered && cards.some((c) => c.id === remembered)) return remembered;
  return cards[0]?.id ?? null;
}

/** Next waits on Methods: cards unknown, the place takes them, credit does
 *  not cover the bill and the guest has picked nothing. */
export function methodsWaitOnCards(a: {
  cardOk: boolean;
  load: CardsLoad;
  method: PayWith | null;
  creditCovers: boolean;
}): boolean {
  return a.cardOk && !a.creditCovers && a.method === null && a.load.state !== "loaded";
}

/** The method on leaving Methods: the guest's pick, else the one shown. */
export function fixedMethod(method: PayWith | null, shown: PayWith | null): PayWith | null {
  return method ?? shown;
}
