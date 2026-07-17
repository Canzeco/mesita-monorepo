// Mesita Stripe subscription catalog — product/price metadata only.
// Provisioning lives in stripe-billing.ts (resolvePlanPrice / ensureWholeCatalog).
//
//   consumer_premium   — Mesita Premium · $100 MXN/mo · classes.premium
//   business_verified  — Mesita Verified · $1,000 MXN/yr · business_plans.pro
//
// Promos v4 (MESITA-541) retired business Pro/Ultra monthly SKUs. Verified is
// the only business product sold; `ultra` remains a legacy plan key for
// existing places but is not self-provisioned here.

export type PlanCatalogEntry = {
  // Stable Mesita-wide id, stored in Stripe metadata.mesita_plan.
  id: "consumer_premium" | "business_verified";
  // Lookup row backing this price.
  table: "classes" | "business_plans";
  rowKey: string;
  // Stripe price lookup_key — the idempotency anchor.
  lookupKey: string;
  productName: string;
  productDescription: string;
  // Recurring interval matching business_plans / classes price semantics.
  interval: "month" | "year";
};

export const STRIPE_CATALOG: PlanCatalogEntry[] = [
  {
    id: "consumer_premium",
    table: "classes",
    rowKey: "premium",
    lookupKey: "consumer_premium_monthly",
    productName: "Mesita Premium",
    productDescription:
      "Mesita consumer Premium plan — monthly subscription.",
    interval: "month",
  },
  {
    id: "business_verified",
    table: "business_plans",
    rowKey: "pro",
    lookupKey: "business_verified_yearly",
    productName: "Mesita Verified",
    productDescription:
      "Mesita business Verified membership — annual subscription.",
    interval: "year",
  },
];
