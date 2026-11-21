"use client";

// Foursquare (MESITA-4552, rebuilt by MESITA-4575, Pato: "I care about the
// analytics they throw about popularity of the place"): the popularity score
// and the busiest hours lead; Foursquare's own rating and its tips and photos
// counts sit under them, small. Everything comes from one Places API read at
// match or deep-update time (`place_profiles.foursquare_details`), staff
// only. Name, address, categories and the rest stay stored, unshown.

import { MapPinIcon } from "@phosphor-icons/react/dist/ssr";
import type { AdminPlace } from "../actions";
import { ReadField, SectionCard } from "@/components/ui/manage";
import { formatAbsoluteUtc } from "@/lib/format";

type Window = { day?: number; open?: string; close?: string };
type Details = {
  popularity?: number;
  rating?: number;
  stats?: { total_ratings?: number; total_tips?: number; total_photos?: number };
  hours_popular?: Window[];
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "1900" → "19:00"; "+0300" (past midnight) → "03:00". */
const clock = (hhmm: string | undefined) => {
  const t = (hhmm ?? "").replace("+", "");
  return /^\d{4}$/.test(t) ? `${t.slice(0, 2)}:${t.slice(2)}` : "?";
};

/** Foursquare's busiest windows by weekday (1 = Monday), Monday first. */
export function busiestHours(windows: readonly Window[] | undefined): Array<[string, string]> {
  const byDay = new Map<number, string[]>();
  for (const w of windows ?? []) {
    if (typeof w.day !== "number" || w.day < 1 || w.day > 7) continue;
    byDay.set(w.day, [...(byDay.get(w.day) ?? []), `${clock(w.open)}–${clock(w.close)}`]);
  }
  return DAYS.flatMap((name, i) => (byDay.has(i + 1) ? [[name, byDay.get(i + 1)!.join(", ")] as [string, string]] : []));
}

export function FoursquareCard({ place }: { place: AdminPlace }) {
  const p = place as Record<string, unknown>;
  const url = typeof p.foursquare_url === "string" ? p.foursquare_url : null;
  const d = p.foursquare_details && typeof p.foursquare_details === "object" ? p.foursquare_details as Details : null;
  const at = typeof p.foursquare_details_at === "string" ? p.foursquare_details_at : null;
  const hours = busiestHours(d?.hours_popular);
  return (
    <SectionCard
      icon={<MapPinIcon size={20} />}
      title="Foursquare"
      subtitle={url ? (at ? `Read ${formatAbsoluteUtc(at)}.` : "Linked; details not read yet.") : "Not linked to Foursquare yet."}
    >
      <div className="mt-5 flex flex-col gap-4">
        {typeof d?.popularity === "number" ? (
          <ReadField label="Popularity">
            <span className="text-foreground text-2xl font-semibold tabular-nums">{d.popularity.toFixed(3)}</span>
            <span className="text-muted-foreground type-meta block">
              0 to 1, from real visits, against places nearby. Boosts Discovery&apos;s Popularity.
            </span>
          </ReadField>
        ) : null}
        {hours.length > 0 ? (
          <ReadField label="Busiest hours">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
              {hours.map(([day, windows]) => (
                <div key={day} className="contents">
                  <dt className="text-muted-foreground">{day}</dt>
                  <dd>{windows}</dd>
                </div>
              ))}
            </dl>
          </ReadField>
        ) : null}
        {typeof d?.rating === "number" || d?.stats ? (
          <p className="text-muted-foreground type-meta">
            {typeof d?.rating === "number"
              ? `Foursquare users rate it ${d.rating} / 10${d.stats?.total_ratings ? ` (${d.stats.total_ratings} ratings)` : ""}. `
              : ""}
            {d?.stats ? `${d.stats.total_tips ?? 0} tips · ${d.stats.total_photos ?? 0} photos.` : ""}
          </p>
        ) : null}
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="type-body w-fit underline underline-offset-4">
            Open on Foursquare
          </a>
        ) : null}
        {url && !d ? <p className="text-muted-foreground type-meta">A Deep Update reads the details.</p> : null}
      </div>
    </SectionCard>
  );
}
