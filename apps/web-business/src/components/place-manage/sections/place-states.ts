// Place States (Pato, 2026-11-09, MESITA-3588; the list is Main §10,
// MESITA-3586): what the BUSINESS decides, beside Profile States (what comes
// from Google or Mesita). Read-only. Since MESITA-3589 every state has data.
//
// The calculation lives in @mesita/place-profile (place-states.ts) since
// MESITA-3595, so the admin console's tables read the same one and the two
// apps can never disagree.

export {
  moneyPlaceStates,
  stripeState,
  type MoneyPlaceStates,
  type PlaceStatesInput,
  type PlaceStateValue,
  type StripeState,
} from "@mesita/place-profile/lib/place-states";
