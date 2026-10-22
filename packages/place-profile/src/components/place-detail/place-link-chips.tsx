"use client";

import type { ComponentType } from "react";
import { SquareArrowOutUpRight } from "lucide-react";

import type { PlaceActions } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";

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
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  logo?: string;
  logoWide?: boolean;
  logoOnly?: boolean;
  url: string;
};

export function ChannelChips({
  chips,
  onOpenLink,
  grid = false,
}: {
  chips: ChannelChip[];
  onOpenLink?: PlaceActions["onOpenLink"];
  /** Two equal columns of 44px buttons instead of a wrapping pill cluster
   *  (the Links box, MESITA-2619). */
  grid?: boolean;
}) {
  return (
    <div className={grid ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
      {chips.map(({ key, label, Icon, logo, logoWide, logoOnly, url }) => {
        // decision: trailing SquareArrowOutUpRight on web destinations so
        // chips read as "leaves the app" — skip tel: (Phone opens dialer).
        const leavesApp = !url.startsWith("tel:");
        const ariaLabel = logoOnly
          ? leavesApp
            ? `${label} (opens externally)`
            : label
          : undefined;
        const className = cn(
          "inline-flex items-center gap-1.5 border text-xs font-semibold transition",
          grid
            ? "h-11 min-w-0 justify-center rounded-lg px-3"
            : "rounded-full px-3 py-2",
          key in CHANNEL_CLAY
            ? CHANNEL_CLAY[key as keyof typeof CHANNEL_CLAY]
            : "border-border bg-paper text-foreground hover:bg-muted",
        );
        const body = (
          <>
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
            {!logoOnly && <span className="truncate">{label}</span>}
            {leavesApp && (
              <SquareArrowOutUpRight
                className="h-3 w-3 opacity-55"
                aria-hidden
                strokeWidth={2}
              />
            )}
          </>
        );
        if (!onOpenLink) {
          return (
            <span
              key={key}
              aria-disabled="true"
              tabIndex={-1}
              aria-label={ariaLabel}
              className={className}
            >
              {body}
            </span>
          );
        }
        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={ariaLabel}
            className={className}
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                event.button !== 0
              ) {
                return;
              }
              event.preventDefault();
              onOpenLink(url);
            }}
          >
            {body}
          </a>
        );
      })}
    </div>
  );
}
