"use client";

import { Globe, SquareArrowOutUpRight } from "lucide-react";

import type { PlaceDetail } from "@/lib/mock/place";
import { cn } from "@/lib/utils";

import {
  CHANNEL_CLAY,
  FACET_TINT,
  FACET_TINT_FALLBACK,
} from "../place-detail-links";

export function TagChips({ tags }: { tags: PlaceDetail["tags"] }) {
  // Render nothing when the place has no tags. Otherwise a flat, wrapping
  // cluster of rounded-full pills, ordered by the incoming sort_order (the
  // adapter preserves the EF order), each tinted by its facet group with a
  // leading colored dot.
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const tint =
          t.facet in FACET_TINT
            ? FACET_TINT[t.facet as keyof typeof FACET_TINT]
            : FACET_TINT_FALLBACK;
        return (
          <span
            key={t.slug}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
              tint.chip,
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tint.dot)}
            />
            {t.label}
          </span>
        );
      })}
    </div>
  );
}

export type ChannelChip = {
  key: string;
  label: string;
  Icon: typeof Globe;
  logo?: string;
  logoWide?: boolean;
  logoOnly?: boolean;
  url: string;
};

export function ChannelChips({ chips }: { chips: ChannelChip[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(({ key, label, Icon, logo, logoWide, logoOnly, url }) => {
        // decision: trailing SquareArrowOutUpRight on web destinations so
        // chips read as "leaves the app" — skip tel: (Phone opens dialer).
        const leavesApp = !url.startsWith("tel:");
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={
              logoOnly
                ? leavesApp
                  ? `${label} (opens externally)`
                  : label
                : undefined
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition",
              key in CHANNEL_CLAY
                ? CHANNEL_CLAY[key as keyof typeof CHANNEL_CLAY]
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
          >
            {logo ? (
              // Real brand mark (SVG in /public/channels, brand colour baked
              // in). The chip label carries the accessible name, so the glyph
              // is decorative. next/image adds nothing for a 14px static SVG.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                aria-hidden
                className={cn(logoWide ? "h-4 w-auto" : "h-3.5 w-3.5")}
              />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {!logoOnly && label}
            {leavesApp && (
              <SquareArrowOutUpRight
                className="h-3 w-3 opacity-55"
                aria-hidden
                strokeWidth={2}
              />
            )}
          </a>
        );
      })}
    </div>
  );
}
