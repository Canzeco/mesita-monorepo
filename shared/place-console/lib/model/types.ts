// The state vocabularies two chips are drawn from, and nothing else.
//
// ── WHAT THIS FILE USED TO BE (MESITA-1892) ───────────────────────────────
//
// It was the TARGET business model, decided 2026-09-05 and written as a
// CONTRACT for a mock layer: `Organization` (one legal person, one RFC, one
// Stripe account) with Members, Finances, Commercial, Places and Activity
// hanging off it, and the note that it "deliberately diverges from the shipped
// `places` schema — that divergence is the point of the mock era".
//
// The mock era ended and the divergence resolved the other way. The
// organization is deleted: `partnered`, `legal_name`, `rfc`, the payment
// account and the members are columns and tables on `places` now, and the
// console reads them through `lib/api/console.ts`. Fourteen of the sixteen
// exports here had no importer at all — a contract for a table nobody queries
// is a vocabulary describing a screen that no longer exists, which is the note
// `SoonStrips.ts` already carries about entries nobody renders.
//
// `organizationState()` went with them (`lib/model/format.ts`, deleted): it
// folded a Stripe lifecycle into "connected / not connected" for a headline
// no surface printed, and its only caller was its own test.
//
// What is left is what `components/console/badges.tsx` and
// `lib/api/console.ts` actually import.

/** PLACE state. A property of one address: Listed = Atlas found it and a
 *  guest can reach it · Verified = someone proved they operate it.
 *  Verification is granted per place (admin-web-set-place-verified), which is
 *  why it was never a fact about a holder above the place — and, since
 *  MESITA-1892, there is no holder to mistake it for. */
export type PlaceState = "listed" | "verified";

/** Stripe Connect account lifecycle — not a boolean. `charges_only` means
 *  money can land but not pay out: cash-in must stay blocked there.
 *
 *  `pending` USED TO MEAN TWO OPPOSITE THINGS (MESITA-1645): "you never
 *  finished" and "you finished, Stripe is checking". Same amber pill, same
 *  word, and only one of them is work the owner can do. They are split now:
 *  `unfinished` offers Resume, `in_review` deliberately does not — offering it
 *  reopened a form the owner had already completed, which is a loop, not a
 *  next step.
 *
 *  The account it describes is `place_payment_accounts`, one row per PLACE
 *  (MESITA-1892; it was `organization_payment_accounts`, shared by every place
 *  a holder held). The lifecycle is Stripe's either way. */
export type PaymentAccountState =
  | "none"
  | "unfinished"
  | "in_review"
  | "charges_only"
  | "live"
  | "restricted";
