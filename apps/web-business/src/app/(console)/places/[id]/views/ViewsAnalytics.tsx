import { Card } from "@/components/shell/Page";
import type { PlaceViews } from "@/lib/business-api";

// Analytics on top of Views (MESITA-4675, Pato: "do add analytics at the
// top"). Every number is synthesized by business-web-get-place-views from the
// raw events on this load; nothing is stored. One card of rows.

const ROW = "flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5";

const fmt = (n: number) => n.toLocaleString("en-US");

export function ViewsAnalytics({ data }: { data: PlaceViews }) {
  const a = data.analytics;
  const rows: Array<[string, number]> = [
    ["Views", a.views],
    ["Guests who viewed", a.viewers],
    ["Returning guests", a.returning],
    ["Views, last 7 days", a.views7d],
    ["Views, last 30 days", a.views30d],
    ["Guests, last 30 days", a.viewers30d],
    ["Likes", data.likes],
    ["Shares", data.shares],
  ];
  return (
    <Card className="flex min-w-0 flex-col p-0 sm:p-0">
      <h2 className="px-4 pt-4 pb-1 text-sm font-semibold sm:px-5">Analytics</h2>
      <ul className="divide-border divide-y">
        {rows.map(([label, value]) => (
          <li key={label} className={ROW}>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{fmt(value)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
