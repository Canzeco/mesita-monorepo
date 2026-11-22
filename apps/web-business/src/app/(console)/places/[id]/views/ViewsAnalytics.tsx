import type { PlaceViews } from "@/lib/business-api";
import { AnalyticsCard, count } from "@/components/place-manage/AnalyticsCard";

// Analytics on top of Views (MESITA-4675, Pato: "do add analytics at the
// top"). Every number is synthesized by business-web-get-place-views from the
// raw events on this load; nothing is stored.
export function ViewsAnalytics({ data }: { data: PlaceViews }) {
  const a = data.analytics;
  return (
    <AnalyticsCard
      rows={[
        ["Views", count(a.views)],
        ["Guests who viewed", count(a.viewers)],
        ["Returning guests", count(a.returning)],
        ["Views, last 7 days", count(a.views7d)],
        ["Views, last 30 days", count(a.views30d)],
        ["Guests, last 30 days", count(a.viewers30d)],
        ["Likes", count(data.likes)],
        ["Shares", count(data.shares)],
      ]}
    />
  );
}
