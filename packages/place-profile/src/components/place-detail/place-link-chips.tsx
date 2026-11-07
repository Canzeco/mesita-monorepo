"use client";

import type { ComponentType } from "react";
import { SquareArrowOutUpRight } from "lucide-react";

import type { PlaceActions } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { cn } from "../../lib/format";
import {
  PLACE_BUTTON_CLASS,
  PLACE_BUTTON_ICON_CLASS,
  PLACE_OUTLINE_CHIP_CLASS,
} from "../../lib/ui";


export function TagChips({ tags }: { tags: PlaceDetail["tags"] }) {
  // Render nothing when the place has no tags. Otherwise a flat, wrapping
  // cluster in the incoming sort_order (the adapter preserves the EF order).
  // OUTLINED, ACHROMATIC (MESITA-2636): the header facts' box, one style for
  // every tag. The per-facet tints and dots broke the consumer's
  // black-and-white rule (Docs › Design §D).
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => (
        <span key={t.slug} className={PLACE_OUTLINE_CHIP_CLASS}>
          {t.label}
        </span>
      ))}
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
  /** The brand's own solid colour under white (MESITA-3320, MESITA-3333);
   *  grey without one. */
  tone?: string;
  /** Draw the logo as the file paints it (Google's four-colour G) instead
   *  of white through a mask. */
  logoAsIs?: boolean;
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
      {chips.map(({ key, label, Icon, logo, logoWide, logoOnly, url, tone, logoAsIs }) => {
        // decision: trailing SquareArrowOutUpRight on web destinations so
        // chips read as "leaves the app" — skip tel: (Phone opens dialer).
        const leavesApp = !url.startsWith("tel:");
        const ariaLabel = logoOnly
          ? leavesApp
            ? `${label} (opens externally)`
            : label
          : undefined;
        // EACH LINK ON ITS BRAND'S SOLID COLOUR, WORDS AND MARK WHITE (Pato,
        // MESITA-3320: "Uber Eats must be green and so on"; MESITA-3333:
        // "darker with color ... uber eats with the fucking uber eats
        // logo"); a link with no tone keeps MESITA-2636's one grey button.
        const className = cn(
          grid
            ? PLACE_BUTTON_CLASS
            : "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
          tone ?? "bg-muted text-foreground hover:bg-muted/70",
          tone && "hover:opacity-90",
        );
        const body = (
          <>
            {logo && tone && !logoAsIs ? (
              // The brand mark painted white: the SVGs in /public/channels
              // are one colour, so a mask takes their shape and the chip's
              // text colour fills it (MESITA-3333). Decorative: the label
              // carries the name.
              <span
                aria-hidden
                className={cn("shrink-0 bg-current", grid ? PLACE_BUTTON_ICON_CLASS : "h-3.5 w-3.5")}
                style={{
                  maskImage: `url(${logo})`,
                  WebkitMaskImage: `url(${logo})`,
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                }}
              />
            ) : logo ? (
              // Real brand mark (SVG in /public/channels, brand colour baked
              // in). The chip label carries the accessible name, so the glyph
              // is decorative. next/image adds nothing for a 14px static SVG.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                aria-hidden
                className={cn(
                  logoWide
                    ? "h-4 w-auto"
                    : grid
                      ? PLACE_BUTTON_ICON_CLASS
                      : "h-3.5 w-3.5",
                )}
              />
            ) : (
              <Icon className={grid ? PLACE_BUTTON_ICON_CLASS : "h-3.5 w-3.5"} />
            )}
            {!logoOnly && <span className="truncate">{label}</span>}
            {leavesApp && (
              <SquareArrowOutUpRight
                className={cn("h-3 w-3", tone ? "opacity-80" : "opacity-55")}
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
        // A tel: chip is a plain native link (MESITA-2833): no blank target,
        // no scripted hop, so the tap opens the phone's dialer.
        if (!leavesApp) {
          return (
            <a key={key} href={url} aria-label={ariaLabel} className={className}>
              {body}
            </a>
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
