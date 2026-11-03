// Where a place's Boost came from (Refill until MESITA-3175), in the words Billing and Premier
// both use (MESITA-3166, Design D9). Never a guest's name.

export type RefillOrigin = "mesita" | "guest";

export const REFILL_ORIGIN: Record<RefillOrigin, string> = {
  mesita: "Given by Mesita",
  guest: "Bought by a guest",
};

/** place_manual_premier.source → its origin. */
export const ORIGIN_OF_SOURCE: Record<string, RefillOrigin> = { admin: "mesita", purchase: "guest" };
