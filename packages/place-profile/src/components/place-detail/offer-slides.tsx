"use client";

import { useState, useSyncExternalStore } from "react";

import { cn } from "../../lib/format";
import type { OfferSlide } from "../../lib/offers";

export { offerSlides, offersLabel, type OfferInput, type OfferSlide } from "../../lib/offers";

// THE OFFER SLIDES, ONE COPY FOR EVERY SCREEN (MESITA-4151). Home's offer
// button, Search's strip and the place screen's Offers tile read the same
// slides on the same clock, so a place says the same offer in the same words
// and colour wherever it appears. The buttons themselves stay with their
// screens (Home's is a link in web-consumer); this file is the words, the
// beat and the moving track.

// THE OFFER BEAT (MESITA-3467, Pato: "switching across all the offers, every
// two seconds ... like a carousel"): ONE clock for every offer button on the
// page, so the buttons on screen change together. It counts up every 2s while
// anything listens, and skips a beat while the page is hidden or was
// scrolled in the last 600ms, so nothing moves under a moving list.
export const OFFER_BEAT_MS = 2000;
const SCROLL_QUIET_MS = 600;

let beat = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let lastScrollAt = 0;
const listeners = new Set<() => void>();

function onScroll() {
  lastScrollAt = Date.now();
}

function tick() {
  if (document.hidden) return;
  if (Date.now() - lastScrollAt < SCROLL_QUIET_MS) return;
  beat += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(tick, OFFER_BEAT_MS);
    // Capture: lists scroll inside their own boxes, not the window.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("scroll", onScroll, { capture: true });
    }
  };
}

/** The shared beat: a count that rises every 2s. The server render reads 0. */
export function useOfferBeat(): number {
  return useSyncExternalStore(subscribe, () => beat, () => 0);
}

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduced(listener: () => void) {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** The phone asks for less motion: the offer button holds one slide. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCE).matches, () => false);
}

/** The slide the shared beat shows now, plus the one it just left (for the
 *  slide-up). Under reduced motion it holds the first voucher slide, so the
 *  Offers page stays one tap away (MESITA-4151), else the first slide. */
export function useOfferSlide(slides: OfferSlide[]): { index: number; previous: number | null } {
  const beatNow = useOfferBeat();
  const reduced = useReducedMotion();
  // The beat this button first drew on: no slide-up on arrival.
  const [firstBeat] = useState(beatNow);
  const n = slides.length;
  if (reduced) return { index: Math.max(0, slides.findIndex((s) => s.section !== null)), previous: null };
  if (n <= 1) return { index: 0, previous: null };
  const index = beatNow % n;
  return { index, previous: beatNow === firstBeat ? null : (beatNow - 1 + n) % n };
}

// THE SLIDE-UP (MESITA-3467): the old words leave upward, the new words rise
// from below, 300ms ease-out, clipped inside the still box. It ships with the
// track (MESITA-4151) so every app that draws the place screen has it; React
// hoists and dedupes the tag by its href. Reduced motion: no movement.
const OFFER_SLIDE_CSS = `@keyframes offer-in{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes offer-out{from{transform:translateY(0)}to{transform:translateY(-100%)}}
.offer-in{animation:offer-in 300ms ease-out both}
.offer-out{animation:offer-out 300ms ease-out both}
@media (prefers-reduced-motion:reduce){.offer-in{animation:none}.offer-out{display:none}}`;

/** The ink pill beside a slide's words. */
const OFFER_PILL =
  "bg-foreground text-paper shrink-0 rounded-md px-1.5 py-0.5 text-xs leading-none font-bold tabular-nums";

function OfferWords({ slide, short = false, className }: { slide: OfferSlide; short?: boolean; className?: string }) {
  return (
    <span className={cn("absolute inset-0 flex items-center justify-center gap-1.5", className)}>
      {/* A slide with no pill is a whole sentence (the place screen's
          tile, MESITA-4155): it may take two lines. */}
      {slide.pill ? (
        <>
          <span className="truncate">{short ? slide.short : slide.lead}</span>
          <span className={OFFER_PILL}>{slide.pill}</span>
        </>
      ) : (
        <span className="line-clamp-2 text-center leading-tight">{slide.lead}</span>
      )}
    </span>
  );
}

/** The moving words inside a still box, hidden from screen readers (the
 *  box's label lists every offer once). Keyed by slide so each change replays
 *  the slide-up. */
export function OfferTrack({
  slides,
  index,
  previous,
  short,
}: {
  slides: OfferSlide[];
  index: number;
  previous: number | null;
  short?: boolean;
}) {
  return (
    <span className="relative block h-full w-full overflow-hidden" aria-hidden>
      <style href="mesita-offer-slide" precedence="default">
        {OFFER_SLIDE_CSS}
      </style>
      {previous !== null ? (
        <OfferWords key={`out-${slides[previous].key}-${index}`} slide={slides[previous]} short={short} className="offer-out" />
      ) : null}
      <OfferWords key={`in-${slides[index].key}`} slide={slides[index]} short={short} className={previous !== null ? "offer-in" : undefined} />
    </span>
  );
}
