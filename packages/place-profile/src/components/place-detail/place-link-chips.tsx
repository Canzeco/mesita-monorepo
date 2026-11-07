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
  /** The brand's colour for the mark alone (MESITA-3340); the chip stays
   *  grey. Ink without one. */
  mark?: string;
  /** Draw the logo as the file paints it (Google's four-colour G) instead
   *  of the mark colour through a mask. */
  logoAsIs?: boolean;
};

/** Two equal columns of the 44px place button (the Links box, MESITA-2619).
 *  The wrapping 32px pill cluster it could also draw had no caller since
 *  then and left with MESITA-3379: one chip, one size. */
export function ChannelChips({
  chips,
  onOpenLink,
}: {
  chips: ChannelChip[];
  onOpenLink?: PlaceActions["onOpenLink"];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {chips.map(({ key, label, Icon, logo, logoWide, logoOnly, url, mark, logoAsIs }) => {
        // decision: trailing SquareArrowOutUpRight on web destinations so
        // chips read as "leaves the app" — skip tel: (Phone opens dialer).
        const leavesApp = !url.startsWith("tel:");
        const ariaLabel = logoOnly
          ? leavesApp
            ? `${label} (opens externally)`
            : label
          : undefined;
        // EVERY LINK IS THE GREY CHIP, ONLY ITS MARK IN THE BRAND'S COLOUR
        // (Pato, MESITA-3340: "keep discrete gray buttons, but logos with
        // colors"; MESITA-3320's tints and MESITA-3333's solid fills are
        // gone: "too strong buttons is an incentive for them to leave the
        // app").
        const className = cn(PLACE_BUTTON_CLASS, "bg-muted text-foreground hover:bg-muted/70");
        const body = (
          <>
            {logo && mark && !logoAsIs ? (
              // The brand mark in its colour: the SVGs in /public/channels
              // are one colour, so a mask takes their shape and `mark`
              // fills it (MESITA-3333's mask, MESITA-3340's colour).
              // Decorative: the label carries the name.
              <span
                aria-hidden
                className={cn("shrink-0 bg-current", mark, PLACE_BUTTON_ICON_CLASS)}
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
                className={logoWide ? "h-4 w-auto" : PLACE_BUTTON_ICON_CLASS}
              />
            ) : (
              <Icon className={cn(PLACE_BUTTON_ICON_CLASS, mark)} />
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
