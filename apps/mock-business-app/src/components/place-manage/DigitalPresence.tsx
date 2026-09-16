"use client";

// DIGITAL PRESENCE — how big this place is on the internet, in four numbers.
//
// It was called "Reviews" and it was the only reputation card on Profile: four
// aggregate tiles plus Mesita's sub-score row, and not one word anybody wrote.
// MESITA-1930 split that into three passive boxes — this one, then the Google
// reviews, then the Mesita ones — so the name had to move with the contents.
// "Reviews snapshot" was on the table and would have lied about half the card:
// Instagram and Facebook are FOLLOWER COUNTS, not reviews. Digital Presence is
// the only name that covers what is in the box (Pato's call, 2026-09-16).
//
// FOUR TILES (Pato live 2026-09-02): Google · Mesita · Instagram · Facebook.
// Scores are half the reputation an operator is asked about; reach is the
// other half. That order stays: the two scores, then the two reaches.
//
// THE SUB-SCORES LEFT. Food/Service/Ambience/Value are Mesita's breakdown and
// Mesita's alone — Google publishes none — so on a four-platform card they
// read as a Mesita-only footnote. They are the header of the Mesita Reviews
// box now, where they are the only thing in the box that is not one guest.
//
// Read-only and `auto` — every number is enrichment- or guest-written. There
// is nothing to save, so the card registers no dirty section and the save bar
// never learns it exists.
//
// A SNAPSHOT of apps/web-business/src/components/place-manage/sections/
// ReviewsSummary.tsx, which still carries both halves under the old name.

import { Globe, Lock, Star } from "lucide-react";
import { SectionCard } from "@/components/admin-ui/manage";
import type { MockPlaceProfile } from "@/mock/types";

export function compact(n: number): string {
  if (n < 1_000) return n.toLocaleString();
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000).toFixed(1)}K`;
}

function reviewWord(n: number): string {
  return `${compact(n)} review${n === 1 ? "" : "s"}`;
}

/** Five glyphs, rounded to the nearest whole star. Decoration for the number
 *  beside it — the number is the fact, so this carries no label of its own. */
export function Stars({ value }: { value: number }) {
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

/** The `auto` pill every box in this trio wears. One per card, not one per
 *  number: nothing in any of the three is editable, so the card says it once. */
export function AutoPill() {
  return (
    <span className="text-muted-foreground/70 inline-flex items-center gap-0.5 type-meta">
      <Lock className="h-3 w-3" />
      auto
    </span>
  );
}

/** The four marks, from `public/channels` — the same Simple Icons set the
 *  Channels card two columns over labels its fields with, plus Mesita's own
 *  flame (a hand-copy of the brand's `mark-color.svg`, not a new `MesitaLogo`
 *  variant: that file is itself a hand-copied snapshot, so a variant added
 *  there would vanish the next time the brand moves and it is re-copied).
 *
 *  GOOGLE WEARS THE MAPS PIN, because Google reviews ARE Maps reviews: Maps
 *  is where the count is scraped from and where an operator who wants to read
 *  one gets sent.
 *
 *  16px, not the Channels card's 14px — `MesitaLogo.tsx` puts the bare mark's
 *  floor at 16, and four marks at one size read as four peers. */
const MARK: Record<string, string> = {
  Google: "/channels/googlemaps.svg",
  Mesita: "/channels/mesita.svg",
  Instagram: "/channels/instagram.svg",
  Facebook: "/channels/facebook.svg",
};

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
      <p className="text-muted-foreground flex items-center gap-1.5 type-label">
        {/* Static 16px brand SVG — next/image adds nothing here. Decorative:
            the label beside it already says "Instagram", and a screen reader
            saying it twice is worse than not saying it at all. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARK[label]} alt="" aria-hidden className="h-4 w-4 shrink-0" />
        {label}
      </p>
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

export function DigitalPresence({ place }: { place: MockPlaceProfile }) {
  const googleStars = place.google_stars_overall;
  const googleCount = place.google_review_count ?? 0;
  const mesitaCount = place.mesita_review_count ?? 0;
  // Stars only exist once a guest has actually reviewed — an unreviewed place
  // must never render a fabricated 5.0.
  const mesitaStars = mesitaCount > 0 ? place.mesita_stars_overall : null;

  return (
    <SectionCard
      icon={<Globe className="h-4 w-4" />}
      tint="violet"
      title="Digital Presence"
      subtitle="Where this place shows up, and how many people are looking."
      action={<AutoPill />}
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
    </SectionCard>
  );
}
