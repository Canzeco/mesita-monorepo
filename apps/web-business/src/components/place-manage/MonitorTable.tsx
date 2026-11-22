// One Monitor table (MESITA-4682, Pato: "THE CUSTOMERS PAGE CAN DO BE A
// TABLE … vouchers … gifts … visits too"). A header row, hairline rows,
// figures right-aligned. On a phone the table scrolls sideways inside its
// card with a visible thin scrollbar; the guest column stays put on the left.
// Columns come from lib/monitor-columns.ts, which the CSV export reads too.

import Link from "next/link";
import type { Column } from "@/lib/monitor-columns";
import { cn } from "@/lib/utils";

const CELL = "px-3 py-2.5 text-sm whitespace-nowrap first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";
const STICKY = "bg-card sticky left-0 z-10 border-border border-r";

/** Consecutive columns with the same group, for the header above them. */
function groupRuns<R>(columns: Column<R>[]): { group: string | null; span: number }[] {
  const runs: { group: string | null; span: number }[] = [];
  for (const c of columns) {
    const g = c.group ?? null;
    const last = runs[runs.length - 1];
    if (last && last.group === g) last.span++;
    else runs.push({ group: g, span: 1 });
  }
  return runs;
}

export function MonitorTable<R>({
  placeId,
  rows,
  rowKey,
  rowId,
  guestLabel,
  guest,
  columns,
  timezone,
}: {
  placeId: string;
  rows: R[];
  rowKey: (row: R) => string;
  /** An anchor id for ?id= deep links. */
  rowId?: (row: R) => string;
  guestLabel: string;
  guest: (row: R) => React.ReactNode;
  columns: Column<R>[];
  timezone: string;
}) {
  return (
    <div className="overflow-x-auto [scrollbar-width:thin]">
      <table className="w-full border-collapse">
        <thead>
          {columns.some((c) => c.group) ? (
            // One header over each run of grouped columns (Visits' Bill).
            <tr>
              <td className={cn(STICKY, "border-r-0")} />
              {groupRuns(columns).map((g, i) =>
                g.group ? (
                  <th
                    key={i}
                    scope="colgroup"
                    colSpan={g.span}
                    className="text-muted-foreground border-border border-b px-3 pt-2 pb-1 text-center text-xs font-semibold"
                  >
                    {g.group}
                  </th>
                ) : (
                  <td key={i} colSpan={g.span} />
                ),
              )}
            </tr>
          ) : null}
          <tr className="border-border border-b">
            <th scope="col" className={cn(CELL, STICKY, "text-muted-foreground text-left text-xs font-semibold")}>
              {guestLabel}
            </th>
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={cn(CELL, "text-muted-foreground text-xs font-semibold", c.numeric ? "text-right" : "text-left")}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((row) => (
            <tr key={rowKey(row)} id={rowId?.(row)}>
              <th scope="row" className={cn(CELL, STICKY, "text-left font-normal")}>
                {guest(row)}
              </th>
              {columns.map((c) => {
                const text = c.text(row, timezone);
                const href = c.href?.(row, placeId) ?? null;
                return (
                  <td key={c.label} className={cn(CELL, c.numeric && "text-right tabular-nums", c.label === "ID" && "text-muted-foreground font-mono text-xs")}>
                    {href ? (
                      <Link href={href} className="font-medium underline-offset-2 hover:underline">
                        {text}
                      </Link>
                    ) : (
                      text
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
