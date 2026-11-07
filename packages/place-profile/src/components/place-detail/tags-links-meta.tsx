"use client";

import { Eye, Heart, Link2, Phone, Tags } from "lucide-react";
import { cn } from "../../lib/format";

import type { ComponentType } from "react";
import type { PlaceActions } from "../../actions";
import type { PlaceDetail } from "../../place-detail";

import {
  CHANNEL_DEFS,
  PHONE_MARK,
  RESERVATION_DEFS,
  REVIEW_DEFS,
} from "../place-detail-links";
import {
  PLACE_FIGURE_CLASS,
  PLACE_OUTLINE_CHIP_CLASS,
} from "../../lib/ui";
import { Box } from "./box";
import { ChannelChips, TagChips, type ChannelChip } from "./place-link-chips";

// ── 9. About lives in @/components/consumer/AboutBox (client). ──────────

// ── 9b. Families ────────────────────────────────────────────────────────

// Pato, MESITA-2924: "add a new section in overview above mesita tags where
// you call it Mesita Families, there you mention all". The place's families
// (1–5, inferred by the Description step, MESITA-2891), emoji + label, in
// family order. No families, no box. Each wears the Tags chip
// (PLACE_OUTLINE_CHIP_CLASS), emoji first (MESITA-2932: one chip, one type
// size; the round semibold pill was a third treatment).
//
// The card is titled "Families", not "Mesita Families" (Pato, MESITA-2958:
// "don't use word mesita families just say families"). Admin keeps the
// longer name.
export function FamiliesBox({ place }: { place: PlaceDetail }) {
  if (place.families.length === 0) return null;
  return (
    <Box title="Families">
      <div className="flex flex-wrap gap-2" data-place-families>
        {place.families.map((f) => (
          <span key={f.key} className={PLACE_OUTLINE_CHIP_CLASS}>
            {f.emoji ? (
              <span aria-hidden className="text-base leading-none">
                {f.emoji}
              </span>
            ) : null}
            {f.label}
          </span>
        ))}
      </div>
    </Box>
  );
}

// ── 10. Tags ────────────────────────────────────────────────────────────

export function TagsBox({ place }: { place: PlaceDetail }) {
  // Mesita tags, else Google atmosphere chips (MESITA-2792). NO TAGS, NO BOX
  // (Pato, MESITA-2700).
  if (place.tags.length === 0) return null;
  return (
    <Box title="Tags" icon={Tags} iconColor="text-muted-foreground">
      <TagChips tags={place.tags} />
    </Box>
  );
}

// ── 11. Stats ───────────────────────────────────────────────────────────

// Pato, MESITA-2866: "how many people in mesita have viewed that profile and
// how many people have liked/saved that profile — below tags". Unique members
// from place_activity; counts only, never who. No counts on the payload, no box.
// Titled "Mesita Stats" (MESITA-2867): these are Mesita members, not Google.
// MESITA-2958 (Pato: "same for stats but call them Mesita Views and Mesita
// Likes"): the card is "Stats" and the cells carry the Mesita word instead.
// A profile open is a VIEW, never a visit: "visit" is reserved for a guest
// physically at the place.
export function StatsBox({ place }: { place: PlaceDetail }) {
  const stats = place.profile_stats;
  if (!stats) return null;
  const cells = [
    { key: "viewed", label: "Mesita Views", n: stats.viewed, Icon: Eye },
    { key: "saved", label: "Mesita Likes", n: stats.saved, Icon: Heart },
  ];
  return (
    <Box title="Stats">
      <div className="grid grid-cols-2 gap-2">
        {cells.map(({ key, label, n, Icon }) => (
          <div key={key} className="bg-muted flex flex-col gap-1 rounded-lg p-3">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              {label}
            </span>
            <span className={cn(PLACE_FIGURE_CLASS, "text-foreground")}>
              {n.toLocaleString("en-US")}
            </span>
          </div>
        ))}
      </div>
    </Box>
  );
}

// ── 12. Score ───────────────────────────────────────────────────────────

// Pato, MESITA-3319: "at the bottom of stats write in overview that shit.
// call it Score and write all the subscores and the final. keep super simple
// design." One card of rows, the label left and the number right, the
// server's breakdown for this guest's location (Proximity × Popularity ×
// Premier = Final, MESITA-2379); it replaces the readout the Home tile wore
// on its photo (MESITA-3053), hidden "for the moment". No score on the
// payload (no location, no answer, admin Preview), no box.
function scoreNumber(n: number | null | undefined, digits = 2): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(digits) : "n/a";
}

export function ScoreBox({ place }: { place: PlaceDetail }) {
  const score = place.score;
  if (!score) return null;
  const rows: Array<{ key: string; label: string; value: string; strong?: boolean }> = [
    // ONE NEARNESS ROW (Pato, MESITA-3341: "what the fuck with proximity and
    // distance, use just one score"): Proximity alone; the km sits in the
    // header chips, and `score.distance_km` stays on the type for them.
    { key: "proximity", label: "Proximity", value: scoreNumber(score.proximity) },
    { key: "popularity", label: "Popularity", value: scoreNumber(score.popularity) },
    { key: "premier", label: "Premier", value: `×${scoreNumber(score.premier, 0)}` },
    { key: "final", label: "Final", value: scoreNumber(score.final), strong: true },
  ];
  return (
    <Box title="Score">
      <ul className="divide-border divide-y" data-place-score>
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 text-sm">
            <span className={r.strong ? "text-foreground font-semibold" : "text-muted-foreground"}>{r.label}</span>
            <span className={r.strong ? "text-foreground font-semibold tabular-nums" : "text-foreground tabular-nums"}>{r.value}</span>
          </li>
        ))}
      </ul>
    </Box>
  );
}

type ChipIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

type LinkChipDef = {
  key: string;
  label: string;
  Icon: ChipIcon;
  logo?: string;
  logoWide?: boolean;
  logoOnly?: boolean;
  mark?: string;
  logoAsIs?: boolean;
};

function linkChipLogo(def: LinkChipDef) {
  return {
    logo: def.logo,
    logoWide: def.logoWide,
    logoOnly: def.logoOnly,
    mark: def.mark,
    logoAsIs: def.logoAsIs,
  };
}

function showsExternalAction(key: string, url: string): boolean {
  if (key !== "opentable_url" && key !== "uber_eats_url") return true;
  try {
    const parsed = new URL(url);
    if (key === "uber_eats_url") {
      return parsed.hostname.includes("ubereats.com") && parsed.pathname.includes("/store/");
    }
    return parsed.hostname.includes("opentable.") && parsed.pathname.startsWith("/r/");
  } catch {
    return false;
  }
}

export function LinksBox({
  place,
  onOpenLink,
}: {
  place: PlaceDetail;
  onOpenLink?: PlaceActions["onOpenLink"];
}) {
  // Flatten every link source into a single chip set — no subgroups.
  // Phone leads since calling is the most direct contact action; the
  // rest follow channel / reservation / review order.
  const chips: ChannelChip[] = [];
  if (place.phone) {
    chips.push({
      key: "phone",
      label: "Phone",
      Icon: Phone,
      url: `tel:${place.phone.replace(/\s+/g, "")}`,
      mark: PHONE_MARK,
    });
  }
  for (const def of CHANNEL_DEFS) {
    const url = place.channels[def.key];
    if (url)
      chips.push({
        key: def.key,
        label: def.label,
        Icon: def.Icon,
        ...linkChipLogo(def),
        url,
      });
  }
  for (const def of RESERVATION_DEFS) {
    const url = place.reservations[def.key];
    if (url && showsExternalAction(def.key, url))
      chips.push({
        key: def.key,
        label: def.label,
        Icon: def.Icon,
        ...linkChipLogo(def),
        url,
      });
  }
  for (const def of REVIEW_DEFS) {
    const url = place.reviews_maps[def.key];
    if (url)
      chips.push({
        key: def.key,
        label: def.label,
        Icon: def.Icon,
        ...linkChipLogo(def),
        url,
      });
  }
  if (chips.length === 0) return null;
  // decision: light like Location / About — drop the inverted Channels surface.
  // Each button its brand's solid colour, words and mark white, since
  // MESITA-3333 (MESITA-3320's tints lasted an hour; MESITA-2636 had one
  // grey button with the logo the only colour).
  // TWO COLUMNS OF BUTTONS (Pato, MESITA-2619: "for links make buttons in a
  // grid with 2 columns"): every link is a full-width cell of one height,
  // never a wrapping pill cluster that leaves a ragged last row.
  return (
    <Box title="Links" icon={Link2} iconColor="text-muted-foreground">
      <ChannelChips chips={chips} onOpenLink={onOpenLink} />
    </Box>
  );
}
