"use client";

import {
  BadgeCheck,
  ChevronRight,
  CircleHelp,
  Clock,
  Globe,
  Link2,
  Phone,
  Tags,
} from "lucide-react";

import type { PlaceDetail } from "@/lib/mock/place";
import { cn } from "@/lib/utils";

import {
  CHANNEL_DEFS,
  RESERVATION_DEFS,
  REVIEW_DEFS,
} from "../place-detail-links";
import { Box } from "./box";
import { ChannelChips, TagChips, type ChannelChip } from "./place-link-chips";
import { isPromoting } from "@/lib/promo-rates";

// ── 9. About lives in @/components/consumer/AboutBox (client). ──────────

// ── 10. Tags ────────────────────────────────────────────────────────────

export function TagsBox({ place }: { place: PlaceDetail }) {
  // Tags only — the curated taxonomy chip cluster (one tint per facet).
  // The old key/value rows (dining style, dress code, reservations,
  // payment, parking, good for) were noise here; those facts are being
  // absorbed into the tag vocabulary itself (Atlas taxonomy v2). The
  // whole box disappears when the place has no tags.
  if (place.tags.length === 0) return null;
  return (
    <Box title="Tags" icon={Tags} iconColor="text-pink-400">
      <TagChips tags={place.tags} />
    </Box>
  );
}

function MetaPill({
  label,
  tone,
}: {
  label: string;
  tone: "sky" | "amber" | "slate";
}) {
  // TagChips language — rounded-full, leading 6px dot, soft tint.
  const tones = {
    sky: {
      chip: "bg-sky-50 text-sky-700 border-sky-200",
      dot: "bg-sky-500",
    },
    amber: {
      chip: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    },
    slate: {
      chip: "bg-slate-50 text-slate-700 border-slate-200",
      dot: "bg-slate-400",
    },
  } as const;
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
        t.chip,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
      {label}
    </span>
  );
}

export function VerificationBox({ place }: { place: PlaceDetail }) {
  // decision: Tags-harmonic status pill + short support (MESITA-927).
  // Never ShieldAlert for unverified — reads as a security vulnerability.
  // What a guest can act on is whether a reward is LIVE here — not whether
  // the place pays Mesita, which is Mesita's business and tells them nothing.
  const promoting = isPromoting(place);
  return (
    <Box
      title="Mesita"
      icon={promoting ? BadgeCheck : CircleHelp}
      iconColor={promoting ? "text-sky-500" : "text-amber-500"}
    >
      <div className="flex flex-wrap gap-2">
        <MetaPill
          label={promoting ? "Runs Mesita rewards" : "No reward here yet"}
          tone={promoting ? "sky" : "amber"}
        />
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {promoting
          ? "Running a Mesita reward — start a visit and claim it at the table."
          : "No reward here yet. Owners claim their place to run one — free."}
      </p>
      {!promoting && (
        <a
          href="https://business.mesita.ai/add"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Claim ownership — free
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      )}
    </Box>
  );
}

export function DatesBox({ place }: { place: PlaceDetail }) {
  // decision: Pato — Created + Updated as Tag-style pills (MESITA-927).
  // Hide while enriching so we don't double-signal with the Enriching chip.
  if (place.is_enriching) return null;
  const created = place.created_label?.trim();
  const updated = place.updated_label?.trim();
  if (!created && !updated) return null;
  return (
    <Box title="Dates" icon={Clock} iconColor="text-slate-400">
      <div className="flex flex-wrap gap-2">
        {created && <MetaPill label={`Created · ${created}`} tone="slate" />}
        {updated && <MetaPill label={`Updated · ${updated}`} tone="slate" />}
      </div>
    </Box>
  );
}

type LinkChipDef = {
  key: string;
  label: string;
  Icon: typeof Globe;
  logo?: string;
  logoWide?: boolean;
  logoOnly?: boolean;
};

function linkChipLogo(def: LinkChipDef) {
  return {
    logo: def.logo,
    logoWide: def.logoWide,
    logoOnly: def.logoOnly,
  };
}

export function LinksBox({ place }: { place: PlaceDetail }) {
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
    if (url)
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
  // Soft clay brand tints (CHANNEL_CLAY) so each chip reads as its app.
  return (
    <Box title="Channels" icon={Link2} iconColor="text-cyan-400">
      <ChannelChips chips={chips} />
    </Box>
  );
}
