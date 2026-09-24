// Mesita Stripe subscription catalog — product/price metadata only.
// Provisioning lives in stripe-billing.ts (resolvePlanPrice / ensureWholeCatalog).
//
//   consumer_premium             — Mesita Premium · $50 MXN/mo
//   business_partner_membership  — Mesita Membership · yearly (legacy door)
//   business_verified            — Mesita Pro · monthly · place_plans.pro
//   business_ultra               — Mesita Ultra · monthly · place_plans.ultra
//
// EVERY ENTRY OWNS ITS LOOKUP ROW. resolvePlanPrice caches the provisioned
// price id back onto `table`.`rowKey`, so two entries sharing one row would
// each overwrite the other's id.

export type PlanCatalogEntry = {
  id:
    | "consumer_premium"
    | "business_partner_membership"
    | "business_verified"
    | "business_ultra";
  table: "consumer_plans" | "membership_plans" | "place_plans";
  rowKey: string;
  lookupKey: string;
  productName: string;
  productDescription: string;
  interval: "month" | "year";
};

export const STRIPE_CATALOG: PlanCatalogEntry[] = [
  {
    id: "consumer_premium",
    table: "consumer_plans",
    rowKey: "premium",
    lookupKey: "consumer_premium_monthly",
    productName: "Mesita Premium",
    productDescription:
      "Mesita consumer Premium plan — monthly subscription.",
    interval: "month",
  },
  {
    id: "business_partner_membership",
    table: "membership_plans",
    rowKey: "membership",
    lookupKey: "business_partner_membership_yearly",
    productName: "Mesita Membership",
    productDescription:
      "Mesita Membership — the yearly partnership for a place.",
    interval: "year",
  },
  {
    id: "business_verified",
    table: "place_plans",
    rowKey: "pro",
    lookupKey: "business_pro_monthly",
    productName: "Mesita Pro",
    productDescription:
      "Mesita Pro — monthly subscription for a place.",
    interval: "month",
  },
  {
    id: "business_ultra",
    table: "place_plans",
    rowKey: "ultra",
    lookupKey: "business_ultra_monthly",
    productName: "Mesita Ultra",
    productDescription:
      "Mesita Ultra — monthly subscription for a place.",
    interval: "month",
  },
];
