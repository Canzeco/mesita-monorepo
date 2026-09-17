// WHAT TOOK THE MONEY, said once.
//
// The stored key is `mesita_pay` and the noun an operator reads is Payments —
// the same split `lib/product-keys.ts` makes for the product itself. Cash and
// Card are two words because they are two ROWS: the database stored both as
// `at_place` until MESITA-1910, which is why one chip could never say which.
//
// IT IS A LIB, NOT A CONSTANT INSIDE VISITSVIEW, because the Payments log
// (MESITA-1939) prints the same three words over rows that came out of a
// visit. Two maps for one vocabulary is how "Payments" and "Mesita Pay" end up
// on the same screen.
import type { MockTender } from "@/mock/types";

export const TENDER_LABEL: Record<MockTender["method"], string> = {
  cash: "Cash",
  card: "Card",
  mesita_pay: "Payments",
};
