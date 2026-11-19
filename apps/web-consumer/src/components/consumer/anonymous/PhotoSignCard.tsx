"use client";

import Image from "next/image";
import { Outfit } from "next/font/google";
import { MesitaMark } from "@/components/brand/MesitaMark";

// EVERY SIGN-IN MODAL WEARS THE MOUNTAIN (Pato, 2026-11-18, MESITA-4338:
// "all the modals must display that stupid background of the mountain"):
// the welcome (WelcomeModal) and the gate (SignGateModal) are this one card.
// The terrace under the Cerro de la Silla, the sign-in cover's photo, 4:5,
// full bleed, no blur (MESITA-3746); a veil at the top holds the mark and
// the wordmark, a deep fade at the bottom holds the headline and its line
// in white, a white Sign in, and a plain white second way (MESITA-4317).

// The wordmark as the header and the sign-in cover write it (MESITA-3653).
const wordmarkFont = Outfit({ subsets: ["latin"], weight: "700" });

export function PhotoSignCard({
  title,
  line,
  onSignIn,
  actionLabel = "Sign in",
  secondLabel,
  onSecond,
}: {
  title: string;
  line: string;
  onSignIn: () => void;
  /** The white button's words: "Sign in", or "Open Google Maps" on the
   *  leave-for-Maps confirm (MESITA-4448). */
  actionLabel?: string;
  /** "Just browse" on the welcome, "Not now" on the gate. */
  secondLabel: string;
  onSecond: () => void;
}) {
  return (
    <div className="relative aspect-[4/5] w-full bg-black text-white">
      <Image
        src="/auth/terrace.jpg"
        alt=""
        fill
        priority
        sizes="24rem"
        className="object-cover object-[center_35%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent via-30% to-black/90"
      />
      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <span className="flex items-center gap-2 self-start select-none">
          <MesitaMark className="h-7 w-7" />
          <span
            className={`${wordmarkFont.className} text-2xl leading-none tracking-[-0.03em]`}
          >
            Mesita
          </span>
        </span>
        <div className="flex flex-col">
          <p className="text-3xl leading-[1.1] font-semibold tracking-[-0.02em] text-balance">
            {title}
          </p>
          <p className="mt-2 text-sm leading-snug text-white/80">{line}</p>
          <button
            type="button"
            onClick={onSignIn}
            // White on the photo, the one action. "Sign in" covers a
            // returning guest and a new one alike: the first code on a
            // number creates the account (MESITA-4287).
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-neutral-900 transition hover:bg-white/90 active:scale-[0.99]"
          >
            {actionLabel}
          </button>
          <button
            type="button"
            onClick={onSecond}
            // Plain white words, 44px tall, so Sign in is the only button
            // that shouts.
            className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-white/85 transition hover:text-white"
          >
            {secondLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
