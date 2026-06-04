"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Interactive popular-times card. Lives in the Hours & popular times
// h-scroll (its sibling is the Hours table). Day pills swap the bars
// underneath. Defaults to the venue's featured day (typically the
// busiest, e.g. Saturday for Mochomos).

type Day = { day: string; range: string; bars: number[] };

export function PopularTimesCard({
  popularTimes,
  initialDay,
}: {
  popularTimes: Day[];
  initialDay: string;
}) {
  const [selectedDay, setSelectedDay] = useState(initialDay.toUpperCase());
  const featured =
    popularTimes.find((d) => d.day.toUpperCase() === selectedDay) ??
    popularTimes[0];

  // Enriched venues may have no popular-times data — render nothing rather
  // than dereferencing an undefined "featured".
  if (!featured) return null;

  return (
    <article className="bg-background flex w-72 shrink-0 snap-start flex-col gap-3 rounded-2xl p-4">
      <div>
        <h4 className="font-display text-base font-semibold">Popular times</h4>
        <p className="text-muted-foreground text-[11px]">
          From Google · {featured.day} · {featured.range}
        </p>
      </div>
      <div className="flex gap-1">
        {popularTimes.map((d) => {
          const active = d.day.toUpperCase() === selectedDay;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => setSelectedDay(d.day.toUpperCase())}
              aria-pressed={active}
              className={cn(
                "flex-1 rounded-md py-1 text-[9px] font-bold tracking-wider uppercase transition",
                active
                  ? "bg-pink-gradient text-white shadow-sm"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
              )}
            >
              {d.day}
            </button>
          );
        })}
      </div>
      <div className="flex h-32 items-end gap-1.5">
        {featured.bars.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-full bg-gradient-to-t from-purple-500 to-pink-500"
            style={{ height: `${Math.max(v * 100, 6)}%` }}
          />
        ))}
      </div>
    </article>
  );
}
