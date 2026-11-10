// Every state of Main §10 (MESITA-3586) for one admin table row
// (MESITA-3595, Pato: "List all the states discussed in admin too"):
//
//   Profile  Created · Pulsing · Enriching · Enriched · Premier · Disabled
//   Place    Owned · Plan · Billing · Stripe · Reservations · House Credits
//            Contract · House Credits · Cash Payments · Cash Payments
//            Cashback · Mesita Payments · Mesita Payments Cashback · Mesita
//            Prepayments
//
// The Place chips come from @mesita/place-profile's place-states.ts, the
// calculation Business › Admin's Place States card reads, over the raw facts
// admin-web-search-places ships per row. A group whose read failed reads "?",
// never a false no.

import {
  moneyPlaceStates,
  ownedChip,
  PLACE_STATE_ROWS,
  type OwnedState,
  planName,
  type PlaceStateKey,
  type PlaceStatesAccount,
  type PlaceStatesSettings,
  type PlaceStateValue,
} from "@mesita/place-profile/lib/place-states";
import type { PlaceHit } from "./actions";
import { GENERAL_STATE_FACTS, premierTierChip } from "@/lib/state-vocabulary";
import { factOn, type Row } from "./mesita-search-facts";

/** What admin-web-search-places ships as `place_states` (see
 *  _shared/place-states-read.ts). */
export type PlaceStatesFacts = {
  owned: OwnedState | null;
  plan_rank: number | null;
  payments: {
    account: PlaceStatesAccount;
    settings: PlaceStatesSettings;
    contract: { signed: boolean };
    code_set: boolean;
    fee_hold: boolean;
    fee_overdue: boolean;
  } | null;
};

const UNKNOWN: PlaceStateValue = { on: false, chip: "?" };

/** The twelve Place States chips for one place, in Business's words. */
export function placeStateChips(hit: PlaceHit): Record<PlaceStateKey, PlaceStateValue> {
  const f = hit.place_states ?? null;
  const p = f?.payments ?? null;
  const m = moneyPlaceStates({
    account: p?.account ?? null,
    settings: p?.settings ?? null,
    contract: p?.contract ?? null,
    codeSet: p?.code_set === true,
    feeHold: p?.fee_hold === true,
    feeOverdue: p?.fee_overdue === true,
    reservations: typeof hit.reservations_enabled === "boolean" ? hit.reservations_enabled : null,
  });
  const money = (v: PlaceStateValue) => (p ? v : UNKNOWN);
  const rank = f?.plan_rank;
  return {
    owned: f?.owned == null ? UNKNOWN : ownedChip(f.owned),
    plan: rank == null ? UNKNOWN : { on: rank > 0, chip: planName(rank) },
    billing: money(m.billing),
    stripe: money(m.stripe),
    reservations: m.reservations,
    houseCreditsContract: money(m.houseCreditsContract),
    houseCredits: money(m.houseCredits),
    cashPayments: money(m.cashPayments),
    cashPaymentsCashback: money(m.cashPaymentsCashback),
    mesitaPayments: money(m.mesitaPayments),
    mesitaPaymentsCashback: money(m.mesitaPaymentsCashback),
    mesitaPrepayments: money(m.mesitaPrepayments),
  };
}

/** One filterable state: its group, label and the value a row reads. */
export type StateFilterColumn = {
  key: string;
  group: "Profile" | "Place";
  label: string;
  valueOf: (hit: PlaceHit) => string;
};

const yesNo = (v: boolean | "unknown") => (v === "unknown" ? "?" : v ? "yes" : "no");

const PROFILE_COLUMNS: StateFilterColumn[] = [
  ...GENERAL_STATE_FACTS.filter((f) => f.key !== "disabled").map((f) => ({
    key: f.key,
    group: "Profile" as const,
    label: f.label,
    valueOf: (hit: PlaceHit) => yesNo(factOn(hit, f.key)),
  })),
  { key: "premier", group: "Profile", label: "Premier", valueOf: (hit) => premierTierChip(hit.boost_tier) },
  { key: "disabled", group: "Profile", label: "Disabled", valueOf: (hit) => yesNo(factOn(hit, "disabled")) },
];

const PLACE_COLUMNS: StateFilterColumn[] = PLACE_STATE_ROWS.map((r) => ({
  key: r.key,
  group: "Place" as const,
  label: r.label,
  valueOf: (hit: PlaceHit) => placeStateChips(hit)[r.key].chip,
}));

/** Every state of Main §10, Profile first, in the order the cards print. */
export const STATE_FILTER_COLUMNS: readonly StateFilterColumn[] = [...PROFILE_COLUMNS, ...PLACE_COLUMNS];

/** A pasted ID with no place is its own value, so counts add up to the run. */
export const NOT_ON_MESITA = "Not on Mesita";

export function stateValueOf(row: Row, column: StateFilterColumn): string {
  return row.hit ? column.valueOf(row.hit) : NOT_ON_MESITA;
}
