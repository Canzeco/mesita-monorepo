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
    <Box title="Tags" icon={Tags} iconColor="text-pink-400">
      <TagChips tags={place.tags} />
    </Box>
  );
}

export function VerificationBox({ place }: { place: PlaceDetail }) {
  // decision: Pato — one Verification box (status + claim CTA). Never
  // ShieldAlert for unverified — reads as a security vulnerability.
  const isPartner = place.listing_type === "partner";
  return (
    <Box
      title="Verification"
      icon={isPartner ? BadgeCheck : CircleHelp}
      iconColor={isPartner ? "text-sky-500" : "text-slate-400"}
    >
      {isPartner ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          <span className="text-foreground font-semibold">
            Verified Partner.
          </span>{" "}
          This business signed up on Mesita, confirmed ownership, and can run
          rewards and take reservations through the app.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-xs leading-relaxed">
            <span className="text-foreground font-semibold">Not verified.</span>{" "}
            This is a web listing Mesita found online. Details may be
            incomplete, and the place can’t offer Mesita rewards until an owner
            claims it. Claiming ownership is completely free.
          </p>
          <a
            href="https://business.mesita.ai/add"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-500/25 transition hover:bg-slate-500/15"
          >
            Are you the owner? Claim ownership — it&apos;s free
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </>
      )}
    </Box>
  );
}

export function LastUpdatedBox({ place }: { place: PlaceDetail }) {
  // decision: Pato (MESITA-451) — Enriching moved to the top header next to
  // the place name. This box is freshness-only (Updated …). Hide entirely
  // while still enriching so we don't double-signal, and when there's no
  // updated label yet.
  if (place.is_enriching || !place.last_updated_label) return null;
  return (
    <Box title="Last update" icon={Clock} iconColor="text-slate-400">
      <p className="text-muted-foreground text-sm font-medium tracking-wide">
        Updated {place.last_updated_label}
      </p>
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
