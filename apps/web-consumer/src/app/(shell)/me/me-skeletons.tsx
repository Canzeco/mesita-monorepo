import type { ReactNode } from "react";

import { Skeleton, SkeletonLine } from "@/components/shared";
import {
  IDENTITY_BOXES,
  IDENTITY_BOX_SPAN,
  IDENTITY_CARD_CLASS,
  IDENTITY_CHIP_CLASS,
  IDENTITY_GRID_CLASS,
  IDENTITY_PHOTO_CLASS,
  IDENTITY_RING_CLASS,
} from "@/components/consumer/identity-card-layout";
import { ICON_CHIP_CLASS } from "@/components/consumer/me/settings-rows";
import { cn } from "@/lib/utils";

// ─── Me's loading silhouettes (MESITA-2701) ─────────────────────────────────
//
// Pato, MESITA-2701: "the placeholders must be similar to the page you are
// loading, like the sizes". Each block here is the box of the real element
// it stands in for, in the same order, so nothing jumps when the data lands.
//
// THE FRAME IS REAL, THE DATA IS NOT. Bands, card frames, eyebrows, titles,
// captions and the back button are drawn as themselves; what the page is
// still waiting for — the guest's photo and facts — and every door (a row
// that links, a switch) is a muted block at that element's size, inert.
// Text bars sit on the real line's own line-height (SkeletonLine), never a
// guessed px. Long fixed words a bar cannot know the wrap of (Plan's perks,
// Instagram's pitch) are drawn as themselves too, so they wrap where the
// page's do.
//
// NOT A CLIENT MODULE: the route loading.tsx files are server components
// and import these directly; IdentityBar imports them on the client.

/** Me's app bar (IdentityBar): full-width white paper, a hairline under it,
 *  fixed above the grid by flex. Shared so the bar and its skeleton are one
 *  box. */
export const IDENTITY_BAR_CLASS =
  "border-border bg-card relative shrink-0 border-b";
/** The bar's body: the card on the tiles' 16px edge, 12px above and below. */
export const IDENTITY_BAR_BODY_CLASS =
  "relative flex flex-col items-center px-4 py-3";

/** IdentityCard while the profile loads: the 64px photo in its 1.5px ring
 *  (67px), then the four 36px boxes in three rows — name, Class · Plan,
 *  Instagram — one column under 360px (MESITA-2614, MESITA-2621). Every
 *  class and the row order are the card's own (identity-card-layout.ts),
 *  so this is IdentityCard's boxes, empty (Pato, MESITA-2701: "the
 *  placeholders must be similar to the page you are loading, like the
 *  sizes"). */
export function IdentityCardSkeleton() {
  return (
    <div aria-hidden className={IDENTITY_CARD_CLASS}>
      <div className={IDENTITY_RING_CLASS}>
        <Skeleton className={IDENTITY_PHOTO_CLASS} />
      </div>
      <div className={IDENTITY_GRID_CLASS}>
        {IDENTITY_BOXES.map((box) => (
          <Skeleton
            key={box}
            className={cn(
              IDENTITY_CHIP_CLASS,
              "border-transparent",
              IDENTITY_BOX_SPAN[box],
            )}
          />
        ))}
      </div>
    </div>
  );
}

/** The whole app bar, for /me's loading.tsx. */
export function IdentityBarSkeleton() {
  return (
    <div className={IDENTITY_BAR_CLASS}>
      <div className={IDENTITY_BAR_BODY_CLASS}>
        <IdentityCardSkeleton />
      </div>
    </div>
  );
}

/** A Plan or Class row while the guest's own is unknown (PlanModal's
 *  PlanRow, ClassSheet's ClassRow): px-4 py-3, the 36px icon chip, the
 *  title, then `children`: the fixed lines as themselves. */
export function StandingRowSkeleton({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className={ICON_CHIP_CLASS} />
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {children}
      </div>
    </div>
  );
}

/** One settings row (settings-rows.tsx: SettingsInfoRow, SettingsLinkRow,
 *  SocialNameRow, Contact's links, Instagram's photo switch): px-4 py-3, the
 *  36px icon chip, a 14px label over an 11px line, and the 40×24 switch
 *  when the row has one.
 *
 *  A SWITCH ROW'S WORDS ARE ITS OWN (MESITA-2701). SocialNameRow and the
 *  photo switch paint their default line before their read lands, and that
 *  line wraps — "You're visible in the Social feed" is two lines at 320px,
 *  the photo line two at every width — so pass `label` and `sub` and they are
 *  drawn as themselves, wrapping where the row's do. Without them the row is
 *  two bars, for a row whose one-line words are a door or data. */
export function SettingsRowSkeleton({
  label,
  sub,
  toggle = false,
}: {
  label?: string;
  sub?: string;
  toggle?: boolean;
}) {
  return (
    <div aria-hidden className="flex w-full items-center gap-3 px-4 py-3">
      <Skeleton className={ICON_CHIP_CLASS} />
      <span className="min-w-0 flex-1">
        {label ? (
          <span className="block text-sm font-semibold">{label}</span>
        ) : (
          <SkeletonLine className="text-sm" bar="w-24" />
        )}
        {sub ? (
          <span className="text-muted-foreground type-label block">{sub}</span>
        ) : (
          <SkeletonLine className="type-label" bar="w-2/3" />
        )}
      </span>
      {toggle && <Skeleton className="h-6 w-10 shrink-0 rounded-full" />}
    </div>
  );
}
