// The last 30 days of one ticket kind (MESITA-4487). One series, so ink bars
// and no legend. A bar's tooltip names the day, the count and the money.

import type { TicketDay } from "@/lib/ticket-desk";
import { cn } from "@/lib/utils";

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function tipAlign(index: number, length: number): string {
  if (index < 5) return "left-0";
  if (index >= length - 5) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

export function TicketChart({ days, line, money }: { days: TicketDay[]; line: string; money: (cents: number) => string }) {
  const peak = Math.max(0, ...days.map((d) => d.count));
  return (
    <div className="px-5 py-4 sm:px-6">
      <p className="text-sm font-medium">Last 30 days</p>
      <p className="text-muted-foreground text-sm">{line}</p>
      <div className="mt-4 flex gap-2">
        <div className="min-w-0 flex-1">
          <div className={cn("border-border relative h-28 border-b", peak > 0 && "border-t")}>
            {peak === 0 ? (
              <p className="text-muted-foreground flex h-full items-center justify-center text-sm">Nothing yet.</p>
            ) : (
              <ul className="flex h-full items-end gap-0.5">
                {days.map((d, i) => {
                  const label = `${dayLabel(d.day)}: ${d.count.toLocaleString("en-US")}${d.amount_cents > 0 ? `, ${money(d.amount_cents)}` : ""}`;
                  return (
                    <li key={d.day} tabIndex={0} aria-label={label} className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none">
                      {d.count > 0 ? (
                        <span
                          className="bg-foreground block w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70"
                          style={{ height: `max(4px, ${(d.count / peak) * 100}%)` }}
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
                        {label.slice(dayLabel(d.day).length + 2)}
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
