"use client";

import { Lock, Star } from "lucide-react";
import type { AdminPlace } from "../actions";
import { SectionCard } from "@/components/admin-ui/manage";

// Reviews SUMMARY (Pato live 2026-09-01; list restored MESITA-1802).
//
// The aggregate tiles a place is judged on. Google reviews stay one click
// away on Google and are not proxied here.
//
// THREE tiles: Google · Instagram · Facebook. Scores are half the reputation
// an operator is asked about; reach is the other half, and it already sat one
// tab away on the Activity rail while Profile — the only live tab — pretended
// it did not exist (Pato live 2026-09-02).
//
// Read-only and `auto` — every number is enrichment-written. There is nothing
// to save, so the card registers no dirty section.
//
// These same numbers also ride the Activity reputation rail. That is not a
// duplicate to delete: Activity is parked behind Soon (nav.ts), so Profile is
// the only surface where an operator can read a place's standing today.

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
              ? "fill-foreground text-muted-foreground"
              : "text-muted-foreground/30")
          }
        />
      ))}
    </span>
  );
}

/** One metric well — big number, optional star row, hint line. Shared so a
 *  score and a follower count read as peers on the same 2×2 grid. */
function ProviderMark({ src }: { src: string }) {
  return (
    // Static brand SVG — next/image adds nothing at this size.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden className="h-4 w-4 shrink-0" />
  );
}

function Tile({
  label,
  logo,
  value,
  muted,
  ariaLabel,
  stars,
  hint,
}: {
  label: string;
  /** Brand SVG in /public/channels — the tile's identity mark. */
  logo: string;
  value: string;
  /** The value is a placeholder, not a fact — dim it. */
  muted: boolean;
  ariaLabel: string;
  stars?: number | null;
  hint: string;
}) {
  return (
    <div className="border-border/60 bg-muted/40 flex min-w-0 flex-col gap-1.5 rounded-xl border px-3.5 py-3">
      <p className="text-muted-foreground type-label flex items-center gap-1.5">
        <ProviderMark src={logo} />
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
  logo,
  stars,
  hint,
}: {
  label: string;
  logo: string;
  stars: number | null;
  hint: string;
}) {
  return (
    <Tile
      label={label}
      logo={logo}
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
  logo,
  followers,
}: {
  label: string;
  logo: string;
  followers: number | null;
}) {
  return (
    <Tile
      label={label}
      logo={logo}
      value={followers == null ? "—" : compact(followers)}
      muted={followers == null}
      ariaLabel={`${label}: ${
        followers == null
          ? "not linked"
          : `${followers.toLocaleString()} followers`
      }`}
      hint={followers == null ? "not linked" : "followers"}
    />
  );
}

export function ReviewsSummary({ place }: { place: AdminPlace }) {
  const googleStars = num(place.google_stars_overall);
  const googleCount = num(place.google_review_count) ?? 0;
  const instagramFollowers = num(place.instagram_followers_count);
  const facebookFollowers = num(place.facebook_followers);

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
      {/* Score first, reach second — the order the operator is asked about
          them, and the order they carry weight. The one score takes the full
          row; the two reach tiles share the next. */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Score
            label="Google"
            logo="/channels/google.svg"
            stars={googleStars}
            hint={googleCount > 0 ? reviewWord(googleCount) : "not scraped yet"}
          />
        </div>
        <Reach
          label="Instagram"
          logo="/channels/instagram.svg"
          followers={instagramFollowers}
        />
        <Reach
          label="Facebook"
          logo="/channels/facebook.svg"
          followers={facebookFollowers}
        />
      </div>
    </SectionCard>
  );
}
