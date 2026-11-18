"use client";

import Image from "next/image";
import { Outfit } from "next/font/google";
import { MesitaMark } from "@/components/brand/MesitaMark";

// THE PHOTO COVERS THE SCREEN (Pato, 2026-11-17, MESITA-4309: "Cover"):
// the terrace fills the whole frame, the wordmark at its top, the headline
// just above the white panel, and the panel is only as tall as the form,
// docked at the foot over the bar. No empty white under the legal line.
//
// THE FORM IS ON THE PAGE (Pato, 2026-11-17, MESITA-4286: "sign must already
// have phone and send code thing, not hidden. quick access … remove pop up
// modal … don't hide the bottom menu"): the photo is a band at the top with
// the wordmark and the headline, and the white panel under it already holds
// the title, the phone field and the send buttons. No cover-then-sheet, no
// X; one column that scrolls, so the keyboard never hides the field, and the
// shell's bar stays under it. The history below is the cover it replaced.
//
// Sign-in opened on a photo, not a form (MESITA-3650). The first screen is
// the cover, the wordmark, one line and ONE button, "Continue with phone number"
// (MESITA-3920, undoing MESITA-3751's Sign up + Log in: both opened the same
// form, and a tester read two buttons on the bottom edge as "scroll for
// more"). The block sits lifted off the bottom, with a line under the button
// that ends the screen. The button opens the sign-in form (the caller's
// children: the phone code, the only way in since MESITA-3875) as a sheet
// over the photo. The X lowers it back to the cover.
//
// It fills the MobileFrame card (flex-1, absolute layers), so it is the
// same on a phone and in the desktop visualizer. The keyboard shrinks the
// frame (--kb), which keeps the sheet above it.
//
// The name is the mark plus "Mesita" in Outfit 700, as the app's header
// writes it (ModeTabs), not the lockup's lowercase "mesita." (MESITA-3653).
const wordmarkFont = Outfit({ subsets: ["latin"], weight: "700" });

export function CoverAuthLayout({
  headline,
  title,
  subtitle,
  children,
  footer,
}: {
  headline: string;
  /** Overrides the panel title (the Pay QR door names its place). */
  title?: string;
  /** Under the panel title. */
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelTitle = title ?? "Continue with phone number";
  const panelSubtitle = subtitle ?? "We'll text you a code.";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black">
      {/* The photo stays put behind the column; only the column scrolls. */}
      <Image
        src="/auth/terrace.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 30rem, 100vw"
        // The photo shows as it is: no blur (MESITA-3746).
        className="object-cover object-[center_30%]"
      />
      {/* Legibility: a veil at the top for the logo and a deeper one
          toward the headline; the mountain stays clear. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent via-30% to-black/80"
      />

      <div className="scrollbar-thin-dark relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <span className="flex shrink-0 items-center gap-2 self-start p-5 text-white select-none">
          <MesitaMark className="h-7 w-7" />
          <span
            className={`${wordmarkFont.className} text-2xl leading-none tracking-[-0.03em]`}
          >
            Mesita
          </span>
        </span>
        <div aria-hidden className="min-h-24 flex-1" />
        <h1 className="font-display shrink-0 px-5 pb-10 text-3xl leading-[1.05] font-semibold tracking-[-0.02em] text-balance text-white">
          {headline}
        </h1>

        <section className="bg-card text-foreground relative -mt-6 flex shrink-0 flex-col rounded-t-[28px] px-6 pt-6 pb-8">
          <header className="mb-5">
            <h2 className="font-display text-2xl leading-tight font-semibold tracking-[-0.02em]">
              {panelTitle}
            </h2>
            <p className="text-muted-foreground mt-1 text-base leading-snug">
              {panelSubtitle}
            </p>
          </header>
          {children}
          {footer && (
            <p className="text-muted-foreground type-body mt-6 text-center">
              {footer}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
