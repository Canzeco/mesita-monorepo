/** The legal entity types a Mesita connected account may be created as —
 *  Stripe's `business_type`. Mirrors MESITA_CONNECT_ENTITY_TYPES in supabase
 *  `_shared/stripe-connect.ts`; the EF validates independently, so this list
 *  is a UI convenience, not the gate.
 *
 *  Asked BEFORE onboarding opens, alongside country, because it is the answer
 *  that decides what Stripe collects next — everything after it (RFC, CURP,
 *  address, bank) belongs to Stripe's hosted flow, not to this console.
 *
 *  Lives outside actions.ts for the same reason as CONNECT_COUNTRIES: that
 *  file is "use server" and may only export async functions.
 */
export const CONNECT_ENTITY_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "company", label: "Company" },
] as const;

export type MesitaConnectEntityType =
  (typeof CONNECT_ENTITY_TYPES)[number]["value"];

export function isConnectEntityType(
  value: string,
): value is MesitaConnectEntityType {
  return CONNECT_ENTITY_TYPES.some((t) => t.value === value);
}
