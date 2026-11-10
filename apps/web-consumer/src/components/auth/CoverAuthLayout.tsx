"use client";

import { useState } from "react";
import Image from "next/image";
import { Outfit } from "next/font/google";
import { Phone, X } from "lucide-react";
import { MesitaMark } from "@/components/brand/MesitaMark";
import { cn } from "@/lib/utils";

// Sign-in opens on a photo, not a form (MESITA-3650). The first screen is
// the cover, the wordmark, one line and "Continue with phone"; the phone
// and code steps (the caller's children) rise as a sheet over the photo
// only after that tap, and the X lowers it back to the cover.
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
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex-1 overflow-hidden bg-black text-white">
      <Image
        src="/auth/dusk.jpg"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 30rem, 100vw"
        // A 1px blur takes the edge off the photo's generated details
        // without smearing faces (MESITA-3659: 3px was "too much"); the scale
        // keeps the blurred edge off the frame.
        className={cn(
          "scale-105 object-cover object-[center_40%] blur-[1px] transition-transform duration-700 ease-out",
          open && "scale-110",
        )}
      />
      {/* Behind the words only: a soft backdrop blur over the bottom third,
          fading in from clear (MESITA-3659). */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[35%] backdrop-blur-[6px] [mask-image:linear-gradient(to_bottom,transparent,black_60%)]"
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
          <span className={`${wordmarkFont.className} text-[28px] leading-none tracking-[-0.03em]`}>
            Mesita
          </span>
        </span>

        <div className="flex flex-col gap-5">
          <div>
            <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-[-0.02em] text-balance">
              {headline}
            </h1>
            <p className="mt-3 text-base leading-snug text-white/80">
              Places, reservations and paying the bill, in one app.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-white text-base font-semibold text-black transition active:scale-[0.98]"
          >
            <Phone className="h-4 w-4" />
            Continue with phone
          </button>
        </div>
      </div>

      {/* Dims the photo behind the sheet; a tap on it closes the sheet. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => setOpen(false)}
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <section
        inert={!open}
        aria-hidden={!open}
        className={cn(
          "bg-background text-foreground absolute inset-x-0 bottom-0 max-h-[90%] overflow-y-auto rounded-t-3xl px-6 pt-3 pb-8 shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div aria-hidden className="bg-border mx-auto mb-4 h-1 w-10 rounded-full" />
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl leading-tight font-semibold tracking-[-0.02em]">
              {title}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm leading-[1.55]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Back to the cover"
            className="bg-muted text-muted-foreground hover:text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
        {footer && (
          <p className="text-muted-foreground type-body mt-6 text-center">{footer}</p>
        )}
      </section>
    </div>
  );
}
