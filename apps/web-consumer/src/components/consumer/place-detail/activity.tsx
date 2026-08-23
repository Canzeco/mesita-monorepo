"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CalendarCheck,
  Camera,
  Instagram,
  MapPin,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Spinner } from "@/components/shared/Spinner";
import type {
  PlaceReservation,
  PlaceStory,
  PlaceVisit,
} from "@/lib/api/place-activity";
import { classBadgeClass } from "@/lib/consumer-data";
import {
  type ReservationSort,
  sortReservations,
  sortStories,
  sortVisits,
  type StorySort,
  type VisitSort,
} from "@/lib/place-activity-sort";
import {
  cn,
  firstInitial,
  formatCompactCount,
  relativeLabel,
} from "@/lib/utils";

import { Box, BoxHScroll } from "./box";
import { SortChips, type SortOption } from "./review-ui";

// ── Guest activity rails (Reviews tab, MESITA-1147) ─────────────────────
//
// Three feeds of what OTHER guests did here — stories, visits, reservations
// — plus the not-yet-built orders rail. Same box + horizontal-rail shape as
// the Google / Mesita review rails above them, so the tab reads as one list
// of sources rather than two different UIs stacked.
//
// Everything on these cards was privacy-shaped server-side (MESITA-913):
// private accounts arrive as "Anonymous guest", opted-out guests never
// arrive at all. No bill totals ship — a reward percent is a place × class
// rate, a bill is that guest's spend.

// ── Shared card chrome ──────────────────────────────────────────────────

function GuestLine({
  name,
  handle,
  classKey,
  sub,
}: {
  name: string;
  handle: string;
  classKey: PlaceVisit["class_key"];
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          // Ink comes from the metal (MESITA-1142) — same recipe as ReviewCard.
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold opacity-90",
          classBadgeClass(classKey),
        )}
      >
        {firstInitial(name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-muted-foreground type-label truncate">
          {handle ? `${handle} · ${sub}` : sub}
        </p>
      </div>
    </div>
  );
}

function Chip({
  icon: Icon,
  children,
  tone = "muted",
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  tone?: "muted" | "reward" | "story";
}) {
  return (
    <span
      className={cn(
        "type-label inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold",
        tone === "reward" && "bg-amber-500/10 text-amber-600",
        tone === "story" && "bg-fuchsia-500/10 text-fuchsia-600",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {children}
    </span>
  );
}

/**
 * The one empty state every rail on this tab uses. Mirrors the Mesita-reviews
 * empty state that already shipped, so a place with no activity reads as a
 * consistent column of "nothing here yet" rather than a ragged mix of hidden
 * and shown boxes.
 */
function EmptyRail({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-3 text-center">
      <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-xs leading-snug">{body}</p>
      </div>
    </div>
  );
}

function LoadingRail() {
  return (
    <div className="flex items-center justify-center py-6">
      <Spinner size="md" label="Loading activity" />
    </div>
  );
}

/** Shared box scaffold: loading → empty → sorted rail. */
function ActivityBox<T, K extends string>({
  title,
  icon,
  iconColor,
  loading,
  items,
  sort,
  onSort,
  sorts,
  empty,
  children,
}: {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  loading: boolean;
  items: T[];
  sort: K;
  onSort: (next: K) => void;
  sorts: readonly SortOption<K>[];
  empty: { title: string; body: string };
  children: (items: T[]) => React.ReactNode;
}) {
  return (
    <Box
      title={title}
      icon={icon}
      iconColor={iconColor}
      right={loading ? undefined : `${items.length} total`}
    >
      {loading ? (
        <LoadingRail />
      ) : items.length === 0 ? (
        <EmptyRail icon={icon} title={empty.title} body={empty.body} />
      ) : (
        <>
          <SortChips
            sort={sort}
            onSort={onSort}
            options={sorts}
            label={`Sort ${title.toLowerCase()}`}
          />
          <BoxHScroll>{children(items)}</BoxHScroll>
        </>
      )}
    </Box>
  );
}

// ── Instagram stories ───────────────────────────────────────────────────

const STORY_SORTS: SortOption<StorySort>[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "reach", label: "Reach" },
];

export function InstagramStoriesBox({
  stories,
  loading,
}: {
  stories: PlaceStory[];
  loading: boolean;
}) {
  const [sort, setSort] = useState<StorySort>("newest");
  const sorted = useMemo(() => sortStories(stories, sort), [stories, sort]);

  return (
    <ActivityBox
      title="Instagram stories"
      icon={Instagram}
      iconColor="text-fuchsia-400"
      loading={loading}
      items={sorted}
      sort={sort}
      onSort={setSort}
      sorts={STORY_SORTS}
      empty={{
        title: "No stories yet",
        body: "Guests who post a story tagging this place show up here.",
      }}
    >
      {(items) =>
        items.map((s) => (
          <article
            key={s.id}
            className="bg-background flex w-56 shrink-0 snap-start flex-col gap-3 rounded-2xl p-4"
          >
            <GuestLine
              name={s.name}
              handle={s.handle}
              classKey={s.class_key}
              sub={relativeLabel(s.posted_at) ?? "recently"}
            />
            {/* Story frames are portrait by definition — fix the ratio so a
                rail of them never jitters row height while images load. */}
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl">
              <Image
                src={s.screenshot_url}
                alt={`Instagram story by ${s.name}`}
                fill
                sizes="224px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip icon={Camera} tone="story">
                Story
              </Chip>
              {s.followers > 0 && (
                <Chip icon={Users}>
                  {formatCompactCount(s.followers, false)}
                </Chip>
              )}
            </div>
          </article>
        ))
      }
    </ActivityBox>
  );
}

// ── Featured visits ─────────────────────────────────────────────────────

const VISIT_SORTS: SortOption<VisitSort>[] = [
  { key: "newest", label: "Newest" },
  { key: "reward", label: "Top reward" },
  { key: "reviewed", label: "Reviewed" },
];

export function FeaturedVisitsBox({
  visits,
  loading,
}: {
  visits: PlaceVisit[];
  loading: boolean;
}) {
  const [sort, setSort] = useState<VisitSort>("newest");
  const sorted = useMemo(() => sortVisits(visits, sort), [visits, sort]);

  return (
    <ActivityBox
      title="Featured visits"
      icon={MapPin}
      iconColor="text-primary"
      loading={loading}
      items={sorted}
      sort={sort}
      onSort={setSort}
      sorts={VISIT_SORTS}
      empty={{
        title: "No visits yet",
        body: "Be the first guest to check in here and claim the reward.",
      }}
    >
      {(items) =>
        items.map((v) => (
          <article
            key={v.id}
            className="bg-background flex w-56 shrink-0 snap-start flex-col gap-3 rounded-2xl p-4"
          >
            <GuestLine
              name={v.name}
              handle={v.handle}
              classKey={v.class_key}
              sub={relativeLabel(v.visited_at) ?? "recently"}
            />
            {/* No bill, ever. The reward percent is a place × class rate; the
                total is that guest's own spend and stays server-side. */}
            <div className="flex flex-wrap gap-1.5">
              <Chip icon={MapPin}>Visited</Chip>
              {v.discount_percent > 0 && (
                <Chip icon={Sparkles} tone="reward">
                  {v.discount_percent}% off
                </Chip>
              )}
              {v.reviewed && <Chip icon={MessageCircle}>Reviewed</Chip>}
            </div>
          </article>
        ))
      }
    </ActivityBox>
  );
}

// ── Featured orders ─────────────────────────────────────────────────────

/**
 * Orders are scoped but NOT built — there is no orders table, and the order
 * ticket sits unbuilt in the entity model settled 2026-08-18.
 *
 * decision (MESITA-1147): render the box with an honest "not live yet" state
 * rather than hiding it. The tab was specified as six rails; a silently
 * missing one reads as a bug, and every other box on this tab already states
 * its empty case out loud.
 */
export function FeaturedOrdersBox() {
  return (
    <Box title="Featured orders" icon={ShoppingBag} iconColor="text-sky-400">
      <EmptyRail
        icon={ShoppingBag}
        title="Ordering isn't live yet"
        body="When guests can order through Mesita, their orders will show up here."
      />
    </Box>
  );
}

// ── Featured reservations ───────────────────────────────────────────────

const RESERVATION_SORTS: SortOption<ReservationSort>[] = [
  { key: "newest", label: "Newest" },
  { key: "upcoming", label: "Upcoming" },
  { key: "party", label: "Party size" },
];

export function FeaturedReservationsBox({
  reservations,
  loading,
}: {
  reservations: PlaceReservation[];
  loading: boolean;
}) {
  const [sort, setSort] = useState<ReservationSort>("newest");
  // "Upcoming" is relative to an instant, and reading the clock during render
  // is impure (react-hooks/purity) — so the instant is captured in the event
  // that asks for it. Re-tapping Upcoming re-reads the clock, which is also
  // the only time a guest expects the split to move.
  const [upcomingFrom, setUpcomingFrom] = useState(0);
  const onSort = (next: ReservationSort) => {
    setSort(next);
    if (next === "upcoming") setUpcomingFrom(Date.now());
  };

  const sorted = useMemo(
    () => sortReservations(reservations, sort, upcomingFrom),
    [reservations, sort, upcomingFrom],
  );

  return (
    <ActivityBox
      title="Featured reservations"
      icon={CalendarCheck}
      iconColor="text-emerald-400"
      loading={loading}
      items={sorted}
      sort={sort}
      onSort={onSort}
      sorts={RESERVATION_SORTS}
      empty={{
        title: "No reservations yet",
        body: "Confirmed bookings made through Mesita show up here.",
      }}
    >
      {(items) =>
        items.map((r) => (
          <article
            key={r.id}
            className="bg-background flex w-56 shrink-0 snap-start flex-col gap-3 rounded-2xl p-4"
          >
            <GuestLine
              name={r.name}
              handle={r.handle}
              classKey={r.class_key}
              sub={relativeLabel(r.reserved_at) ?? "recently"}
            />
            {/* Notes and phone numbers are operational — they never leave the
                business surfaces, so a card carries only table + party. */}
            <div className="flex flex-wrap gap-1.5">
              <Chip icon={CalendarCheck}>Reserved</Chip>
              {r.party_size > 0 && (
                <Chip icon={Users}>
                  {r.party_size} {r.party_size === 1 ? "guest" : "guests"}
                </Chip>
              )}
            </div>
          </article>
        ))
      }
    </ActivityBox>
  );
}
