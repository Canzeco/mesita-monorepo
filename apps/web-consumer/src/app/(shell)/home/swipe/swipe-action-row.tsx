"use client";

import type { LucideIcon } from "lucide-react";
import { Heart, Store, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// The deck's action rail: circular, centred under the card.
//
// Four buttons: Skip · Place · Save · Go. It was five — Filter led the rail
// until the discovery filter surface was deleted (MESITA-1183). Five was the
// budget, so the slot stays free for whatever the rebuilt engine earns.
//
// THE LAST ONE IS A GATEWAY, NOT A VERB (MESITA-1072). It used to be Reserve,
// wired straight to ReservationSheet — one verb, and the narrowest of the
// three the product offers. It now opens GoSheet, which carries all three
// (Visit · Order · Reserve), the same set place detail pins in a bar.
//
// WHY "GO". It completes the rail's verb ladder — Skip → Save → Go, three
// verdicts on one card at escalating commitment — and it is the only
// affirmative that doesn't name one of its own children the way Book, Order
// or Visit would. Known imperfection, accepted: "go" means travel and Order
// comes to you; the colloquial "go for it" carries the commitment, and the
// sheet disambiguates on the first tap.
//
// WHY `Zap`. The rail is icon-only, so the glyph carries the whole load, and
// the obvious candidates are spoken for. `DoorOpen` already means WELCOME
// BONUS (reward-matrix, HelpModal). Right-pointing arrows and chevrons
// collide with the save gesture. `QrCode`/`ShoppingBag`/`CalendarCheck` are
// the three children — a parent wearing a child's glyph claims to BE that
// child. A checkmark competes with the heart, which already owns "yes".
// `Compass`/`Navigation`/`Route` all say travel, which lies about Order.
// `Zap` says NOW — the one property all three share and the one Save lacks
// (Save = later, Go = now) — and it is the only solid-reading glyph in a rail
// of four thin outline shapes. Cost, flagged not designed around: `Flame`
// marks the Swipe pill and the Home tab on this same screen, so there are two
// energy glyphs; those sit tinted in chrome bands, this one on a white circle.
//
// COLOUR IS NOT DECORATION HERE. The first pass gave each button its own hue
// (amber / rose / sky / pink / violet) and it read cheap for three measurable
// reasons, all fixed below:
//
//   1. Every token in this app lives in one narrow warm band — `--background`
//      is oklch(.985 .012 10), primary hue 5, muted hue 10, border hue 10.
//      Amber (~85), sky (~230) and violet (~290) are 75-280° away from
//      anything else in the product. An imported palette, not ours.
//   2. Skip (#ff2357) and Save (#fb2b7b) were hue TWINS — the two most
//      consequential controls, opposite in meaning, looking like a pair.
//   3. Five equally saturated rings cancelled the size hierarchy: sizing two
//      buttons up says "these matter", colouring all five equally says
//      "everything matters".
//
// So: the three utilities recede to neutral, Skip is neutral but heavier, and
// Save is the ONLY colour in the row. Hierarchy comes from weight and fill,
// which is what a light-theme surface actually has to work with — Tinder's
// neon reads as neon because it sits on black, and copying the hues without
// the surface copies the look while missing the logic.

type Variant = "utility" | "skip" | "save";

function SwipeActionButton({
  label,
  Icon,
  variant,
  onClick,
  disabled,
  filled,
  haspopup,
}: {
  label: string;
  Icon: LucideIcon;
  variant: Variant;
  onClick: () => void;
  /** Goes dead + dimmed. Parity with the mobile ActionBtn, which has always
   *  had this — an action that can't fire must not look like it can, or the
   *  guest taps twice and the second tap lands. */
  disabled?: boolean;
  /** Solid glyph — the saved heart. */
  filled?: boolean;
  /** Announces that this button opens a dialog instead of acting (Go). */
  haspopup?: boolean;
}) {
  const big = variant !== "utility";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-haspopup={haspopup ? "dialog" : undefined}
      title={label}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border-2 transition",
        "active:scale-90 motion-reduce:active:scale-100",
        "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        big ? "h-15 w-15" : "h-12 w-12",
        variant === "utility" &&
          "border-border bg-card text-muted-foreground hover:bg-muted shadow-rest",
        // Heavier than the utilities, still no hue — Skip is a decision, not
        // an error, so it must not read as destructive red.
        variant === "skip" &&
          "border-foreground/25 bg-card text-foreground/80 hover:bg-muted shadow-rest",
        // The one colour. Solid, so it wins the row outright.
        variant === "save" &&
          "border-primary bg-primary text-primary-foreground shadow-glow-sm hover:brightness-105",
      )}
    >
      <Icon
        className={cn(big ? "h-7 w-7" : "h-5 w-5", filled && "fill-current")}
        strokeWidth={2.25}
      />
    </button>
  );
}

type SwipeActionRowProps = {
  saved: boolean;
  onSkip: () => void;
  onOpenInfo: () => void;
  onSave: () => void;
  onGo: () => void;
};

export function SwipeActionRow({
  saved,
  onSkip,
  onOpenInfo,
  onSave,
  onGo,
}: SwipeActionRowProps) {
  return (
    <div className="mt-3 flex items-center justify-center gap-3.5">
      <SwipeActionButton
        label="Skip"
        Icon={X}
        variant="skip"
        onClick={onSkip}
      />
      <SwipeActionButton
        label="About this place"
        Icon={Store}
        variant="utility"
        onClick={onOpenInfo}
      />
      {/* The glyph fill carries the saved state — this button is already the
          row's only colour, so a second colour for "saved" would be noise. */}
      <SwipeActionButton
        label={saved ? "Saved" : "Save"}
        Icon={Heart}
        variant="save"
        onClick={onSave}
        filled={saved}
      />
      {/* The gateway. `aria-haspopup` because the tap opens a sheet rather
          than acting — the label alone ("Go") doesn't say that, and this is
          the one button in the rail whose tap isn't final. */}
      <SwipeActionButton
        label="Go — visit, order or reserve"
        Icon={Zap}
        variant="utility"
        onClick={onGo}
        haspopup
      />
    </div>
  );
}
