"use client";

import { useState } from "react";
import { Users } from "lucide-react";

import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";

import { Box } from "./box";

// ── Popular times (MESITA-2135) ─────────────────────────────────────────
//
// Back from the deleted mobile app's PopularTimesCard. The box is a day
// picker over `place_profiles.popular_times`, one { day, range } per day.
// Nothing writes that column today: MESITA-2420 retired the synthesis guess,
// which read busy hours off review text under a "From Google" label. So the
// box renders only when a row carries the shape, and hourly bars only when a
// row carries them, never as invented zeros.

const dayKey = (day: string) => day.trim().slice(0, 3).toLowerCase();

export function PopularTimesBox({ place }: { place: PlaceDetail }) {
  const days = place.popular_times.filter((d) => d.day && d.range);
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: place.timezone || undefined,
  }).format(new Date());
  const initial =
    days.find((d) => dayKey(d.day) === dayKey(today))?.day ??
    days[0]?.day ??
    "";
  const [selected, setSelected] = useState(initial);

  if (days.length === 0) return null;
  const featured = days.find((d) => d.day === selected) ?? days[0];
  const bars = featured.bars.filter((v) => Number.isFinite(v));

  return (
    <Box
      title="Popular times"
      icon={Users}
      iconColor="text-muted-foreground"
      right="From Google"
    >
      <div className="flex gap-1" role="tablist" aria-label="Day">
        {days.map((d) => {
          const active = d.day === featured.day;
          return (
            <button
              key={d.day}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(d.day)}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center rounded-lg text-xs font-semibold transition",
                active
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground",
              )}
            >
              {d.day.slice(0, 3)}
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-snug">
        <span className="text-muted-foreground">Busiest </span>
        <span className="text-foreground font-semibold">{featured.range}</span>
      </p>
      {bars.length > 0 && (
        <div className="flex h-24 items-end gap-1" aria-hidden>
          {bars.map((v, i) => (
            <span
              key={i}
              className="bg-foreground/80 flex-1 rounded-full"
              style={{ height: `${Math.max(Math.min(v, 1), 0.06) * 100}%` }}
            />
          ))}
        </div>
      )}
    </Box>
  );
}
