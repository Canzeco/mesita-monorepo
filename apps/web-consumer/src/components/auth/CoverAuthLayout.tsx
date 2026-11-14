"use client";

import { useState } from "react";
import Image from "next/image";
import { Outfit } from "next/font/google";
import { X } from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { cn } from "@/lib/utils";

// Sign-in opens on a photo, not a form (MESITA-3650). The first screen is
// the cover, the wordmark, one line and two buttons, Sign up and Log in
// (MESITA-3751: "two different buttons… for clarity for the user"). Both
// open the same sign-in form (the caller's children: the phone code, the
// only way in since MESITA-3875) as a sheet
// over the photo; only the sheet's title says which door was taken. The X
// lowers it back to the cover.
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
  /** Overrides both doors' sheet titles (the Pay QR door names its place). */
  title?: string;
  /** Under the sheet title; defaults to the door's own line. */
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // Which door is open: null is the cover.
  const [door, setDoor] = useState<"signup" | "login" | null>(null);
  const open = door !== null;
  const sheetTitle =
    title ?? (door === "login" ? "Log in" : "Create your account");
  const sheetSubtitle =
    subtitle ?? (door === "login" ? "Welcome back." : "It takes a minute.");

  return (
    <div className="relative flex-1 overflow-hidden bg-black text-white">
      <Image
        src="/auth/terrace.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 30rem, 100vw"
        // The photo shows as it is: no blur on it or behind the words
        // (MESITA-3746). It only grows a little when the sheet opens.
        className={cn(
          "object-cover object-[center_40%] transition-transform duration-700 ease-out",
          open && "scale-105",
        )}
      />
      {/* Legibility: a veil at the top for the logo and a deep one at the
          bottom for the copy and the button; the middle stays clear. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent via-35% to-black/90"
      />

      <div
        inert={open}
        className={cn(
          "absolute inset-0 flex flex-col justify-between p-6 transition-opacity duration-300",
          open && "opacity-0",
        )}
      >
        <span className="flex items-center gap-2 self-start text-white select-none">
          <MesitaMark className="h-8 w-8" />
          <span
            className={`${wordmarkFont.className} text-[28px] leading-none tracking-[-0.03em]`}
          >
            Mesita
          </span>
        </span>

        <div className="flex flex-col gap-5">
          <div>
            <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-[-0.02em] text-balance">
              {headline}
            </h1>
            <p className="mt-3 text-base leading-snug text-white/80">
              Discovery, reservations, payments and rewards.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {/* Both doors read on the photo (MESITA-3795, Pato: "outside the
                box it must be more visible"): Sign up solid white, Log in a
                frosted fill with a bright edge, never a bare outline. */}
            <button
              type="button"
              onClick={() => setDoor("signup")}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-white text-lg font-semibold text-black shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition active:scale-[0.98]"
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => setDoor("login")}
              className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/60 bg-white/20 text-lg font-semibold text-white backdrop-blur-md transition active:scale-[0.98]"
            >
              Log in
            </button>
          </div>
        </div>
      </div>

      {/* Dims the photo behind the sheet; a tap on it closes the sheet. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => setDoor(null)}
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <section
        inert={!open}
        aria-hidden={!open}
        className={cn(
          "bg-card text-foreground absolute inset-x-0 bottom-0 max-h-[90%] overflow-y-auto rounded-t-[28px] px-6 pt-3 pb-8 shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div
          aria-hidden
          className="bg-border mx-auto mb-4 h-1 w-10 rounded-full"
        />
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl leading-tight font-semibold tracking-[-0.02em]">
              {sheetTitle}
            </h2>
            <p className="text-muted-foreground mt-1 text-base leading-snug">
              {sheetSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDoor(null)}
            aria-label="Back to the cover"
            className="bg-muted text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
        {footer && (
          <p className="text-muted-foreground type-body mt-6 text-center">
            {footer}
          </p>
        )}
      </section>
    </div>
  );
}
