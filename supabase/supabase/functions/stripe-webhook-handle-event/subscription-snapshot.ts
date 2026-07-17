import Stripe from "npm:stripe@17";

export type SubscriptionSnapshot = {
  localStatus: string;
  customerId: string;
  periodEnd: string | null;
  priceCents: number | null;
  currency: string;
  isLive: boolean;
};

export function subscriptionSnapshot(sub: Stripe.Subscription): SubscriptionSnapshot {
  const localStatus = mapStatus(sub.status);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;
  const priceCents = sub.items.data[0]?.price.unit_amount ?? null;
  const currency = (sub.items.data[0]?.price.currency ?? "mxn").toUpperCase();
  const isLive = localStatus === "active" || localStatus === "past_due";
  return { localStatus, customerId, periodEnd, priceCents, currency, isLive };
}

function mapStatus(s: string): string {
  switch (s) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    default:
      return "incomplete";
  }
}
