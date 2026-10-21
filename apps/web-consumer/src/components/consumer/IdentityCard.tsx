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
// PHOTO LEFT, THEN NAME, THEN ONE ROW OF CHIPS (Pato, MESITA-2574:
// "Profile Picture · Name · (Instagram · Instagram Followers) · Plan ·
// Class", and "the header must be white and smaller shorter"):
//
//   (56px)  Diego
//   (photo) [◎ die••• · 1.2K followers] [▭ Premium] [♛ VIP]
//
// The chips wrap to a second line when the row runs out; nothing truncates
// but the Instagram label. It was three rows beside an 80px photo
// (MESITA-2548).
//
// CLASS AND PLAN ARE TWO THINGS (Pato, MESITA-2553). Class is partnership
// status: Regular or VIP, through a partner, never sold. Plan is the
// subscription: Free or Premium. Each chip names its own dimension with its
// own icon (CreditCard, Crown) and aria-label, so the pair never reads as one
// ladder. Weight marks "special", not rank: VIP filled, Premium outlined, the
// two defaults equally muted. No gem anywhere (MESITA-2551). Plan comes
// before Class (MESITA-2574). On Me both are doors — Plan opens /me/plan,
// Class its explainer; on Social both are facts. Plan is back on Me
// (MESITA-2574 reverses MESITA-2559, "its just for the social").

/** One chip, Me's header vocabulary (MESITA-1652). */
const CHIP_CLASS =
  "border-border text-foreground relative inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold";

/** Grows a chip's tap area to the 44px floor without growing it visually
 *  (MESITA-1688). */
const TAP_TARGET_CLASS =
  "after:absolute after:inset-x-[-4px] after:inset-y-[-8px] after:content-['']";

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
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
        INSTAGRAM_ICON_GRADIENT_CLASS,
      )}
      aria-hidden
    >
      <Instagram className="h-2.5 w-2.5 text-white" aria-hidden />
    </span>
  );
}

/** One standing chip: a link (Plan on Me), a button (Class on Me) or a fact. */
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
  const door = Boolean(onPress || href);
  const className = cn(
    CHIP_CLASS,
    filled
      ? "bg-foreground text-background border-transparent"
      : strong
        ? "border-foreground"
        : "text-muted-foreground font-medium",
    door && cn(TAP_TARGET_CLASS, "transition", !filled && "hover:bg-muted"),
  );
  const body = (
    <>
      {icon}
      <span className="truncate">{label}</span>
      {door && (
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
      <button
        type="button"
        onClick={onPress}
        aria-label={aria}
        className={className}
        {...data}
      >
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
  planHref,
  onClassPress,
}: {
  name: string;
  avatarUrl: string | null;
  instagram: IdentityInstagram | null;
  /** Plan and Class. Null hides them: never a guessed "Free"/"Regular". */
  standing: IdentityStanding | null;
  /** Me only: the Plan chip opens the Plan page. */
  planHref?: string;
  /** Me only: the Class chip opens its explainer. */
  onClassPress?: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-3" data-identity-card>
      <span className="bg-border shrink-0 rounded-full p-[1.5px]" aria-hidden>
        <span className="bg-muted relative block h-14 w-14 overflow-hidden rounded-full">
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

      <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
        <p
          className="text-foreground w-full truncate text-base leading-tight font-semibold"
          data-identity-name
        >
          {name}
        </p>

        <div className="flex max-w-full flex-wrap gap-1.5" data-identity-chips>
          {instagram?.href ? (
            <Link
              href={instagram.href}
              aria-label={`Instagram: ${instagram.label}`}
              className={cn(
                CHIP_CLASS,
                TAP_TARGET_CLASS,
                "hover:bg-muted transition",
              )}
              data-identity-instagram
            >
              <InstagramBadge />
              <span className="truncate">{instagram.label}</span>
              <ChevronRight
                className="h-3 w-3 shrink-0 opacity-60"
                aria-hidden
              />
            </Link>
          ) : instagram ? (
            <span className={CHIP_CLASS} data-identity-instagram>
              <InstagramBadge />
              <span className="sr-only">Instagram:</span>
              <span className="truncate">{instagram.label}</span>
            </span>
          ) : null}

          {standing && (
            <>
              <StandingChip
                icon={
                  <CreditCard
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                }
                label={PLAN_LABEL[standing.plan]}
                dimension="Plan"
                strong={standing.plan === "premium"}
                filled={false}
                href={planHref}
                data={{ "data-identity-plan": standing.plan }}
              />
              <StandingChip
                icon={
                  <Crown
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                }
                label={CLASS_LABEL[standing.guestClass]}
                dimension="Class"
                strong={standing.guestClass === "vip"}
                filled={standing.guestClass === "vip"}
                onPress={onClassPress}
                data={{ "data-identity-class": standing.guestClass }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
