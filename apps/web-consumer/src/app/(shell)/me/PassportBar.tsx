"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Instagram, Phone } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { CLASS_MARK_ICON, classFillClass, classWashClass } from "@/lib/consumer-data";
import { CLASS_TEXT } from "@/lib/class-styles";
import { useConsumerClass } from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn, formatPhoneDisplay } from "@/lib/utils";

// ─── The Passport, as the page header (MESITA-1079 v2 · -1619 · -1633 ·
//     -1636 · -1640 · -1646 · -1649 · -1650 · -1652) ──────────────────────
//
// IT IS NOT A CARD ANY MORE (Pato, MESITA-1652): "this must be a header, top
// menu style, occupying the full width and fixed when scrolling. it must
// contain the photo, name, class, insta."
//
// That is where eight issues were already heading. MESITA-1640 gave the card
// four doors; -1646 made it display-only; -1649 cut it 303px → 235px; -1650
// moved the two axes out to cells. Each round shaved the card down. This one
// stops pretending it is a card.
//
//   [36px photo, ringed in the metal] [name] ——— [class] [instagram]
//   ───────────────────────────── metal band ─────────────────────────────
//
// FIXED BY FLEX, NOT BY `sticky`. Me renders `flex h-full flex-col` around a
// `flex-1 overflow-y-auto px-4` scroller. This bar is a `shrink-0` SIBLING
// above that scroller, so it never moves, spans the full width for free, and
// never fights the scroller's own gutter or z-index. `DiscoverModeNav` uses
// `sticky top-0` because it lives INSIDE its scroller; this one does not have
// to.
//
// 62px, AND THAT IS THE WHOLE ARGUMENT FOR WHAT IS NOT HERE. The card was
// 235px. Permanent chrome on a scrolling grid cannot cost a third of a phone
// viewport, so 56px of row plus the 6px band is the budget, and three things
// did not fit:
//
//   PASSPORT eyebrow  the bar IS the passport; a header that names itself in
//                     a 56px strip is spending 12% of the page on a label
//   Public / Private  the Passport CELL still opens the sheet, and privacy
//                     belongs with the document, not the chrome
//   age · sex · country   Profile owns name, photo, birthday
//
// None of the three is lost. All three stop being printed twice.
//
// THE BAR IS THE DOOR (gate decision, Pato, MESITA-1652). This reverses
// MESITA-1646's "the card displays and does nothing". The reversal was the
// question the gate asked, because Instagram is the only reach door in the
// app and the Class ladder carries "Join with Invitation" — Docs › Passport
// §C calls it the ONLY entrance for a 10-digit invite PIN. A display-only
// header plus deleted cells would have stranded both, silently, with every
// test green; that has already nearly happened once here.
//
// So the chips are real buttons. They are also STRICTLY BETTER than the cells
// they replace: a cell has to be scrolled to, and this bar never leaves.
// `PassportModal` keeps its own Instagram and Class rows, so the doors have
// two paths, exactly as they did when the cells existed.
//
// NO PLAN (decision: Pato, MESITA-1619). The Passport prints what is EARNED
// and PUBLIC. Class is earned and never purchasable; the plan is what you PAY
// — Docs › Passport §B: "It never prints on the Passport." Plan is a cell in
// the grid below and this bar takes no plan handler.
//
// THE METAL FILL IS THE BAND AND THE RING, AND THAT IS STILL ALL OF IT.
// Colour means class and lives on the passport, nowhere else on this page
// (MESITA-1132, Docs › Design §D). The passport is the bar now, so the band
// is the bar's own bottom edge, full width. The class CHIP still carries NO
// metal FILL — it says the rung in words. A third metal FILL surface inside
// 62px would turn a law about meaning into decoration.
//
// MESITA-1688 (Pato: "add colors here") spends more of that same budget two
// other ways, neither a fill. A WASH (classWashClass) — the metal felt
// across the whole header background, not just at a hard edge — because a
// 2px ring and a 6-8px band read as trim, not as "this is the one colourful
// object in the app" the law's own reasoning calls for. And INK: the class
// word finally reads in its own tier colour (CLASS_TEXT), which globals.css
// already built and tuned to be text ("tuned only to clear 4.5:1 as ink on
// card") — nothing on the passport used it that way until now. The
// Instagram chip's glyph also picks up its own established brand gradient
// (INSTAGRAM_ICON_GRADIENT_CLASS, already used elsewhere for the same icon)
// — a different axis than class, never gated by this rule.
//
// THE BAND AND THE RING ARE `aria-hidden` on the stated ground that something
// says the class in words. That something is now the class chip's own label,
// inside this subtree — closer than it has been since MESITA-1650 put it on a
// cell further down the page.
/** One chip in the header's 2x2. Back to 36px now that the header is a hero
 *  block rather than a bar (MESITA-1656) — the 28px MESITA-1655 needed to fit
 *  two rows inside 77px was the tap-target cost of that constraint. */
const CHIP_CLASS =
  "border-border text-foreground relative inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold";

/** Expands the two interactive chips' tap area to the app's 44px floor
 *  (Docs › Design §D) without growing them visually. 36px chip + 4px per
 *  side = 44px, and 4px is exactly half the grid's own `gap-2` (8px), so
 *  two expanded neighbours' invisible hit-areas meet without overlapping
 *  (MESITA-1688). */
const TAP_TARGET_CLASS = "after:absolute after:inset-[-4px] after:content-['']";

export function PassportBar({
  profile,
  loading,
  classLabel,
  instagramSummary,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  /** The rung in words. Computed by Me, which already needs it. */
  classLabel: string;
  /** "@handle", "Connected", or "Connect it" — Me owns the precedence rule
   *  (a fresh connect beats a stale profile row). */
  instagramSummary: string;
}) {
  const { key } = useConsumerClass();
  const classTextClass = CLASS_TEXT[key];

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;
  // `formatPhoneDisplay` already exists for exactly this — its own doc says
  // it keeps a number from "rendering as a raw digit run on the passport".
  const phoneDisplay = formatPhoneDisplay(profile?.phone) ?? "Not set";

  return (
    <header
      aria-label={`Your Mesita passport, ${classLabel} class`}
      aria-busy={loading || undefined}
      className="border-border bg-background/95 relative shrink-0 border-b backdrop-blur-xl"
    >
      {/* The wash (MESITA-1688) — sits behind the content div below via DOM
          order (both `relative`, so paint order follows source order). Fades
          to transparent well before the band, so it never fights the band's
          own colour at the bottom edge. */}
      <div
        className={cn("pointer-events-none absolute inset-0", classWashClass(key))}
        aria-hidden
      />
      {/* A HERO BLOCK, NOT A BAR (Pato, MESITA-1656: "Must be like this",
          re-sending the wireframe after MESITA-1655 built it inside the 77px
          bar instead). Measured as drawn: 254px, and with the tab bar that is
          41% of an 812px viewport in permanent chrome at the 112px avatar it
          shipped with. Raised, overruled, recorded — a decision, not an
          accident. MESITA-1657 brought the avatar to 80px, so it is 222px.

          SHELL_BAR_MIN_H went with it. MESITA-1654 added it so the two bars
          would share ONE number instead of matching by coincidence; they no
          longer match by design, and a shared constant with one user is a
          literal in a costume. */}
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
              className={cn(
                "shrink-0 rounded-full p-[2px]",
                classFillClass(key),
              )}
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

            {/* READING ORDER IS THE DRAWING'S: Name · Class / WhatsApp ·
                Instagram. That flips MESITA-1653 ("insta first, class
                second"), which was a left-right call on a single ROW and does
                not survive a 2x2. */}
            <div className="grid w-full grid-cols-2 gap-2">
              <span className={CHIP_CLASS}>
                <span className="truncate">{name}</span>
              </span>
              <Link
                href={CONSUMER_ROUTES.mePages.class}
                aria-label={`Class: ${classLabel}`}
                className={cn(
                  CHIP_CLASS,
                  TAP_TARGET_CLASS,
                  "hover:bg-muted transition",
                  classTextClass,
                )}
              >
                <CLASS_MARK_ICON className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{classLabel}</span>
                <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              </Link>
              {/* THE LOGIN PHONE (Pato, MESITA-1657: "they made login with
                  phone number"). This chip was parked as WhatsApp, and
                  MESITA-1655 argued against printing the phone because the
                  passport is public when `privacy_public` is on. That was
                  WRONG FOR THIS SURFACE: PassportBar renders only from
                  ProfileClient — the /me page, behind (shell)/layout's
                  getUser() wall — so it is the owner reading their own
                  account. `privacy_public` governs how they appear to OTHER
                  people; it says nothing about their own page. No publishing,
                  no leak.

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
              {/* NO METAL FILL on either live chip, on purpose — see the
                  header note. The rung in words is also what lets the band
                  and the ring stay aria-hidden. The Instagram glyph below
                  carries its OWN brand gradient (MESITA-1688) — a different
                  axis than class, not gated by the metal-fill rule. */}
              <Link
                href={CONSUMER_ROUTES.mePages.instagram}
                aria-label={`Instagram: ${instagramSummary}`}
                className={cn(CHIP_CLASS, TAP_TARGET_CLASS, "hover:bg-muted transition")}
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
            </div>
          </>
        )}
      </div>

      {/* The metal band — full width now that the passport is the chrome.
          Colour-only and hidden from assistive tech; the class chip above
          states the rung in words. Deepened 1.5→2.5 (MESITA-1688) as part of
          spending more of the same colour budget; still the second of
          exactly two metal FILL surfaces. */}
      <div className={cn("h-2.5 w-full", classFillClass(key))} aria-hidden />
    </header>
  );
}
