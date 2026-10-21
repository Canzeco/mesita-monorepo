"use client";

// Home › Social (MESITA-2442): where members go. Activity, not reviews.
// It is Home's Social tab, full width (MESITA-2474, MESITA-2517); the tab
// is its title, so it has no header and no scroller of its own.
//
// OLD-INSTAGRAM NOTIFICATIONS (Pato, MESITA-2515: "display the instagram
// profile of the person and the username and the name just as those old
// instagram notifications. keep super super simple"):
//
//   Today
//   (●)♥ Perdón liked Contramar                           [▢]
//        ◎ per••• · 1.2K followers · 2h
//
// TIDY NOTIFICATIONS (MESITA-2525, Pato: "make this more UI friendly … your
// call"): rows sit under Today · Yesterday · This week · Earlier, by the
// guest's local day. The member's picture wears the verb as an ink badge
// (heart liked, pin visited, eye viewed), so the list scans without reading.
// One line: the name (bold), the verb, the place (bold), no period; under
// it, muted, the Instagram glyph and the member's Instagram as social proof —
// three letters of the username and an approximate follower count, never
// the whole username (Pato, MESITA-2522: "i don't really want the
// instagram username since it might cause the users to abandond my app …
// mentioing the number of followers because that is all the social proof is
// about") — then the time. No Instagram → the quiet line is the time alone.
// The place's photo on the right; no photo → the card placeholder (family
// icon or initial), never an empty box. Three verbs — liked (stored `saved`),
// visited (stored `went`), viewed (stored `viewed`); the labels changed,
// never the keys.
// Same place + same verb is one item ("perdon and 4 others liked
// Contramar"). The server orders it: newest day first, and within a day the
// places nearer the guest first. Only Instagram-connected members who left
// Show my activity on ever appear (consumer-web-list-activity). No activity
// → SAMPLE rows (MESITA-2520, lib/social-sample.ts): made-up members on
// Home's real places, under one quiet "Sample activity" line, never mixed
// with real rows; with no places either, the empty state.

import { useEffect, useId, useMemo, useState, type SVGProps } from "react";
import Link from "next/link";
import { Eye, Heart, MapPin, Users, type LucideIcon } from "lucide-react";
import {
  apiListActivityFeed,
  type ActivityFeedItem,
  type ActivityKind,
  type ActivityPerson,
} from "@/lib/api/activity";
import type { Place } from "@/lib/api/places";
import { sampleActivity } from "@/lib/social-sample";
import { useActiveLocation } from "@/lib/active-location";
import { useUserLocation } from "@/lib/use-user-location";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { placeHref } from "@/lib/place-route";
import { cardPhoto, placePlaceholder } from "@/lib/place-placeholder";
import { FamilyIcon } from "@/lib/family-icons";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import { errMsg, firstInitial } from "@/lib/utils";

/** The words for the stored kinds (MESITA-2515): the keys never change. */
export const VERB: Record<ActivityKind, string> = {
  saved: "liked",
  viewed: "viewed",
  went: "visited",
};

/** "2h", "5m", "3d": the feed's clock. */
export function shortAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const mins = Math.floor(diff / 60_000);
  if (!Number.isFinite(mins) || mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/** Who leads the line: "You", else the member's name. */
export function feedWho(lead: ActivityPerson): string {
  if (lead.isYou) return "You";
  return lead.name;
}

/** "per" → "per•••": the username blocked after its first letters. */
export function maskedHandle(hint: string | null): string | null {
  return hint ? `${hint}•••` : null;
}

/** An approximate follower count: 47 → "40+", 760 → "700+", 4,820 → "4.8K",
 *  12,400 → "12K", 1,250,000 → "1.2M". Zero or less → null. */
export function approxFollowers(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 10) return String(Math.trunc(n));
  if (n < 100) return `${Math.floor(n / 10) * 10}+`;
  if (n < 1000) return `${Math.floor(n / 100) * 100}+`;
  const [div, unit] = n < 1_000_000 ? [1000, "K"] : [1_000_000, "M"];
  const v = n / div;
  const shown = v < 10 ? Math.floor(v * 10) / 10 : Math.floor(v);
  return `${String(shown).replace(/\.0$/, "")}${unit}`;
}

/** The Instagram proof on a row's quiet line ("per••• · 1.2K followers"; the
 *  glyph before it says Instagram), or null without Instagram (or for the
 *  guest's own row). */
export function feedInstagram(lead: ActivityPerson): string | null {
  const handle = lead.isYou ? null : maskedHandle(lead.handleHint);
  if (!handle) return null;
  const followers = approxFollowers(lead.followers);
  return followers ? `${handle} · ${followers} followers` : handle;
}

/** The feed's day headings, in the order they draw (MESITA-2525). */
export const FEED_DAYS = ["Today", "Yesterday", "This week", "Earlier"] as const;
export type FeedDay = (typeof FEED_DAYS)[number];

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** The heading a row sits under, by the guest's local calendar day. */
export function feedDay(iso: string, now = Date.now()): FeedDay {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "Earlier";
  // Rounded: a DST night makes a calendar day 23 or 25 hours long.
  const days = Math.round((startOfDay(now) - startOfDay(at)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Earlier";
}

/** The rows under their day headings; within a day, the server's order. */
export function feedSections(
  rows: readonly ActivityFeedItem[],
  now = Date.now(),
): { day: FeedDay; rows: ActivityFeedItem[] }[] {
  return FEED_DAYS.map((day) => ({
    day,
    rows: rows.filter((row) => feedDay(row.at, now) === day),
  })).filter((section) => section.rows.length > 0);
}

/** " and 4 others liked" / " visited": the sentence after the name. */
export function feedVerbPhrase(
  item: Pick<ActivityFeedItem, "others" | "kind">,
): string {
  const verb = VERB[item.kind];
  if (item.others <= 0) return verb;
  return `and ${item.others} ${item.others === 1 ? "other" : "others"} ${verb}`;
}

/** "Perdón and 4 others liked" / "You visited". */
export function feedSentence(
  item: Pick<ActivityFeedItem, "lead" | "others" | "kind">,
): string {
  return `${feedWho(item.lead)} ${feedVerbPhrase(item)}`;
}

/** The verb's badge on the face (MESITA-2525): ink, so the list scans by
 *  shape; the sentence still says the verb for a screen reader. */
const VERB_ICON: Record<ActivityKind, LucideIcon> = {
  saved: Heart,
  went: MapPin,
  viewed: Eye,
};

/** Lucide dropped its brand marks, so Instagram is drawn here in lucide's
 *  own 24px grid, stroke and caps (the way family-icons draws the taco). */
function InstagramGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </svg>
  );
}

/** The member's Instagram picture, or their initial, wearing the verb. */
function Face({ person, kind }: { person: ActivityPerson; kind: ActivityKind }) {
  const Glyph = VERB_ICON[kind];
  return (
    <span className="relative h-11 w-11 shrink-0">
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.avatarUrl}
          alt=""
          className="h-11 w-11 rounded-full object-cover"
        />
      ) : (
        <span className="bg-muted text-foreground flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold">
          {firstInitial(person.name.replace(/^@/, ""))}
        </span>
      )}
      <span
        aria-hidden
        className="bg-foreground text-background ring-card absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full ring-2"
        data-social-verb={kind}
      >
        <Glyph
          className="h-[11px] w-[11px]"
          strokeWidth={2.75}
          fill={kind === "saved" ? "currentColor" : "none"}
        />
      </span>
    </span>
  );
}

/** The place's photo, else the card placeholder — never an empty box
 *  (a Google-only place never shows a photo, lib/place-placeholder.ts). */
function Thumb({ place }: { place: Place }) {
  const photo = cardPhoto(place);
  if (photo) {
    return (
      <span className="bg-muted h-11 w-11 shrink-0 overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  const placeholder = placePlaceholder(place);
  return (
    <span
      className="bg-muted text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
      data-placeholder={placeholder.kind}
    >
      {placeholder.kind === "family" ? (
        <FamilyIcon name={placeholder.family} className="h-5 w-5" />
      ) : (
        <span aria-hidden className="text-sm font-semibold">
          {placeholder.text}
        </span>
      )}
    </span>
  );
}

function FeedRow({ item }: { item: ActivityFeedItem }) {
  const instagram = feedInstagram(item.lead);
  const ago = shortAgo(item.at);
  return (
    <li>
      <Link
        href={placeHref(item.place.slug || item.place.id)}
        className="hover:bg-muted/60 focus-visible:bg-muted/60 flex items-center gap-3 px-4 py-3 transition focus-visible:outline-none"
        data-social-row
      >
        <Face person={item.lead} kind={item.kind} />
        <div className="min-w-0 flex-1">
          <p className="text-foreground line-clamp-2 text-sm leading-snug">
            <span className="font-semibold">{feedWho(item.lead)}</span>{" "}
            {feedVerbPhrase(item)}{" "}
            <span className="font-semibold">{item.place.name}</span>
          </p>
          <p
            className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs"
            data-social-quiet
          >
            {instagram ? (
              <>
                <InstagramGlyph className="h-3 w-3 shrink-0" />
                <span className="sr-only">Instagram</span>
                <span className="truncate" data-social-instagram>
                  {instagram}
                </span>
                <span aria-hidden>·</span>
              </>
            ) : null}
            <span className="shrink-0">{ago}</span>
          </p>
        </div>
        <Thumb place={item.place} />
      </Link>
    </li>
  );
}

/** Loading looks like the rows it waits for. */
function FeedSkeleton() {
  return (
    <div className="divide-border divide-y" data-social-loading aria-busy>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-11 w-11 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** The rows to draw: the real feed, else the sample over `samplePlaces`
 *  (MESITA-2520) — never both. */
export function feedRows(
  items: ActivityFeedItem[],
  samplePlaces: readonly Place[],
  now = Date.now(),
): { rows: ActivityFeedItem[]; sample: boolean } {
  if (items.length > 0) return { rows: items, sample: false };
  const rows = sampleActivity(samplePlaces, now);
  return { rows, sample: rows.length > 0 };
}

export function SocialFeed({
  samplePlaces = [],
}: {
  /** Home's All places: the sample's real places while the feed is empty. */
  samplePlaces?: readonly Place[];
}) {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const origin = useActiveLocation();
  const from = origin ?? coords;
  const fromKey = from
    ? `${from.lat.toFixed(2)},${from.lng.toFixed(2)}`
    : "none";
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; items: ActivityFeedItem[] }
  >({ status: "loading" });
  // Bumped by Try again: the effect refetches.
  const [attempt, setAttempt] = useState(0);
  const headingId = useId();

  useEffect(() => {
    let cancelled = false;
    apiListActivityFeed(
      supabase,
      from ? { lat: from.lat, lng: from.lng } : null,
    )
      .then((items) => {
        if (!cancelled) setState({ status: "ready", items });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: errMsg(err, "Couldn't load Social"),
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, fromKey, attempt]);

  const feed = useMemo(() => {
    const { rows, sample } = feedRows(
      state.status === "ready" ? state.items : [],
      samplePlaces,
    );
    return { rows, sample, sections: feedSections(rows) };
  }, [state, samplePlaces]);

  if (state.status === "loading") return <FeedSkeleton />;
  if (state.status === "error") {
    return (
      <EmptyState
        icon={Users}
        title="Couldn't load Social"
        description={state.message}
        action={{
          label: "Try again",
          onClick: () => {
            setState({ status: "loading" });
            setAttempt((n) => n + 1);
          },
        }}
      />
    );
  }
  if (feed.rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No activity yet"
        description="When members with Instagram like, view or visit a place, it shows up here."
      />
    );
  }
  return (
    <div className="pb-6">
      {feed.sample ? (
        <p
          className="type-meta text-muted-foreground px-4 pt-3 tracking-[0.08em] uppercase"
          data-social-sample
        >
          Sample activity
        </p>
      ) : null}
      {feed.sections.map(({ day, rows }) => {
        const id = `${headingId}-${day.replace(/\s+/g, "-")}`;
        return (
          <section key={day} aria-labelledby={id} data-social-day={day}>
            <h2
              id={id}
              className="text-foreground px-4 pt-4 pb-1 text-base font-semibold"
            >
              {day}
            </h2>
            <ul role="list" className="divide-border divide-y">
              {rows.map((item, i) => (
                <FeedRow
                  key={`${i}|${item.placeId}|${item.kind}`}
                  item={item}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
