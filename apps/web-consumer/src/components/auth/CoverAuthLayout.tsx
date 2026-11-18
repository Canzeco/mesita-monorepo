"use client";

import Image from "next/image";
import { Outfit } from "next/font/google";
import { MesitaMark } from "@/components/brand/MesitaMark";

// QUIET (Pato, 2026-11-18, MESITA-4317: "Make this far cleaner";
// /plan-design-review, mock A): the headline, the value line, the phone
// field, one green button and one quiet terms line. The default line is the
// value in one sentence (Pato: "Discovery, reservations, discounts, and
// gifts … the mobile app for restaurants and cafés and bars"), not how the
// code comes; the Pay QR and gift doors pass their own. No "Call me instead".
//
// FULL BLEED (Pato, 2026-11-17, MESITA-4309: "Cover", then "make a better
// design for this. wtf is that", and he picked A of three mocks): one
// surface. The terrace fills the whole screen, the wordmark at its top; the
// headline, one line, the phone field, Text me the code, Call me instead
// and the terms sit on the photo's dark foot. No white sheet and no second
// title ("Continue with phone number" said a different thing from the
// headline), so nothing is left empty. The form is styled for the photo
// (PhoneOtpForm): white field, green button, white links.
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

/** The value in one sentence, under the cover's and the welcome's headline.
 *  No city (Pato, 2026-11-18, MESITA-4328: "don't mention monterrey"); no
 *  place count until it is true (262 Mesita places that day, not 10,000). */
export const VALUE_LINE =
  "Discovery, reservations, discounts and gifts at restaurants, cafés and bars.";

export function CoverAuthLayout({
  headline,
  title,
  subtitle,
  children,
  footer,
}: {
  headline: string;
  /** The line under the headline (the Pay QR door names its place). */
  title?: string;
  /** The line when there is no title. */
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const line = title ?? subtitle ?? VALUE_LINE;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black text-white">
      {/* The photo stays put behind the column; only the column scrolls. */}
      <Image
        src="/auth/terrace.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 30rem, 100vw"
        // The photo shows as it is: no blur (MESITA-3746).
        className="object-cover object-[center_32%]"
      />
      {/* Legibility: a light veil at the top for the wordmark, clear
          through the faces and the mountain, then a deep fade under the
          headline and the form. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.42)_0%,transparent_22%,transparent_34%,rgb(0_0_0/0.72)_58%,rgb(0_0_0/0.9)_100%)]"
      />

      <div className="scrollbar-thin-dark relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <span className="flex shrink-0 items-center gap-2 self-start p-5 select-none">
          <MesitaMark className="h-7 w-7" />
          <span
            className={`${wordmarkFont.className} text-2xl leading-none tracking-[-0.03em]`}
          >
            Mesita
          </span>
        </span>

        <section className="mt-auto shrink-0 px-5 pt-16 pb-6">
          <h1 className="font-display text-[2rem] leading-[1.04] font-semibold tracking-[-0.02em] text-balance">
            {headline}
          </h1>
          <p className="mt-2 text-base leading-snug text-white/80">{line}</p>
          <div className="mt-6">{children}</div>
          {footer && (
            <p className="mt-4 text-center text-xs leading-relaxed text-white/50">
              {footer}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
