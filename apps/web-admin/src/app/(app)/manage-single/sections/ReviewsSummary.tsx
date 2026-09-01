"use client";

import { Lock, Star } from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";

// Profile → Reviews SUMMARY (Pato live 2026-09-01).
//
// A summary, deliberately not the prose. The three review cards this console
// used to carry — the summary, the Google list, the Mesita list — were cut to
// "the 3 review cards → 2 numbers" (Pato, MESITA-900), and per-review text is
// NOT back: reading individual reviews is not something an operator acts on
// from here, and Google's own are one click away on Google. What returns is
// the aggregate a profile is judged on: the two scores, plus the four
// sub-scores only Mesita has.
//
// Read-only and `auto` — every number is enrichment- or guest-written. There
// is nothing to save, so the card registers no dirty section.
//
// These same numbers also ride the Activity reputation rail. That is not a
// duplicate to delete: Activity is parked behind Soon (nav.ts), so Profile is
// the only surface where an operator can read a place's score today.

/** Numeric columns can arrive as strings over the wire — coerce, don't trust. */
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

function reviewWord(n: number): string {
  return `${compact(n)} review${n === 1 ? "" : "s"}`;
}

/** Five glyphs, rounded to the nearest whole star. Decoration for the number
 *  beside it — the number is the fact, so this carries no label of its own. */
function Stars({ value }: { value: number }) {
  const filled = Math.round(Math.min(Math.max(value, 0), 5));
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={
            "h-3 w-3 " +
            (i < filled
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30")
          }
        />
      ))}
    </span>
  );
}

function Score({
  label,
  stars,
  hint,
}: {
  label: string;
  stars: number | null;
  hint: string;
}) {
  return (
    <div className="border-border/60 bg-muted/40 flex min-w-0 flex-col gap-1.5 rounded-xl border px-3.5 py-3">
      <p className="text-muted-foreground type-label">{label}</p>
      <p
        className="flex items-center gap-2"
        aria-label={`${label}: ${stars == null ? "no score" : `${stars.toFixed(1)} out of 5`}`}
      >
        <span
          className={
            "text-2xl leading-none font-semibold tracking-tight tabular-nums " +
            (stars == null ? "text-muted-foreground" : "text-foreground")
          }
        >
          {stars == null ? "—" : stars.toFixed(1)}
        </span>
        {stars != null ? <Stars value={stars} /> : null}
      </p>
      <p className="text-muted-foreground type-label">{hint}</p>
    </div>
  );
}

function SubScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-muted-foreground type-label">{label}</span>
      <span
        className={
          "text-sm font-semibold tabular-nums " +
          (value == null ? "text-muted-foreground" : "text-foreground")
        }
      >
        {value == null ? "—" : value.toFixed(1)}
      </span>
    </div>
  );
}

export function ReviewsSummary({ place }: { place: AdminPlace }) {
  const googleStars = num(place.google_stars_overall);
  const googleCount = num(place.google_review_count) ?? 0;
  const mesitaCount = num(place.mesita_review_count) ?? 0;
  // Stars only exist once a guest has actually reviewed — an unreviewed place
  // must never render a fabricated 5.0.
  const mesitaStars = mesitaCount > 0 ? num(place.mesita_stars_overall) : null;

  const subScores = mesitaCount > 0
    ? ([
        { label: "Food", value: num(place.mesita_stars_food) },
        { label: "Service", value: num(place.mesita_stars_service) },
        { label: "Ambience", value: num(place.mesita_stars_ambience) },
        { label: "Value", value: num(place.mesita_stars_value) },
      ] as const)
    : null;

  return (
    <SectionCard
      icon={<Star className="h-4 w-4" />}
      tint="violet"
      title="Reviews"
      subtitle="What guests scored this place."
      action={
        // Same `auto` pill the read-only fields on this tab wear — nothing on
        // this card is editable, and the whole card says so once.
        <span className="text-muted-foreground/70 inline-flex items-center gap-0.5 type-meta">
          <Lock className="h-3 w-3" />
          auto
        </span>
      }
    >
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Score
          label="Google"
          stars={googleStars}
          hint={googleCount > 0 ? reviewWord(googleCount) : "not scraped yet"}
        />
        <Score
          label="Mesita"
          stars={mesitaStars}
          hint={mesitaCount > 0 ? reviewWord(mesitaCount) : "no reviews yet"}
        />
      </div>

      {/* The four sub-scores are Mesita's alone — Google has no breakdown —
          so they only appear once Mesita itself has been reviewed. */}
      {subScores ? (
        <div className="border-border/60 mt-3 grid grid-cols-2 gap-3 rounded-xl border px-3.5 py-3 sm:grid-cols-4">
          {subScores.map((s) => (
            <SubScore key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      ) : null}
    </SectionCard>
  );
}
