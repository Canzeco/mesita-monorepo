"use client";

import { Link2, Phone, Tags } from "lucide-react";

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
  // Google atmosphere chips. NO TAGS, NO BOX (Pato, MESITA-2700).
  if (place.tags.length === 0) return null;
  return (
    <Box title="Tags" icon={Tags} iconColor="text-muted-foreground">
      <TagChips tags={place.tags} />
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
  // Grey buttons, the brand's own logo the only colour (MESITA-2636; the
  // soft clay tints were removed).
  // TWO COLUMNS OF BUTTONS (Pato, MESITA-2619: "for links make buttons in a
  // grid with 2 columns"): every link is a full-width cell of one height,
  // never a wrapping pill cluster that leaves a ragged last row.
  return (
    <Box title="Links" icon={Link2} iconColor="text-muted-foreground">
      <ChannelChips chips={chips} onOpenLink={onOpenLink} grid />
    </Box>
  );
}
