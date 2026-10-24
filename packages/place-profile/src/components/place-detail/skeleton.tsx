"use client";

import { cn } from "../../lib/format";
import {
  PLACE_BODY_CLASS,
  PLACE_BONE_CLASS,
  PLACE_BUTTON_CLASS,
  PLACE_META_CLASS,
  PLACE_OUTLINE_CHIP_CLASS,
  PLACE_TITLE_CLASS,
} from "../../lib/ui";
import { PlaceTopBar } from "../PlaceTopBar";

import { Box } from "./box";
import { NO_OVERVIEW, PlaceEmptyScreen } from "./empty-screen";
import {
  PROFILE_ACTIONS_CLASS,
  PROFILE_HALVES_ROW_CLASS,
  PROFILE_MESITA_ROWS_CLASS,
  PROFILE_TILE_BOX_CLASS,
  PROFILE_TILES_ROW_CLASS,
} from "./ProfileActions";
import {
  PROFILE_FACTS_ROW_CLASS,
  PROFILE_IDENTITY_ROW_CLASS,
  PROFILE_STATS_GRID_CLASS,
  PROFILE_SUMMARY_BAND_CLASS,
} from "./profile-summary";
import {
  PROFILE_PHOTO_FRAME_CLASS,
  PROFILE_STAT_CLASS,
  PROFILE_STAT_LINE_CLASS,
  PROFILE_STAT_MARK_CLASS,
} from "./profile-summary-parts";
import { PlaceTabBar } from "./tabs";

// THE PLACE SCREEN WHILE IT LOADS, BLOCK FOR BLOCK (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading, like the
// sizes"). Every block here stands where the loaded screen draws its own, at
// its size: PlaceTopBar, then ProfileSummary's white band (photo and the
// three counts, the facts boxes, the four tiles, Mesita Reserve, Prepay ·
// Pay), the tab strip, then Overview's white cards on the grey ground.
// NOTHING HERE RE-TYPES A REAL PART: the top bar, the tab strip, the Boxes
// and the "No overview yet" screen are the real components; the summary's
// band, rows and boxes are the classes ProfileSummary, ProfilePhoto,
// ProfileStat and ProfileActions export and read themselves; the type and
// the buttons are lib/ui.ts's. Only a bar's width is this file's guess at
// the data. When data lands nothing moves.
// Until MESITA-2701 the consumer drew the screen from before MESITA-2619: a
// bordered back square, a centred title, a full-bleed square photo, three
// pills and three tall slabs.
//
// A client module only so it can draw the real top bar and tab strip and
// take a live back; it holds no state, so a server loading.tsx renders it
// as it is. Blocks wear the consumer's Skeleton look (PLACE_BONE_CLASS); the
// package cannot import the app's primitive.

const noop = () => {};

function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn(PLACE_BONE_CLASS, className)} />;
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

/** PlaceTopBar with the name still on its way: the real bar (its chevron
 *  and three dots, the dots inert), a bone where the name goes. A given
 *  `onBack` makes the chevron the live Back the loaded bar wears, so a slow
 *  load can still be left. */
export function PlaceTopBarSkeleton({ onBack }: { onBack?: () => void }) {
  return <PlaceTopBar name={null} onBack={onBack} />;
}

/** ProfileSummary: one white band, its groups in its own classes. */
function ProfileSummarySkeleton() {
  return (
    <section aria-hidden className={PROFILE_SUMMARY_BAND_CLASS}>
      {/* ProfilePhoto and three ProfileStat columns: the network's 24px
          mark in its slot, then the 24px number line. */}
      <div className={PROFILE_IDENTITY_ROW_CLASS}>
        <Bone className={PROFILE_PHOTO_FRAME_CLASS} />
        <div className={PROFILE_STATS_GRID_CLASS}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={PROFILE_STAT_CLASS}>
              <span className={PROFILE_STAT_MARK_CLASS}>
                <Bone className="h-6 w-6" />
              </span>
              <div className={PROFILE_STAT_LINE_CLASS}>
                <Bone className="h-4 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* The facts row: ProfileFact's outlined box. Five of a usual
          place's widths (category · price · hours · zone · distance), two
          rows on a phone. */}
      <div className={PROFILE_FACTS_ROW_CLASS}>
        {["w-36", "w-20", "w-32", "w-24", "w-16"].map((w) => (
          <div
            key={w}
            className={cn(PLACE_OUTLINE_CHIP_CLASS, PLACE_BONE_CLASS, w)}
          />
        ))}
      </div>
      {/* ProfileActions: four tiles, then Mesita Reserve full width and
          Prepay · Pay halved, the 44px place button. */}
      <div className={PROFILE_ACTIONS_CLASS}>
        <div className={PROFILE_TILES_ROW_CLASS}>
          {[0, 1, 2, 3].map((i) => (
            <Bone key={i} className={PROFILE_TILE_BOX_CLASS} />
          ))}
        </div>
        <div className={PROFILE_MESITA_ROWS_CLASS}>
          <Bone className={cn(PLACE_BUTTON_CLASS, "w-full")} />
          <div className={PROFILE_HALVES_ROW_CLASS}>
            <Bone className={cn(PLACE_BUTTON_CLASS, "w-full")} />
            <Bone className={cn(PLACE_BUTTON_CLASS, "w-full")} />
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
 *  Hours · Links · Tags, each in the real Box (white, rounded-2xl,
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
          <Bone className={PLACE_BUTTON_CLASS} />
          <Bone className={PLACE_BUTTON_CLASS} />
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
            <Bone key={i} className={PLACE_BUTTON_CLASS} />
          ))}
        </div>
      </Box>
      {/* TagsBox: 32px outlined chips, wrapping. */}
      <Box>
        <BoxTitleBar width="w-24" />
        <div className="flex flex-wrap gap-2">
          {["w-20", "w-24", "w-16", "w-28"].map((w) => (
            <div
              key={w}
              className={cn(PLACE_OUTLINE_CHIP_CLASS, PLACE_BONE_CLASS, w)}
            />
          ))}
        </div>
      </Box>
    </>
  );
}

/** PlaceDetailBody while it loads: the summary band, the real tab strip
 *  (inert, Overview selected as it opens), then Overview. `creating` is
 *  the opening screen of a Google-only place, whose Overview is the empty
 *  screen: drawn as itself (NO_OVERVIEW, the words PlaceDetailBody shows),
 *  since its two lines are fixed and their wrap sets its height (Pato,
 *  MESITA-2701: "the placeholders must be similar to the page you are
 *  loading, like the sizes"). Callers draw their own top bar and scroller,
 *  as they do for the real body. */
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
        {creating ? <PlaceEmptyScreen {...NO_OVERVIEW} /> : <OverviewSkeleton />}
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
