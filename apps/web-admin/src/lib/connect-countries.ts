/** The countries a Mesita connected account may be created in. Mirrors
 *  MESITA_CONNECT_COUNTRIES in supabase `_shared/stripe-connect.ts`; the EF
 *  validates independently, so this list is a UI convenience, not the gate.
 *
 *  Lives outside actions.ts because that file is "use server" — such a file
 *  may only export async functions, and a const array breaks the build at
 *  page-data collection.
 */
export const CONNECT_COUNTRIES = [
  { code: "MX", label: "Mexico" },
  { code: "US", label: "United States" },
] as const;

export type MesitaConnectCountry = (typeof CONNECT_COUNTRIES)[number]["code"];
