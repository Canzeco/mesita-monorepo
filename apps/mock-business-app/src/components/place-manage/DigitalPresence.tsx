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
// FOUR ROWS, NOT A 2×2 (MESITA-1932; Pato: "sort the items or grid in a better
// way, that looks like shit"). It was four bordered wells inside a bordered
// card, and four things were wrong with that:
//
//   1. A VIEWPORT BREAKPOINT WAS SIZING A CONTAINER. `sm:grid-cols-2` fires on
//      window width, but this card lives in a ~440px masonry column, so at xl
//      it forced two ~190px tiles and `4.7 ★★★★★` ran into its own padding.
//      Rows have no breakpoint at all, so that bug cannot come back.
//   2. BOX IN A BOX. `SectionCard` already draws a border and a shadow; each
//      well added a second border and a fill. Hairlines and whitespace separate
//      four rows without a single extra frame, and nothing here is clickable —
//      a card is for an interaction, and there is no interaction in this box.
//   3. IT CLAIMED FOUR PEERS AND DELIVERED TWO PAIRS. Google and Mesita are
//      scores out of five; Instagram and Facebook are audience counts. Drawn
//      identically, the only thing telling them apart was the 11px hint — the
//      smallest type on the card carrying the biggest distinction. Stacked, the
//      two starred rows sit together and the kinds group themselves.
//   4. NO SHARED EDGE. Four numbers at four different left edges cannot be read
//      as a set. Every value is now right-aligned on one edge.
//
// The ORDER did not change, because it was never the problem: scores first,
// reach second (Pato live 2026-09-02).
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
// ReviewsSummary.tsx, which still carries both halves, under the old name, in
// the 2×2 this one left behind.

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
 *  16px — `MesitaLogo.tsx` puts the bare mark's floor at 16, and four marks at
 *  one size read as four peers. The Channels card's 14px is its own: it labels
 *  a dense stack of fields, this labels four rows. */
const MARK: Record<string, string> = {
  Google: "/channels/googlemaps.svg",
  Mesita: "/channels/mesita.svg",
  Instagram: "/channels/instagram.svg",
  Facebook: "/channels/facebook.svg",
};

/** One platform, one line. Mark and name on the left with the hint under it,
 *  the value hard against the right edge — that edge is the whole point, it is
 *  what lets four numbers be read as a set instead of four separate facts. */
function PresenceRow({
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
    <div className="flex items-center justify-between gap-4 py-3.5">
      <span className="flex min-w-0 items-center gap-2.5">
        {/* Static 16px brand SVG — next/image adds nothing here. Decorative:
            the name beside it already says "Instagram", and a screen reader
            saying it twice is worse than not saying it at all. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={MARK[label]} alt="" aria-hidden className="h-4 w-4 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] leading-tight font-semibold">
            {label}
          </span>
          <span className="text-muted-foreground block type-label">{hint}</span>
        </span>
      </span>
      <span
        className="flex shrink-0 items-center gap-2"
        aria-label={ariaLabel}
      >
        {stars != null ? <Stars value={stars} /> : null}
        <span
          className={
            "text-xl leading-none font-semibold tracking-tight tabular-nums " +
            (muted ? "text-muted-foreground" : "text-foreground")
          }
        >
          {value}
        </span>
      </span>
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
    <PresenceRow
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
    <PresenceRow
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
      {/* `divide-y` draws only BETWEEN DIRECT children, so these four rows must
          stay direct children of this element — wrap them in anything and the
          three hairlines silently vanish. `border-y` closes the list at both
          ends, which is what makes it read as a table rather than four
          paragraphs that happen to be stacked. */}
      <div className="divide-border/60 border-border/60 mt-5 divide-y border-y">
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
