"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Phone } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn, formatPhoneDisplay } from "@/lib/utils";

// ─── The identity header (MESITA-1079 v2 · -1619 · -1633 ·
//     -1636 · -1640 · -1646 · -1649 · -1650 · -1652 · -2040 · -2087) ───────
//
// IT IS NOT A CARD (Pato, MESITA-1652): "this must be a header, top menu
// style, occupying the full width and fixed when scrolling. it must contain
// the photo, name, insta."
//
//   [80px photo, ringed]
//   [name]  [instagram]
//   [     phone      ]
//   ─────── band ───────
//
// ONE FACT IN THE HEADER: Instagram. The header is neutral for every guest,
// and the ring and the band are plain structure — a frame around the photo
// and a rule under the header — not a colour that means something.
//
// FIXED BY FLEX, NOT BY `sticky`. Me renders `flex h-full flex-col` around a
// `flex-1 overflow-y-auto px-4` scroller. This bar is a `shrink-0` SIBLING
// above that scroller, so it never moves, spans the full width for free, and
// never fights the scroller's own gutter or z-index. `ModeRail` uses
// `sticky top-0` because it lives INSIDE its scroller; this one does not have
// to.
//
// WHAT IS NOT HERE, and why. The card was 235px; permanent chrome on a
// scrolling grid cannot cost a third of a phone viewport, so two things do
// not fit:
//
//   an eyebrow            a header that names itself in a strip is spending
//                         the page on a label
//   age · sex · country   Profile owns name, photo, birthday
//
// Neither is lost: the eyebrow said nothing, and Profile prints the rest.
//
// THE BAR IS THE DOOR (gate decision, Pato, MESITA-1652). This reversed
// MESITA-1646's "the card displays and does nothing", because Instagram is
// the only connect door in the app. The Instagram cell on the grid below is a
// second path to the same page, and the chip stays anyway: a fixed bar is one
// tap from anywhere and a cell has to be scrolled to.

/** One chip in the header's 2x2. */
const CHIP_CLASS =
  "border-border text-foreground relative inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold";

/** Expands the interactive chip's tap area to the app's 44px floor
 *  (Docs › Design §D) without growing it visually. 36px chip + 4px per
 *  side = 44px, and 4px is exactly half the grid's own `gap-2` (8px), so
 *  two expanded neighbours' invisible hit-areas meet without overlapping
 *  (MESITA-1688). */
const TAP_TARGET_CLASS = "after:absolute after:inset-[-4px] after:content-['']";

export function IdentityBar({
  profile,
  loading,
  instagramSummary,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  /** "@handle", "Connected", or "Connect it". */
  instagramSummary: string;
}) {
  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;
  // `formatPhoneDisplay` already exists for exactly this — its own doc says
  // it keeps a number from rendering as a raw digit run.
  const phoneDisplay = formatPhoneDisplay(profile?.phone) ?? "Not set";

  return (
    <header
      aria-label="Your Mesita identity"
      aria-busy={loading || undefined}
      className="border-border bg-background/95 relative shrink-0 border-b backdrop-blur-xl"
    >
      <div className="relative flex flex-col items-center gap-3.5 px-4 py-4">
        {loading ? (
          <>
            {/* The skeleton mirrors the DESTINATION (Docs › Design §D): 87px
                is the real avatar (80 + the 2px ring and 1.5px inset, both
                sides), and the same three chips at their real 36px. */}
            <div className="bg-muted h-[87px] w-[87px] shrink-0 animate-pulse rounded-full" />
            <div className="grid w-full grid-cols-2 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "bg-muted h-9 animate-pulse rounded-full",
                    i === 2 && "col-span-2",
                  )}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <span
              className="bg-border shrink-0 rounded-full p-[2px]"
              aria-hidden
            >
              <span className="bg-background block rounded-full p-[1.5px]">
                <span className="bg-muted relative block h-20 w-20 overflow-hidden rounded-full">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <DefaultAvatar className="h-full w-full" />
                  )}
                </span>
              </span>
            </span>

            {/* READING ORDER: Name · Instagram / Phone. */}
            <div className="grid w-full grid-cols-2 gap-2">
              <span className={CHIP_CLASS}>
                <span className="truncate">{name}</span>
              </span>
              {/* The Instagram glyph carries its OWN brand gradient — platform
                  branding, the one colour on this header. */}
              <Link
                href={CONSUMER_ROUTES.mePages.instagram}
                aria-label={`Instagram: ${instagramSummary}`}
                className={cn(
                  CHIP_CLASS,
                  TAP_TARGET_CLASS,
                  "hover:bg-muted transition",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    INSTAGRAM_ICON_GRADIENT_CLASS,
                  )}
                  aria-hidden
                >
                  <Instagram className="h-3 w-3 text-white" aria-hidden />
                </span>
                <span className="truncate">{instagramSummary}</span>
                <ChevronRight
                  className="h-3 w-3 shrink-0 opacity-60"
                  aria-hidden
                />
              </Link>
              {/* THE LOGIN PHONE (Pato, MESITA-1657: "they made login with
                  phone number").

                  DISPLAY, NOT A DOOR. api/profile.ts: the phone is "not
                  editable from the profile sheet" — it is the auth identity,
                  set at sign-in and mirrored by consumer-update-profile. A
                  chip that opened an editor would promise a surface that does
                  not exist, so it states a fact, like the name beside it.

                  "Not set" covers the window before the EF mirrors
                  auth.user.phone into consumers.phone on a new account; the
                  chip keeps its slot so the grid never reflows. */}
              <span className={cn(CHIP_CLASS, "col-span-2")}>
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{phoneDisplay}</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* The band — a full-width rule that closes the header. Structure, not
          a signal; hidden from assistive tech because it says nothing. */}
      <div className="bg-border h-2.5 w-full" aria-hidden />
    </header>
  );
}
