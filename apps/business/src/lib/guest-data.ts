// Tier catalog shared between Promos (manager-side) and any UI that
// renders a tier badge. Pricing and copy are the marketing source of
// truth: change them here, every surface follows.
//
// Originally a much larger fixture file mirroring the guest app — the
// other exports moved out as their consumers either disappeared or
// switched to Edge Function data. Keep this lean.

export type Tier = "bronze" | "silver" | "gold" | "diamond";

export type TierMeta = {
  id: Tier;
  label: string;
  req: string;
  /** Monthly subscription price in MXN. 0 for Bronze (the default
   *  tier) — granted upfront, no spend accumulation required. */
  priceMxn: number;
  cashback: string;
  perk: string;
};

export const TIERS: TierMeta[] = [
  // The tier IS the brand — rendered as "Mesita Bronze" / "Mesita
  // Silver" / "Mesita Gold" / "Mesita Diamond" in marketing and
  // subscribe surfaces. The compact `label` here is used inside tight
  // UI (tier badges, table rows) where the "Mesita" prefix would just
  // add noise.
  {
    id: "bronze",
    label: "Bronze",
    req: "Default · no IG or under 1K followers",
    priceMxn: 0,
    cashback: "Base cashback",
    perk: "Welcome to the club",
  },
  {
    id: "silver",
    label: "Silver",
    req: "1K+ followers · or $200 MXN / mo",
    priceMxn: 200,
    cashback: "More cashback",
    perk: "Insider perks",
  },
  {
    id: "gold",
    label: "Gold",
    req: "5K+ followers · or $500 MXN / mo",
    priceMxn: 500,
    cashback: "Even more cashback",
    perk: "Priority access",
  },
  {
    id: "diamond",
    label: "Diamond",
    req: "20K+ followers · or $1,000 MXN / mo · or appeal",
    priceMxn: 1000,
    cashback: "Most cashback",
    perk: "VIP · private events",
  },
];
