// Mesita Stripe subscription catalog — product/price metadata only.
// Provisioning lives in stripe-billing.ts (resolvePlanPrice / ensureWholeCatalog).
//
//   consumer_premium             — Mesita Premium · $50 MXN/mo
//                                  · consumer_plans.premium
//   business_partner_membership  — Mesita Membership · $1,000 MXN/yr
//                                  · membership_plans.membership
//   business_verified            — Mesita Verified · $1,000 MXN/yr
//                                  · place_plans.pro
//
// Promos v4 (MESITA-541) retired business Pro/Ultra monthly SKUs. `ultra`
// remains a legacy plan key for existing places but is not self-provisioned.
//
// WHAT IS SOLD is `business_partner_membership`: one yearly subscription that
// makes a PLACE a Partner. MESITA-1877 sold it per organization, one
// subscription covering every place the org held; MESITA-1892 removed that
// layer, so the Membership is bought per place and the price buys exactly the
// place that paid. `business_verified` is the older per-place SKU
// (business-web-change-subscription), kept because places already bill on it;
// MESITA-1868 retires that door.
//
// EVERY ENTRY OWNS ITS LOOKUP ROW. resolvePlanPrice caches the provisioned
// price id back onto `table`.`rowKey`, so two entries sharing one row would
// each overwrite the other's id, fail their own verification on the next read,
// and mint a fresh Stripe price on every checkout. That is why Membership gets
// `membership_plans.membership` rather than borrowing `place_plans.pro`, even
// though the two now carry the same MX$1,000 for the same one place. Two SKUs
// on one row is a self-inflicted outage; two rows is a rename away from being
// one SKU, whenever MESITA-1868 retires Verified.

export type PlanCatalogEntry = {
  // Stable Mesita-wide id, stored in Stripe metadata.mesita_plan.
  id: "consumer_premium" | "business_partner_membership" | "business_verified";
  // Lookup row backing this price.
  table: "consumer_plans" | "membership_plans" | "place_plans";
  rowKey: string;
  // Stripe price lookup_key — the idempotency anchor.
  lookupKey: string;
  productName: string;
  productDescription: string;
  // Recurring interval matching the plan catalogs' price semantics.
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
    lookupKey: "business_verified_yearly",
    productName: "Mesita Verified",
    productDescription:
      "Mesita business Verified partnership — annual subscription.",
    interval: "year",
  },
];
