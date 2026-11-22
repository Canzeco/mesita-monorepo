import { Card } from "@/components/shell/Page";

// The Analytics card on top of a Monitor page (Views MESITA-4675, Visits and
// Vouchers MESITA-4677). The server synthesizes every number from the raw
// rows on this load (Rules §2); this only lays them out. One card of rows.

const ROW = "flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5";

export type AnalyticsRow = [label: string, value: string];

export const count = (n: number) => n.toLocaleString("en-US");

export function AnalyticsCard({ rows }: { rows: AnalyticsRow[] }) {
  return (
    <Card className="flex min-w-0 flex-col p-0 sm:p-0">
      <h2 className="px-4 pt-4 pb-1 text-sm font-semibold sm:px-5">Analytics</h2>
      <ul className="divide-border divide-y">
        {rows.map(([label, value]) => (
          <li key={label} className={ROW}>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
