// Mesita Stripe subscription catalog — product/price metadata only.
// Provisioning lives in stripe-billing.ts (resolvePlanPrice / ensureWholeCatalog).
//
//   consumer_premium   — Mesita Premium · $50 MXN/mo · consumer_plans.premium
//   business_verified  — Mesita Verified · $1,000 MXN/yr · project_plans.pro
//
// Promos v4 (MESITA-541) retired business Pro/Ultra monthly SKUs. Verified is
// the only business product sold; `ultra` remains a legacy plan key for
// existing places but is not self-provisioned here.

export type PlanCatalogEntry = {
  // Stable Mesita-wide id, stored in Stripe metadata.mesita_plan.
  id: "consumer_premium" | "business_verified";
  // Lookup row backing this price.
  table: "consumer_plans" | "project_plans";
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
    id: "business_verified",
    table: "project_plans",
    rowKey: "pro",
    lookupKey: "business_verified_yearly",
    productName: "Mesita Verified",
    productDescription:
      "Mesita business Verified partnership — annual subscription.",
    interval: "year",
  },
];
