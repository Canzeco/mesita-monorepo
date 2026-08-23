"use client";

// The paid beat (MESITA-808, motion budget 4A): when a live ticket flips to
// `revealed` while the guest is watching, THE slot shows a savings count-up
// before the ticket settles into History. This and the verified pulse are
// the only two motions on the Rewards page. Honors prefers-reduced-motion by
// snapping straight to the final amount.

import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";

import { formatCurrency } from "@/lib/api/profile";

const REVEAL_MS = 900;

export function SavingsReveal({
  placeName,
  savedCents,
  onDone,
}: {
  placeName: string;
  savedCents: number;
  onDone: () => void;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    // All setState happens inside rAF callbacks (never sync in the effect —
    // React 19 set-state-in-effect rule). Reduced motion snaps on frame one.
    let raf = 0;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const start = performance.now();
    const tick = (now: number) => {
      if (reduced || savedCents <= 0) {
        setShown(savedCents);
        return;
      }
      const t = Math.min(1, (now - start) / REVEAL_MS);
      // ease-out cubic — fast start, gentle landing.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(savedCents * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [savedCents]);

  useEffect(() => {
    const t = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <section className="bg-pink-gradient shadow-glow rounded-panel flex flex-col items-center gap-2 px-5 py-7 text-center text-white">
      <span className="grid size-11 place-items-center rounded-full bg-white/20">
        <PartyPopper className="size-5" />
      </span>
      <p className="type-label font-bold tracking-[0.14em] uppercase opacity-85">
        Visit complete at {placeName}
      </p>
      <p className="font-display text-4xl leading-none font-bold tabular-nums">
        {savedCents > 0 ? formatCurrency(shown) : "¡Listo!"}
      </p>
      <p className="text-xs opacity-90">
        {savedCents > 0 ? "saved on this visit" : "ticket closed"}
      </p>
    </section>
  );
}
