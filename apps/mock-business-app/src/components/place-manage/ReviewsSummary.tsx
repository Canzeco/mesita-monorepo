"use client";

// A SNAPSHOT of apps/web-business/src/components/place-manage/sections/
// ReviewsSummary.tsx — the aggregate tiles a place is judged on.
//
// FOUR TILES (Pato live 2026-09-02): Google · Mesita · Instagram · Facebook.
// Scores are half the reputation an operator is asked about; reach is the
// other half. The two Mesita sub-score rows stay beneath, because only Mesita
// has a breakdown — Google publishes none.
//
// Read-only and `auto` — every number is enrichment- or guest-written. There
// is nothing to save, so the card registers no dirty section and the save bar
// never learns it exists.
//
// It is on PROFILE now (MESITA-1917), which is where the real file's own
// header always said it belonged: "Profile is the only surface where an
// operator can read a place's standing today."

import { Lock, Star } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/manage";
import type { MockPlaceProfile } from "@/mock/types";

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

/** One metric well — big number, optional star row, hint line. Shared so a
 *  score and a follower count read as peers on the same 2×2 grid. */
function Tile({
  label,
  value,
  muted,
  ariaLabel,
  stars,
  hint,
}: {
  label: string;
  value: string;
  /** The value is a placeholder, not a fact — dim it. */
  muted: boolean;
  ariaLabel: string;
  stars?: number | null;
  hint: string;
}) {
  return (
    <div className="border-border/60 bg-muted/40 flex min-w-0 flex-col gap-1.5 rounded-xl border px-3.5 py-3">
      <p className="text-muted-foreground type-label">{label}</p>
      <p className="flex items-center gap-2" aria-label={ariaLabel}>
        <span
          className={
            "text-2xl leading-none font-semibold tracking-tight tabular-nums " +
            (muted ? "text-muted-foreground" : "text-foreground")
          }
        >
          {value}
        </span>
        {stars != null ? <Stars value={stars} /> : null}
      </p>
      <p className="text-muted-foreground type-label">{hint}</p>
    </div>
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
    <Tile
      label={label}
      value={stars == null ? "—" : stars.toFixed(1)}
      muted={stars == null}
      ariaLabel={`${label}: ${stars == null ? "no score" : `${stars.toFixed(1)} out of 5`}`}
      stars={stars}
      hint={hint}
    />
  );
}

/** Social reach. The count IS the fact, so no star row rides along, and an
 *  unlinked account reads "not linked" rather than a fabricated 0. */
function Reach({
  label,
  followers,
}: {
  label: string;
  followers: number | null;
}) {
  return (
    <Tile
      label={label}
      value={followers == null ? "—" : compact(followers)}
      muted={followers == null}
      ariaLabel={`${label}: ${
        followers == null ? "not linked" : `${followers.toLocaleString()} followers`
      }`}
      hint={followers == null ? "not linked" : "followers"}
    />
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

export function ReviewsSummary({ place }: { place: MockPlaceProfile }) {
  const googleStars = place.google_stars_overall;
  const googleCount = place.google_review_count ?? 0;
  const mesitaCount = place.mesita_review_count ?? 0;
  // Stars only exist once a guest has actually reviewed — an unreviewed place
  // must never render a fabricated 5.0.
  const mesitaStars = mesitaCount > 0 ? place.mesita_stars_overall : null;

  const subScores =
    mesitaCount > 0
      ? ([
          { label: "Food", value: place.mesita_stars_food },
          { label: "Service", value: place.mesita_stars_service },
          { label: "Ambience", value: place.mesita_stars_ambience },
          { label: "Value", value: place.mesita_stars_value },
        ] as const)
      : null;

  return (
    <SectionCard
      icon={<Star className="h-4 w-4" />}
      tint="violet"
      title="Reviews"
      subtitle="What guests scored this place, and how many follow it."
      action={
        // Same `auto` pill the read-only fields on this tab wear — nothing on
        // this card is editable, and the whole card says so once.
        <span className="text-muted-foreground/70 inline-flex items-center gap-0.5 type-meta">
          <Lock className="h-3 w-3" />
          auto
        </span>
      }
    >
      {/* Scores first, reach second — the order the operator is asked about
          them, and the order they carry weight. Two per row at every width
          the masonry column takes. */}
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
        <Reach label="Instagram" followers={place.instagram_followers_count} />
        <Reach label="Facebook" followers={place.facebook_followers} />
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
