"use client";

import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import type { OfferSlide } from "@mesita/place-profile";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { offerHref } from "@/components/consumer/offer-button";
import { Panel } from "@/components/shared/Panel";
import { Skeleton } from "@/components/shared/Skeleton";
import { cn } from "@/lib/utils";

const BEAT_MS = 3000;

// THE OFFERS BOX (Pato, 2026-11-21, MESITA-4573: "the second section of this
// must be the offers not the transactions, like a preview of the vouchers …
// SUPER IMPORTANT TO SELL HERE, MAYBE IN AN HORIZONTAL BANNER OR SOMETHING
// JUST MOVING"): the Loyalty Card page's second box, between the card and
// the Tickets. One tile per voucher the guest can buy here, in its own
// colour with its bonus pill, side by side in a strip that slides to the
// next tile every 3 s and loops; a finger on it stops the slide, and a
// thumb can swipe it. Reduced motion keeps it still. A tap opens the
// place's Offers page on that voucher's section, coming back here after
// (`from=wallet`). The Pay list's offer line moved here (it showed outside).
export function OffersBanner({ slides, placeHref }: { slides: OfferSlide[]; placeHref: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const held = useRef(false);
  const many = slides.length > 1;

  useEffect(() => {
    const el = strip.current;
    if (!el || !many) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (held.current) return;
      const tile = el.firstElementChild as HTMLElement | null;
      if (!tile) return;
      const step = tile.offsetWidth + 8;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: "smooth" });
    }, BEAT_MS);
    return () => clearInterval(id);
  }, [many]);

  if (slides.length === 0) return null;
  const hold = () => {
    held.current = true;
  };
  const release = () => {
    held.current = false;
  };
  return (
    <Panel title="Offers" className="mt-4" data-loyalty-card-offers>
      <div
        ref={strip}
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-4 px-4 pt-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onPointerDown={hold}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        {slides.map((s) => (
          <PushLink
            key={s.key}
            href={offerHref(placeHref, s, true)}
            aria-label={s.spoken}
            className={cn(
              "flex h-24 shrink-0 snap-start flex-col justify-between rounded-xl p-3 transition active:scale-[0.99]",
              many ? "w-[80%]" : "w-full",
              s.tone,
            )}
            data-loyalty-card-offer-tile
          >
            <span className="text-base font-semibold">{s.lead}</span>
            <span className="flex items-center justify-between gap-2">
              <span className="bg-foreground text-background rounded-md px-2 py-0.5 text-sm font-semibold">{s.pill}</span>
              <span className="flex items-center text-sm font-semibold">
                Buy
                <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </span>
            </span>
          </PushLink>
        ))}
      </div>
    </Panel>
  );
}

/** The Offers box in bones: its title bar and one tile and a peek. */
export function OffersBannerSkeleton() {
  return (
    <Panel className="mt-4" aria-hidden>
      <div className="px-4 pt-4">
        <Skeleton className="h-4 w-16 rounded" />
      </div>
      <div className="flex gap-2 overflow-hidden px-4 pt-3 pb-4">
        <Skeleton className="h-24 w-[80%] shrink-0 rounded-xl" />
        <Skeleton className="h-24 w-[80%] shrink-0 rounded-xl" />
      </div>
    </Panel>
  );
}
