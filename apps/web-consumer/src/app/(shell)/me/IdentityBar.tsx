"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Gem, Instagram, Phone } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { useConsumerClass } from "@/lib/class-context";
import { DIAMOND_LIST } from "@/lib/consumer-identity";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn, formatPhoneDisplay } from "@/lib/utils";

// ─── The identity header (MESITA-1079 v2 · -1619 · -1633 ·
//     -1636 · -1640 · -1646 · -1649 · -1650 · -1652 · -2040) ───────────────
//
// IT IS NOT A CARD (Pato, MESITA-1652): "this must be a header, top menu
// style, occupying the full width and fixed when scrolling. it must contain
// the photo, name, class, insta."
//
//   [80px photo, ringed]
//   [name]  [instagram]
//   [phone] [diamond]
//   ─────── band ───────
//
// TWO FACTS NOW, NOT ONE AXIS (Pato, MESITA-2040: "separate instagram and
// diamond… those are independent"). The right column used to be Class then
// Instagram — one rung and one door onto it. It is Instagram then Diamond,
// in that order, because that is the order Pato named them and because the
// door anyone can walk through should come before the one that has to be
// opened for you.
//
// FIXED BY FLEX, NOT BY `sticky`. Me renders `flex h-full flex-col` around a
// `flex-1 overflow-y-auto px-4` scroller. This bar is a `shrink-0` SIBLING
// above that scroller, so it never moves, spans the full width for free, and
// never fights the scroller's own gutter or z-index. `DiscoverModeNav` uses
// `sticky top-0` because it lives INSIDE its scroller; this one does not have
// to.
//
// WHAT IS NOT HERE, and why. The card was 235px; permanent chrome on a
// scrolling grid cannot cost a third of a phone viewport, so three things did
// not fit:
//
//   an eyebrow        a header that names itself in a strip is spending the
//                     page on a label
//   Public / Private  Settings owns the toggle, exclusively
//   age · sex · country   Profile owns name, photo, birthday
//
// None of the three is lost. All three stop being printed twice.
//
// THE BAR IS THE DOOR (gate decision, Pato, MESITA-1652). This reversed
// MESITA-1646's "the card displays and does nothing", because Instagram is
// the only connect door in the app and the invitation PIN has exactly one
// entrance. A display-only header plus deleted cells would have stranded both,
// silently, with every test green; that has already nearly happened once here.
// Under MESITA-2040 both facts ALSO have their own cells on Me — the chips are
// no longer the last path to either — and the chips stay anyway, because a
// fixed bar is one tap from anywhere and a cell has to be scrolled to.
//
// ONE FACT, ONE COLOUR. MESITA-1132 licensed colour to mean class and to live
// on the passport; the ladder died at MESITA-2040 and the Passport at
// MESITA-2043, so the licence is re-anchored here, on Diamond directly: the
// band, the ring and the wash carry DIAMOND and nothing else, and this header
// is the only place on Me that spends it. A guest who is not Diamond gets a neutral header — which
// is the same rule, not a weakening of it: the one coloured thing on the page
// is unambiguous precisely because it is now unconditional.
//
// The band and the ring stay `aria-hidden` on the stated ground that something
// says the fact in words. That something is the Diamond List CHIP's own label,
// inside this subtree ("Diamond List: You're on it", MESITA-2044).
//
// NO PLAN (decision: Pato, MESITA-1619). The header prints what is EARNED
// and PUBLIC; the plan is what you PAY. Plan is a cell in the grid below and
// this bar takes no plan handler.

/** One chip in the header's 2x2. */
const CHIP_CLASS =
  "border-border text-foreground relative inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold";

/** Expands the two interactive chips' tap area to the app's 44px floor
 *  (Docs › Design §D) without growing them visually. 36px chip + 4px per
 *  side = 44px, and 4px is exactly half the grid's own `gap-2` (8px), so
 *  two expanded neighbours' invisible hit-areas meet without overlapping
 *  (MESITA-1688). */
const TAP_TARGET_CLASS = "after:absolute after:inset-[-4px] after:content-['']";

export function IdentityBar({
  profile,
  loading,
  diamondSummary,
  diamondChip,
  instagramSummary,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  /** "You're on it" or "Ask to join" — the accessible half of the chip. */
  diamondSummary: string;
  /** "Diamond List" or "Ask to join" — what the chip shows. */
  diamondChip: string;
  /** "@handle", "Connected", or "Connect it". */
  instagramSummary: string;
}) {
  const { facts } = useConsumerClass();
  const diamond = facts.diamond;

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;
  // `formatPhoneDisplay` already exists for exactly this — its own doc says
  // it keeps a number from rendering as a raw digit run.
  const phoneDisplay = formatPhoneDisplay(profile?.phone) ?? "Not set";

  // The metal, or nothing. Not a helper in consumer-data: those took a
  // ClassKey and switched on four rungs, and there is one fact here.
  const metalFill = diamond ? "bg-tier-diamond" : "bg-border";

  return (
    <header
      aria-label={
        diamond
          ? `Your Mesita identity, on the ${DIAMOND_LIST}`
          : "Your Mesita identity"
      }
      aria-busy={loading || undefined}
      className="border-border bg-background/95 relative shrink-0 border-b backdrop-blur-xl"
    >
      {/* The wash — sits behind the content div below via DOM order (both
          `relative`, so paint order follows source order). Fades to
          transparent well before the band, so it never fights the band's own
          colour at the bottom edge. Diamond only. */}
      {diamond ? (
        <div
          className="wash-diamond pointer-events-none absolute inset-0"
          aria-hidden
        />
      ) : null}
      <div className="relative flex flex-col items-center gap-3.5 px-4 py-4">
        {loading ? (
          <>
            {/* The skeleton mirrors the DESTINATION (Docs › Design §D): 87px
                is the real avatar (80 + the 2px ring and 1.5px inset, both
                sides), and the same 2x2 at its real 36px. */}
            <div className="bg-muted h-[87px] w-[87px] shrink-0 animate-pulse rounded-full" />
            <div className="grid w-full grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted h-9 animate-pulse rounded-full"
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <span
              className={cn("shrink-0 rounded-full p-[2px]", metalFill)}
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

            {/* READING ORDER: Name · Instagram / Phone · Diamond. */}
            <div className="grid w-full grid-cols-2 gap-2">
              <span className={CHIP_CLASS}>
                <span className="truncate">{name}</span>
              </span>
              {/* The Instagram glyph carries its OWN brand gradient — platform
                  branding, a different axis than the metal, never gated by the
                  one-metal rule above. */}
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
                <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
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
                  chip keeps its slot so the 2x2 never reflows. */}
              <span className={CHIP_CLASS}>
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{phoneDisplay}</span>
              </span>
              {/* NO METAL FILL on the chip, on purpose: the band and the ring
                  are the two fill surfaces and a third inside the header turns
                  a law about meaning into decoration. The word reads in the
                  metal's INK instead, which is what lets the band stay
                  aria-hidden. */}
              <Link
                href={CONSUMER_ROUTES.mePages.diamond}
                aria-label={`${DIAMOND_LIST}: ${diamondSummary}`}
                className={cn(
                  CHIP_CLASS,
                  TAP_TARGET_CLASS,
                  "hover:bg-muted transition",
                  diamond && "text-diamond",
                )}
              >
                <Gem className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{diamondChip}</span>
                <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              </Link>
            </div>
          </>
        )}
      </div>

      {/* The band — full width, colour-only, hidden from assistive tech; the
          Diamond chip above states the fact in words. */}
      <div className={cn("h-2.5 w-full", metalFill)} aria-hidden />
    </header>
  );
}
