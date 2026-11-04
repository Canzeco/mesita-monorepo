// The last 30 days (MESITA-3213, Pato: "maybe build some stupid graphic"). One
// series, so ink bars and no legend; the three rows under it name the totals. A
// bar's tooltip splits its day, on hover and on keyboard focus.

import type { PlaceViewsDay } from "@/lib/business-api";
import { cn } from "@/lib/utils";

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** The tooltip stays inside the card at either end of the chart. */
function tipAlign(index: number, length: number): string {
  if (index < 5) return "left-0";
  if (index >= length - 5) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

export function ViewsChart({ days }: { days: PlaceViewsDay[] }) {
  const totals = days.map((d) => d.views + d.likes + d.shares);
  const peak = Math.max(0, ...totals);
  return (
    <div className="px-5 py-4 sm:px-6">
      <p className="text-sm font-medium">Last 30 days</p>
      <p className="text-muted-foreground text-sm">Every view, like and share.</p>
      <div className="mt-4 flex gap-2">
        <div className="min-w-0 flex-1">
          <div className={cn("border-border relative h-28 border-b", peak > 0 && "border-t")}>
            {peak === 0 ? (
              <p className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing yet.</p>
            ) : (
              <ul className="flex h-full items-end gap-0.5">
                {days.map((d, i) => {
                  const label = `${dayLabel(d.day)}: ${count(d.views, "view")}, ${count(d.likes, "like")}, ${count(d.shares, "share")}`;
                  return (
                    <li
                      key={d.day}
                      tabIndex={0}
                      aria-label={label}
                      className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                    >
                      {totals[i] > 0 ? (
                        <span
                          className="bg-foreground block w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70"
                          style={{ height: `max(4px, ${(totals[i] / peak) * 100}%)` }}
                        />
                      ) : null}
                      <span
                        aria-hidden
                        className={cn(
                          "bg-foreground text-background pointer-events-none invisible absolute bottom-full z-10 mb-1 rounded-lg px-3 py-2 text-xs whitespace-nowrap group-hover:visible group-focus-visible:visible",
                          tipAlign(i, days.length),
                        )}
                      >
                        <span className="block font-semibold">{dayLabel(d.day)}</span>
                        {count(d.views, "view")} · {count(d.likes, "like")} · {count(d.shares, "share")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {days.length > 0 ? (
            <div className="text-muted-foreground mt-2 flex justify-between text-xs">
              <span>{dayLabel(days[0].day)}</span>
              <span>Today</span>
            </div>
          ) : null}
        </div>
        {peak > 0 ? <span className="text-muted-foreground -mt-2 text-xs tabular-nums">{peak.toLocaleString("en-US")}</span> : null}
      </div>
    </div>
  );
}
