import { money, type MonitorAnalytics as Analytics } from "@/lib/monitor";
import { AnalyticsCard, count, type AnalyticsRow } from "./AnalyticsCard";

// Visits and Vouchers analytics (MESITA-4677, Pato: "add analytics to visits
// and vouchers too"), synthesized by business-web-list-place-monitor.
export function MonitorAnalytics({ analytics }: { analytics: Analytics }) {
  let rows: AnalyticsRow[];
  if (analytics.kind === "visits") {
    const a = analytics;
    rows = [
      ["Visits", count(a.visits)],
      ["Open now", count(a.open)],
      ["Guests who visited", count(a.guests)],
      ["Returning guests", count(a.returning)],
      ["Visits, last 7 days", count(a.visits7d)],
      ["Visits, last 30 days", count(a.visits30d)],
      ["Billed", money(a.billed_cents)],
      ["Average bill", money(a.average_bill_cents)],
      ["Tips", money(a.tips_cents)],
    ];
  } else {
    const a = analytics;
    rows = [
      ["Vouchers sold", count(a.vouchers)],
      ["Guests who bought", count(a.guests)],
      ["Returning buyers", count(a.returning)],
      ["Sold, last 7 days", count(a.vouchers7d)],
      ["Sold, last 30 days", count(a.vouchers30d)],
      ["Paid", money(a.paid_cents)],
      ["Bonus given", money(a.bonus_cents)],
      ["Refunded", money(a.refunded_cents)],
    ];
  }
  return <AnalyticsCard rows={rows} />;
}
