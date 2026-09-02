"use client";

import type { AdminPlace, PlaceStats } from "../actions";

// Performance → reputation as discrete boxes in a Stories-style rail.
//
// This replaced three cards (Reviews summary + the Google list + the Mesita
// list). Pato: "the 3 review cards → 2 numbers." Reading individual reviews
// is not something an operator acts on from here, and Google's own reviews
// are one click away on Google — so the page keeps the scores and drops the
// prose. If per-review text is ever wanted back in admin it is a new surface,
// deliberately not this one.
//
// The Google review-text cap (Apify, 100/place) went with the list it
// described; `google_review_count` below is Google's own aggregate and has
// never been capped.
//
// Reservations count sits on this rail again (MESITA-900) — the list + dial
// lines are the card below. Layout: each metric is its own card; the row
// scrolls horizontally with snap (Instagram Stories peek) so five peers stay
// readable instead of compressing into one divider strip.

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function compact(n: number): string {
  if (n < 1_000) return n.toLocaleString();
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000).toFixed(1)}K`;
}

function Cell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  const empty = value === "—";
  return (
    <div className="border-border bg-card shadow-card w-[9.75rem] shrink-0 snap-start rounded-2xl border p-4 sm:w-[10.5rem]">
      <p className="text-muted-foreground type-label">{label}</p>
      <p
        className={
          "mt-1.5 text-2xl leading-none font-semibold tracking-tight " +
          (empty ? "text-muted-foreground" : "text-foreground")
        }
      >
        {value}
      </p>
      <p className="text-muted-foreground mt-1.5 type-label">{hint}</p>
    </div>
  );
}

export function ReputationStrip({
  place,
  stats,
}: {
  place: AdminPlace;
  stats: PlaceStats;
}) {
  const mesitaCount = num(place.mesita_review_count) ?? 0;
  // Stars only exist once a guest has actually reviewed — an unreviewed place
  // must never render a fabricated 5.0.
  const mesitaStars = mesitaCount > 0 ? num(place.mesita_stars_overall) : null;
  const googleStars = num(place.google_stars_overall);
  const googleCount = num(place.google_review_count) ?? 0;
  const ig = num(place.instagram_followers_count);
  const fb = num(place.facebook_followers);

  return (
    <section
      aria-label="Reputation"
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-0.5 scrollbar-none"
    >
      <Cell
        label="Mesita"
        value={mesitaStars != null ? mesitaStars.toFixed(1) : "—"}
        hint={
          mesitaCount > 0
            ? `${compact(mesitaCount)} review${mesitaCount === 1 ? "" : "s"}`
            : "no reviews yet"
        }
      />
      <Cell
        label="Google"
        value={googleStars != null ? googleStars.toFixed(1) : "—"}
        hint={googleCount > 0 ? `${compact(googleCount)} reviews` : "not scraped yet"}
      />
      <Cell
        label="Instagram"
        value={ig != null ? compact(ig) : "—"}
        hint={ig != null ? "followers" : "not linked"}
      />
      <Cell
        label="Facebook"
        value={fb != null ? compact(fb) : "—"}
        hint={fb != null ? "followers" : "not linked"}
      />
      <Cell
        label="Reservations"
        value={compact(stats.reservations)}
        hint="requested"
      />
    </section>
  );
}
