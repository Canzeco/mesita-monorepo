"use client";

import { ChevronLeft, MoreHorizontal } from "lucide-react";

import { cn } from "../../lib/format";
import {
  PLACE_BODY_CLASS,
  PLACE_BUTTON_CLASS,
  PLACE_META_CLASS,
  PLACE_OUTLINE_CHIP_CLASS,
  PLACE_SCREEN_TITLE_CLASS,
  PLACE_TITLE_CLASS,
} from "../../lib/ui";

import { Box } from "./box";
import { PlaceTabBar } from "./tabs";

// THE PLACE SCREEN WHILE IT LOADS, BLOCK FOR BLOCK (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"). Every block here stands where the loaded screen draws its own, at
// its size: PlaceTopBar, then ProfileSummary's white band (photo and the
// three counts, the facts boxes, the four tiles, Mesita Reserve, Prepay ·
// Pay), the tab strip, then Overview's white cards on the grey ground. The
// sizes come from the same places the real parts read them (lib/ui.ts, Box,
// PlaceTabBar); a number written here copies the real part's class and says
// which. When data lands nothing moves.
// Until MESITA-2701 the consumer drew the screen from before MESITA-2619: a
// bordered back square, a centred title, a full-bleed square photo, three
// pills and three tall slabs.
//
// A client module only so it can draw the real tab strip (PlaceTabBar, made
// inert) and take a live back; it holds no state, so a server loading.tsx
// renders it as it is. Blocks wear the consumer's Skeleton look (bg-muted,
// pulsing, rounded-lg); the package cannot import the app's primitive.

const BONE_CLASS = "bg-muted animate-pulse rounded-lg";
const noop = () => {};

function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn(BONE_CLASS, className)} />;
}

/** Text that has not arrived: one bar per line, each on the real type's
 *  line height (1lh of `type`), so the lines stand exactly as tall as the
 *  text they stand in for. */
function LineBars({ type, widths }: { type: string; widths: string[] }) {
  return (
    <div className={cn(type, "flex flex-col")}>
      {widths.map((w, i) => (
        <div key={i} className="flex h-[1lh] items-center">
          <Bone className={cn("h-3", w)} />
        </div>
      ))}
    </div>
  );
}

/** PlaceTopBar with the name still on its way: the same 56px white bar, the
 *  bare chevron and the three dots drawn as they are (inert), the name a bar
 *  where PlaceDetailTitle sets it (16px bold, at the chevron's right). A
 *  given `onBack` makes the chevron the live Back the loaded bar wears, so a
 *  slow load can still be left. */
export function PlaceTopBarSkeleton({ onBack }: { onBack?: () => void }) {
  const icon =
    "text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-full";
  return (
    <header className="bg-card z-20 flex h-14 shrink-0 items-center gap-1 px-1">
      {onBack ? (
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className={cn(icon, "hover:bg-muted transition")}
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
        </button>
      ) : (
        <span aria-hidden className={icon}>
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-center text-base font-bold tracking-tight">
        <Bone className="h-4 w-40 max-w-full" />
      </div>
      <span aria-hidden className={icon}>
        <MoreHorizontal className="h-6 w-6" strokeWidth={2.25} />
      </span>
    </header>
  );
}

/** ProfileSummary: one white band, p-4 and 16px between its groups. */
function ProfileSummarySkeleton() {
  return (
    <section
      aria-hidden
      className="border-border bg-card flex flex-col gap-4 border-b p-4"
    >
      {/* ProfilePhoto (88px, rounded-2xl) and three ProfileStat columns:
          the network's 24px mark, 6px, then the 24px number line. */}
      <div className="flex items-center gap-3">
        <Bone className="h-[88px] w-[88px] shrink-0 rounded-2xl" />
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex min-w-0 flex-col items-center justify-center px-0.5"
            >
              <Bone className="mb-1.5 h-6 w-6 shrink-0" />
              <div className="flex h-6 items-center justify-center">
                <Bone className="h-4 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* The facts row: 32px outlined boxes, 8px apart, wrapping. Five
          boxes of a usual place's widths (category · price · hours · zone ·
          distance), two rows on a phone. */}
      <div className="flex flex-wrap items-center gap-2">
        {["w-36", "w-20", "w-32", "w-24", "w-16"].map((w) => (
          <div key={w} className={cn(PLACE_OUTLINE_CHIP_CLASS, BONE_CLASS, w)} />
        ))}
      </div>
      {/* ProfileActions: four 56px tiles (its tileBtn), 12px, then Mesita
          Reserve full width and Prepay · Pay halved, the 44px place button,
          8px apart. */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className="h-14 min-w-0" />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className={cn(PLACE_BUTTON_CLASS, BONE_CLASS, "w-full")} />
          <div className="grid grid-cols-2 gap-2">
            <div className={cn(PLACE_BUTTON_CLASS, BONE_CLASS, "w-full")} />
            <div className={cn(PLACE_BUTTON_CLASS, BONE_CLASS, "w-full")} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** A Box's header: the 16px title on its 24px line, and at the far end the
 *  12px meta when the box has one (Location's distance). */
function BoxTitleBar({ width, meta = false }: { width: string; meta?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className={cn(PLACE_TITLE_CLASS, "flex h-[1lh] items-center")}>
        <Bone className={cn("h-4", width)} />
      </div>
      {meta ? (
        <div className={cn(PLACE_META_CLASS, "flex h-[1lh] items-center")}>
          <Bone className="h-3 w-10" />
        </div>
      ) : null}
    </div>
  );
}

/** Overview in PlaceDetailBody's order: photos · Presentation · Location ·
 *  Hours · Links · Mesita Tags, each in the real Box (white, rounded-2xl,
 *  p-4, 12px inside). */
function OverviewSkeleton() {
  return (
    <>
      {/* MediaBox: the square carousel inside a bare Box. */}
      <Box bare>
        <Bone className="aspect-square w-full rounded-none" />
      </Box>
      <Box>
        <BoxTitleBar width="w-28" />
        <LineBars
          type={PLACE_BODY_CLASS}
          widths={["w-full", "w-full", "w-full", "w-2/3"]}
        />
      </Box>
      {/* LocationBox: the 144px map, the address, Google Maps · Ask Uber. */}
      <Box>
        <BoxTitleBar width="w-20" meta />
        <Bone className="h-36" />
        <LineBars type={PLACE_BODY_CLASS} widths={["w-full", "w-1/2"]} />
        <div className="grid grid-cols-2 gap-2">
          <div className={cn(PLACE_BUTTON_CLASS, BONE_CLASS)} />
          <div className={cn(PLACE_BUTTON_CLASS, BONE_CLASS)} />
        </div>
      </Box>
      {/* HoursBox: the open line, then the week in one outlined list of
          44px rows. */}
      <Box>
        <BoxTitleBar width="w-16" />
        <LineBars type="text-sm leading-snug" widths={["w-32"]} />
        <div className="border-border overflow-hidden rounded-lg border">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="border-border flex min-h-11 items-center justify-between gap-3 border-b px-3 last:border-b-0"
            >
              <Bone className="h-3 w-20" />
              <Bone className="h-3 w-24" />
            </div>
          ))}
        </div>
      </Box>
      {/* LinksBox: two columns of the 44px place button. */}
      <Box>
        <BoxTitleBar width="w-12" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn(PLACE_BUTTON_CLASS, BONE_CLASS)} />
          ))}
        </div>
      </Box>
      {/* TagsBox: 32px outlined chips, wrapping. */}
      <Box>
        <BoxTitleBar width="w-24" />
        <div className="flex flex-wrap gap-2">
          {["w-20", "w-24", "w-16", "w-28"].map((w) => (
            <div key={w} className={cn(PLACE_OUTLINE_CHIP_CLASS, BONE_CLASS, w)} />
          ))}
        </div>
      </Box>
    </>
  );
}

/** A Google-only profile being created shows one "No overview yet" screen
 *  in Overview (PlaceEmptyScreen): the 56px chip, the 18px title, the
 *  14px line under it. */
function EmptyScreenSkeleton() {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <Bone className="h-14 w-14 rounded-2xl" />
      <div className={cn(PLACE_SCREEN_TITLE_CLASS, "mt-4 flex h-[1lh] items-center")}>
        <Bone className="h-4 w-36" />
      </div>
      <div className="mt-1.5 flex w-full max-w-[30ch] flex-col items-center text-sm leading-relaxed">
        <div className="flex h-[1lh] w-full items-center justify-center">
          <Bone className="h-3 w-full" />
        </div>
        <div className="flex h-[1lh] w-full items-center justify-center">
          <Bone className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

/** PlaceDetailBody while it loads: the summary band, the real tab strip
 *  (inert, Overview selected as it opens), then Overview. `creating` is
 *  the opening screen of a Google-only place, whose Overview is the empty
 *  screen. Callers draw their own top bar and scroller, as they do for the
 *  real body. */
export function PlaceDetailBodySkeleton({
  creating = false,
}: {
  creating?: boolean;
}) {
  return (
    <div className="flex flex-col pb-4">
      <span className="sr-only">Loading place</span>
      <ProfileSummarySkeleton />
      <div aria-hidden className="flex flex-col gap-3 px-4">
        {/* The strip itself, not a copy: its labels, its 3px blue
            underline. `contents` keeps it a child of this column, so it
            sticks the way the loaded one does. */}
        <div inert className="contents">
          <PlaceTabBar tab="place" onChange={noop} />
        </div>
        {creating ? <EmptyScreenSkeleton /> : <OverviewSkeleton />}
      </div>
    </div>
  );
}

/** PlaceProfile while it loads (the consumer's direct link, admin's
 *  phone): the grey ground, the top bar, the scrolling body. */
export function PlaceProfileSkeleton({
  onBack,
  creating = false,
}: {
  onBack?: () => void;
  creating?: boolean;
}) {
  return (
    <div className="bg-background relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <PlaceTopBarSkeleton onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PlaceDetailBodySkeleton creating={creating} />
      </div>
    </div>
  );
}
