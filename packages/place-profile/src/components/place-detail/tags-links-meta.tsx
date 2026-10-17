"use client";

import { Clock, Link2, Phone, Tags } from "lucide-react";

import type { ComponentType } from "react";
import type { PlaceActions } from "../../actions";
import type { PlaceDetail } from "../../place-detail";

import {
  CHANNEL_DEFS,
  RESERVATION_DEFS,
  REVIEW_DEFS,
} from "../place-detail-links";
import { Box } from "./box";
import { ChannelChips, TagChips, type ChannelChip } from "./place-link-chips";

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
    <Box title="Mesita Tags" icon={Tags} iconColor="text-muted-foreground">
      <TagChips tags={place.tags} />
    </Box>
  );
}

function MetaPill({ label }: { label: string }) {
  // TagChips language — rounded-full, leading 6px dot, soft tint.
  return (
    <span className="border-border bg-muted text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold">
      <span className="bg-foreground h-1.5 w-1.5 shrink-0 rounded-full" />
      {label}
    </span>
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
    <Box title="Dates" icon={Clock} iconColor="text-muted-foreground">
      <div className="flex flex-wrap gap-2">
        {created && <MetaPill label={`Created · ${created}`} />}
        {updated && <MetaPill label={`Updated · ${updated}`} />}
      </div>
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
};

function linkChipLogo(def: LinkChipDef) {
  return {
    logo: def.logo,
    logoWide: def.logoWide,
    logoOnly: def.logoOnly,
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
  // Soft clay brand tints (CHANNEL_CLAY) so each chip reads as its app.
  return (
    <Box title="Links" icon={Link2} iconColor="text-muted-foreground">
      <ChannelChips chips={chips} onOpenLink={onOpenLink} />
    </Box>
  );
}
