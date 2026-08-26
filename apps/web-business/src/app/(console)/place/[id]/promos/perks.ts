// Partner sell table — Listed vs Partner. Rank is never a row.

export type PerkCell = "yes" | "no";

export type PartnerPerk = {
  id: string;
  label: string;
  listed: PerkCell;
  partner: PerkCell;
};

export const PARTNER_PERKS: readonly PartnerPerk[] = [
  { id: "listed", label: "Listed on Mesita", listed: "yes", partner: "yes" },
  {
    id: "discounts",
    label: "Guest discounts you fund",
    listed: "no",
    partner: "yes",
  },
  {
    id: "badge",
    label: "Mesita Partner badge + red pin",
    listed: "no",
    partner: "yes",
  },
  {
    id: "visibility",
    label: "Visibility from what you give",
    listed: "no",
    partner: "yes",
  },
  {
    id: "reservationist",
    label: "Reservationist",
    listed: "no",
    partner: "yes",
  },
  {
    id: "performance",
    label: "Performance record",
    listed: "no",
    partner: "yes",
  },
  {
    id: "switch",
    label: "Switch strategies anytime",
    listed: "no",
    partner: "yes",
  },
];
