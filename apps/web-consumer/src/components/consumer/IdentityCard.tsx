"use client";

import Link from "next/link";
import { ChevronRight, CreditCard, Crown } from "lucide-react";
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
// Social's person card draws it for a member (Instagram is a fact, the
// handle hidden as "die•••", MESITA-2522). Never the phone: it is private and
// lives in Settings.
//
// PHOTO LEFT, three rows beside it (Pato, MESITA-2548: "PHOTO NAME / PHOTO
// INSTA / PHOTO CLASS & PLAN"):
//
//   (80px)  Diego
//   (photo) [◎ die••• · 1.2K followers]
//   (     ) [♛ VIP ›] [▭ Pro ›]          (chevrons on Me only)
//
// CLASS AND PLAN ARE TWO THINGS (Pato, MESITA-2553). Class is partnership
// status: Regular or VIP, through a partner, never sold. Plan is the
// subscription: Free or Pro. Each chip names its own dimension with its own
// icon (Crown, CreditCard) and aria-label, so the pair never reads as one
// ladder. Weight marks "special", not rank: VIP filled, Pro outlined, the two
// defaults equally muted. No gem anywhere (MESITA-2551). On Me the chips are
// doors (Class opens its explainer, Plan opens /me/plan); on Social they are
// facts.

/** One chip, Me's header vocabulary (MESITA-1652). */
const CHIP_CLASS =
  "border-border text-foreground relative inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold";

/** Grows a chip's tap area to the 44px floor without growing it visually
 *  (MESITA-1688). */
const TAP_TARGET_CLASS = "after:absolute after:inset-[-6px] after:content-['']";

export type IdentityInstagram = {
  /** "@handle", "Connect it", or the hidden "per••• · 1.2K followers". */
  label: string;
  /** A door (Me) when set; a plain fact (Social) when not. */
  href?: string;
};

export type IdentityStanding = { guestClass: GuestClass; plan: GuestPlan };

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

/** One standing chip: a button (Class on Me), a link (Plan on Me) or a fact. */
function StandingChip({
  icon,
  label,
  dimension,
  strong,
  filled,
  onPress,
  href,
  data,
}: {
  icon: React.ReactNode;
  label: string;
  dimension: "Class" | "Plan";
  strong: boolean;
  filled: boolean;
  onPress?: () => void;
  href?: string;
  data: Record<string, string>;
}) {
  const className = cn(
    CHIP_CLASS,
    filled
      ? "bg-foreground text-background border-transparent"
      : strong
        ? "border-foreground"
        : "text-muted-foreground font-medium",
    (onPress || href) && cn(TAP_TARGET_CLASS, "transition", !filled && "hover:bg-muted"),
  );
  const body = (
    <>
      {icon}
      <span className="truncate">{label}</span>
      {(onPress || href) && (
        <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
      )}
    </>
  );
  const aria = `${dimension}: ${label}`;
  if (href) {
    return (
      <Link href={href} aria-label={aria} className={className} {...data}>
        {body}
      </Link>
    );
  }
  if (onPress) {
    return (
      <button type="button" onClick={onPress} aria-label={aria} className={className} {...data}>
        {body}
      </button>
    );
  }
  return (
    <span aria-label={aria} className={className} {...data}>
      {body}
    </span>
  );
}

export function IdentityCard({
  name,
  avatarUrl,
  instagram,
  standing,
  onClassPress,
  planHref,
}: {
  name: string;
  avatarUrl: string | null;
  instagram: IdentityInstagram | null;
  /** Class and Plan. Null hides the row: never a guessed "Free"/"Regular". */
  standing: IdentityStanding | null;
  /** Me only: the Class chip opens its explainer. */
  onClassPress?: () => void;
  /** Me only: the Plan chip opens the Plan page. */
  planHref?: string;
}) {
  return (
    <div className="flex w-full items-center gap-4" data-identity-card>
      <span className="bg-border shrink-0 rounded-full p-[2px]" aria-hidden>
        <span className="bg-background block rounded-full p-[1.5px]">
          <span className="bg-muted relative block h-20 w-20 overflow-hidden rounded-full">
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
      </span>

      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        <p
          className="text-foreground w-full truncate text-lg leading-tight font-semibold"
          data-identity-name
        >
          {name}
        </p>

        {instagram?.href ? (
          <Link
            href={instagram.href}
            aria-label={`Instagram: ${instagram.label}`}
            className={cn(
              CHIP_CLASS,
              TAP_TARGET_CLASS,
              "hover:bg-muted transition",
            )}
          >
            <InstagramBadge />
            <span className="truncate">{instagram.label}</span>
            <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
          </Link>
        ) : instagram ? (
          <span className={CHIP_CLASS}>
            <InstagramBadge />
            <span className="sr-only">Instagram:</span>
            <span className="truncate">{instagram.label}</span>
          </span>
        ) : null}

        {standing && (
          <div className="flex flex-wrap gap-1.5" data-identity-standing>
            <StandingChip
              icon={<Crown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />}
              label={CLASS_LABEL[standing.guestClass]}
              dimension="Class"
              strong={standing.guestClass === "vip"}
              filled={standing.guestClass === "vip"}
              onPress={onClassPress}
              data={{ "data-identity-class": standing.guestClass }}
            />
            <StandingChip
              icon={<CreditCard className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />}
              label={PLAN_LABEL[standing.plan]}
              dimension="Plan"
              strong={standing.plan === "pro"}
              filled={false}
              href={planHref}
              data={{ "data-identity-plan": standing.plan }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
