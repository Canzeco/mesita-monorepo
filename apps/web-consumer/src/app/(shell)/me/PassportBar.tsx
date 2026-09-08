"use client";

import Image from "next/image";
import { Instagram, MessageCircle } from "lucide-react";
import type { ConsumerProfile } from "@/lib/api/profile";
import { DefaultAvatar } from "@/components/consumer/DefaultAvatar";
import { classFillClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { SHELL_BAR_MIN_H } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

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
// THE METAL IS THE BAND AND THE RING, AND THAT IS ALL OF IT. Colour means
// class and lives on the passport, nowhere else on this page (MESITA-1132,
// Docs › Design §D). The passport is the bar now, so the band is the bar's
// own bottom edge, full width. The class CHIP deliberately carries NO metal —
// it says the rung in words. A third metal surface inside 62px would turn a
// law about meaning into decoration.
//
// THE BAND AND THE RING ARE `aria-hidden` on the stated ground that something
// says the class in words. That something is now the class chip's own label,
// inside this subtree — closer than it has been since MESITA-1650 put it on a
// cell further down the page.
/** One chip in the bar's 2x2. 28px is what fits inside SHELL_BAR_MIN_H with
 *  two rows and a 6px gap — measured, see the note at the call site. */
const CHIP_CLASS =
  "border-border text-foreground type-label inline-flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 font-semibold";

export function PassportBar({
  profile,
  loading,
  classLabel,
  instagramSummary,
  onOpenClass,
  onOpenInstagram,
}: {
  profile: ConsumerProfile | null;
  loading: boolean;
  /** The rung in words. Computed by Me, which already needs it. */
  classLabel: string;
  /** "@handle", "Connected", or "Connect it" — Me owns the precedence rule
   *  (a fresh connect beats a stale profile row). */
  instagramSummary: string;
  onOpenClass: () => void;
  onOpenInstagram: () => void;
}) {
  const { key } = useConsumerClass();

  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.full_name ||
    "Mesita member";
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <header
      aria-label={`Your Mesita passport, ${classLabel} class`}
      aria-busy={loading || undefined}
      className={cn(
        "border-border bg-background/95 flex shrink-0 flex-col border-b backdrop-blur-xl",
        SHELL_BAR_MIN_H,
      )}
    >
      {/* `flex-1`, not a height: the row absorbs whatever SHELL_BAR_MIN_H
          leaves after the 6px band, so the bar tracks the tab bar without a
          second number to keep in sync (MESITA-1654). */}
      <div className="flex flex-1 items-center gap-3 px-4">
        {loading ? (
          <>
            {/* The skeleton mirrors the DESTINATION (Docs › Design §D): 43px
                is the real avatar (36 + the 2px ring and 1.5px inset, both
                sides), 20px the real name. */}
            <div className="bg-muted h-[43px] w-[43px] shrink-0 animate-pulse rounded-full" />
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted h-7 animate-pulse rounded-full"
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
                <span className="bg-muted relative block h-9 w-9 overflow-hidden rounded-full">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt=""
                      fill
                      sizes="36px"
                      className="object-cover"
                    />
                  ) : (
                    <DefaultAvatar className="h-full w-full" />
                  )}
                </span>
              </span>
            </span>

            {/* A 2x2 INSIDE THE SAME 77px (Pato, MESITA-1655). The wireframe
                had a 104px centred avatar over the chips, which measures
                244px — 3.2x the height Pato asked for one issue earlier and
                within 9px of the card MESITA-1649/-1650 spent two issues
                removing. The composition moved inside the bar instead.
                Measured: 28px chips with a 6px gap total exactly 77px.

                THE COST, STATED: chips went 36px → 28px, so the two LIVE ones
                (Class, Instagram) have smaller tap targets. Name is display
                and WhatsApp is parked, so only those two pay it. Reverting is
                a height change, not a layout one. */}
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
              <span className={CHIP_CLASS}>
                <span className="truncate">{name}</span>
              </span>
              {/* PARKED, and it has to be. The consumer has no WhatsApp
                  anywhere: `consumers.phone` is the AUTH IDENTITY (see
                  api/profile.ts), `whatsapp_url` belongs to a place, and
                  `staff_whatsapp_sessions.phone_e164` is the STAFF phone.
                  Printing the auth phone here would also leak it — this
                  passport is public when `privacy_public` is on. */}
              <span
                className={cn(CHIP_CLASS, "opacity-60")}
                title="Coming soon"
                aria-label="WhatsApp: coming soon"
              >
                <MessageCircle className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">Soon</span>
              </span>
              {/* NO METAL on either live chip, on purpose — see the header
                  note. The rung in words is also what lets the band and ring
                  stay aria-hidden. Instagram first (MESITA-1653). */}
              <button
                type="button"
                onClick={onOpenInstagram}
                aria-label={`Instagram: ${instagramSummary}`}
                className={cn(CHIP_CLASS, "hover:bg-muted transition")}
              >
                <Instagram className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{instagramSummary}</span>
              </button>
              <button
                type="button"
                onClick={onOpenClass}
                aria-label={`Class: ${classLabel}`}
                className={cn(CHIP_CLASS, "hover:bg-muted transition")}
              >
                <span className="truncate">{classLabel}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* The metal band — full width now that the passport is the chrome.
          Colour-only and hidden from assistive tech; the class chip above
          states the rung in words. */}
      <div className={cn("h-1.5 w-full", classFillClass(key))} aria-hidden />
    </header>
  );
}
