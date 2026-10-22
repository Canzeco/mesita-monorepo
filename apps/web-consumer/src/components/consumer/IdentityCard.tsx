"use client";

import Link from "next/link";
import { CreditCard, Crown, UserRound } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import {
  CLASS_LABEL,
  PLAN_LABEL,
  type GuestClass,
  type GuestPlan,
} from "@/lib/guest-standing";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// ONE IDENTITY CARD (Pato, MESITA-2547: "that card at the top is the card.
// the card must display all public info from instagram to profile picture
// to name"). Me's header draws it for the guest (Instagram is a door there);
// Social's person card draws it for a member (Instagram is a fact: the full
// handle, MESITA-2590, or "die***" until the viewer shows their own,
// MESITA-2594). Never the phone: it is private and
// lives in Settings.
//
// CENTRED, FOUR BOXES IN THREE ROWS (Pato, MESITA-2595/2596 made them four
// boxes, name · instagram · class · plan; MESITA-2614: "try a different grid
// for this ... i just don't like it", and he picked "A · Pairs" from a board
// of four):
//
//                  (64px photo)
//   ( 👤 Diego                                 )
//   ( ◎ @diego · 1.2K followers                )
//   ( ♛ Class: VIP      ) ( ▭ Plan: Premium    )
//
// Name and Instagram keep the full width: they are the two strings that get
// long. Class and Plan share a row, Class left, the same order as the Class ·
// Plan tile pair below on Me. The column is the full width of the card (no
// cap), so on Me each half box is exactly one tile column (167px at 375px)
// and "Plan: Premium" fits. UNDER 360px THE PAIR STACKS: a half box would be
// 140px at 320px and ellipsize, so there the four boxes are four rows again.
// Social's person card is this component and gets the same grid.
//
// 36px tall (MESITA-2599:
// "make the boxes a bit shorter"; 40px before), and ONE
// text style, 14px semibold, in every box (Pato, MESITA-2599: "standardize
// the size of those letters inside the four boxes"); the defaults (Regular,
// Free) look exactly like the rest: same size, weight and ink (Pato:
// "standardize the font here"). Only VIP (filled) and Premium (ink border)
// stand out.
// Nothing truncates but the name and the Instagram label. No chevrons
// (Pato, MESITA-2604: "remove the > … just name … it looks really dirty"):
// a door on Me is still a link, it just does not draw an arrow.
//
// CLASS AND PLAN ARE TWO THINGS (MESITA-2553). Class is partnership status:
// Regular or VIP, through a partner, never sold; VIP filled, Regular muted,
// the Crown names it. Plan is the subscription, Free or Premium, under a
// card icon (never the gem, MESITA-2551); Premium outlined, Free muted.
// Plan is back on the card (MESITA-2595 reverses MESITA-2576). On Me both
// are doors — Class opens its explainer, Plan opens /me/plan; on Social both
// are facts.

/** One box of the card (MESITA-2596, MESITA-2599): 36px tall, 14px text, the
 *  full width of its grid cell (MESITA-2614: a whole row for name and
 *  Instagram, half a row each for Class and Plan). */
const CHIP_CLASS =
  "border-border text-foreground relative flex h-9 w-full min-w-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold";

/** Name and Instagram take the whole row; Class and Plan share one
 *  (MESITA-2614). */
const FULL_ROW_CLASS = "col-span-full";

/** Grows a box's tap area to the 44px floor without growing it visually
 *  (MESITA-1688). */
const TAP_TARGET_CLASS =
  "after:absolute after:inset-x-0 after:inset-y-[-4px] after:content-['']";

export type IdentityInstagram = {
  /** Me: "Insta: @handle · 25K followers" or "Insta: not connected"
   *  (MESITA-2606); Social: "@per*** · 1.2K followers" (MESITA-2594). */
  label: string;
  /** A door (Me) when set; a plain fact (Social) when not. */
  href?: string;
};

function InstagramBadge() {
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
        INSTAGRAM_ICON_GRADIENT_CLASS,
      )}
      aria-hidden
    >
      <Instagram className="h-3 w-3 text-white" aria-hidden />
    </span>
  );
}

/** The Class chip: a button on Me (opens the explainer), a fact on Social. */
function ClassChip({
  guestClass,
  onPress,
}: {
  guestClass: GuestClass;
  onPress?: () => void;
}) {
  const vip = guestClass === "vip";
  const label = CLASS_LABEL[guestClass];
  // Key and value on the box (Pato: "Class: Regular … mention the key val").
  const text = `Class: ${label}`;
  const className = cn(
    CHIP_CLASS,
    vip
      ? "bg-foreground text-background border-transparent"
      : "",
    onPress && cn(TAP_TARGET_CLASS, "transition", !vip && "hover:bg-muted"),
  );
  const body = (
    <>
      <Crown className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="truncate">{text}</span>
    </>
  );
  const aria = `Class: ${label}`;
  return onPress ? (
    <button
      type="button"
      onClick={onPress}
      aria-label={aria}
      className={className}
      data-identity-class={guestClass}
    >
      {body}
    </button>
  ) : (
    <span
      aria-label={aria}
      className={className}
      data-identity-class={guestClass}
    >
      {body}
    </span>
  );
}

/** The Plan chip: a link on Me (opens /me/plan), a fact on Social. */
function PlanChip({ plan, href }: { plan: GuestPlan; href?: string }) {
  const premium = plan === "premium";
  const label = PLAN_LABEL[plan];
  // Key and value on the box (Pato: "Plan: Free … mention the key val").
  const text = `Plan: ${label}`;
  const className = cn(
    CHIP_CLASS,
    premium && "border-foreground",
    href && cn(TAP_TARGET_CLASS, "hover:bg-muted transition"),
  );
  const body = (
    <>
      <CreditCard className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="truncate">{text}</span>
    </>
  );
  const aria = `Plan: ${label}`;
  return href ? (
    <Link
      href={href}
      aria-label={aria}
      className={className}
      data-identity-plan={plan}
    >
      {body}
    </Link>
  ) : (
    <span aria-label={aria} className={className} data-identity-plan={plan}>
      {body}
    </span>
  );
}

/** The name box: a link on Me (opens Me › Profile), a fact on Social. */
function NameBox({ name, href }: { name: string; href?: string }) {
  const className = cn(
    CHIP_CLASS,
    FULL_ROW_CLASS,
    href && cn(TAP_TARGET_CLASS, "hover:bg-muted transition"),
  );
  const body = (
    <>
      <UserRound className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      <span className="truncate">{name}</span>
    </>
  );
  return href ? (
    <Link
      href={href}
      aria-label={`Profile: ${name}`}
      className={className}
      data-identity-name
    >
      {body}
    </Link>
  ) : (
    <span className={className} data-identity-name>
      {body}
    </span>
  );
}

export function IdentityCard({
  name,
  avatarUrl,
  instagram,
  guestClass,
  onClassPress,
  plan,
  planHref,
  nameHref,
}: {
  name: string;
  avatarUrl: string | null;
  instagram: IdentityInstagram | null;
  /** Null hides the chip: never a guessed "Regular". */
  guestClass: GuestClass | null;
  /** Me only: the Class chip opens its explainer. */
  onClassPress?: () => void;
  /** Null hides the chip: never a guessed "Free". */
  plan: GuestPlan | null;
  /** Me only: the Plan chip opens the Plan page. */
  planHref?: string;
  /** Me only: the name box opens Me › Profile. */
  nameHref?: string;
}) {
  return (
    <div
      className="flex w-full flex-col items-center gap-2 text-center"
      data-identity-card
    >
      <span className="bg-border shrink-0 rounded-full p-[1.5px]" aria-hidden>
        <span className="bg-muted relative block h-16 w-16 overflow-hidden rounded-full">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <DefaultAvatar className="h-full w-full" />
          )}
        </span>
      </span>

      {/* Three rows: name, Instagram, then Class · Plan as a pair; one column
          under 360px (MESITA-2614). */}
      <div
        className="grid w-full min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2"
        data-identity-chips
      >
        <NameBox name={name} href={nameHref} />

        {instagram?.href ? (
          <Link
            href={instagram.href}
            aria-label={instagram.label}
            className={cn(
              CHIP_CLASS,
              FULL_ROW_CLASS,
              TAP_TARGET_CLASS,
              "hover:bg-muted transition",
            )}
            data-identity-instagram
          >
            <InstagramBadge />
            <span className="truncate">{instagram.label}</span>
          </Link>
        ) : instagram ? (
          <span
            className={cn(CHIP_CLASS, FULL_ROW_CLASS)}
            data-identity-instagram
          >
            <InstagramBadge />
            <span className="sr-only">Instagram:</span>
            <span className="truncate">{instagram.label}</span>
          </span>
        ) : null}

        {guestClass && (
          <ClassChip guestClass={guestClass} onPress={onClassPress} />
        )}

        {plan && <PlanChip plan={plan} href={planHref} />}
      </div>
    </div>
  );
}
