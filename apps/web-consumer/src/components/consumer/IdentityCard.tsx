"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// ONE IDENTITY CARD (Pato, MESITA-2547: "that card at the top is the card.
// the card must display all public info from instagram to profile picture
// to name"): the ringed picture, then the name and Instagram chips. Me's
// header draws it for the guest (Instagram is a door there); Social's
// person card draws it for a member (Instagram is a fact, the handle hidden
// as "die•••", MESITA-2522). Never the phone: it is private and lives in
// Settings.
//
//   [80px photo, ringed]
//   [name]  [instagram]

/** One chip, Me's header vocabulary (MESITA-1652). */
const CHIP_CLASS =
  "border-border text-foreground relative inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold";

/** Grows a chip's tap area to the 44px floor without growing it visually:
 *  36px + 4px a side, half the grid's gap, so neighbours never overlap
 *  (MESITA-1688). */
const TAP_TARGET_CLASS = "after:absolute after:inset-[-4px] after:content-['']";

export type IdentityInstagram = {
  /** "@handle", "Connect it", or the hidden "per••• · 1.2K followers". */
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

export function IdentityCard({
  name,
  avatarUrl,
  instagram,
  stacked = false,
}: {
  name: string;
  avatarUrl: string | null;
  instagram: IdentityInstagram | null;
  /** One chip per row, full width: Social's card, where the hidden handle
   *  and follower count must read whole (MESITA-2547). Me keeps the pair. */
  stacked?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3.5" data-identity-card>
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

      <div
        className={cn(
          "grid w-full gap-2",
          stacked ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        <span
          className={cn(CHIP_CLASS, !instagram && !stacked && "col-span-2")}
        >
          <span className="truncate">{name}</span>
        </span>
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
      </div>
    </div>
  );
}
