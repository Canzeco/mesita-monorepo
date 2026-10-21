"use client";

// Home › Social (MESITA-2442): where members go. Activity, not reviews.
// It is Home's Social tab, full width (MESITA-2474, MESITA-2517); the tab
// is its title, so it has no header and no scroller of its own.
//
// OLD-INSTAGRAM NOTIFICATIONS (Pato, MESITA-2515: "display the instagram
// profile of the person and the username and the name just as those old
// instagram notifications. keep super super simple"):
//
//   (●) Perdón liked Contramar. 2h                         [▢]
//       Instagram · per••• · 1.2K followers
//
// The member's picture, then one line: the name (bold), the verb, the place
// (bold), the time (muted); under it, muted, the member's Instagram as social
// proof — three letters of the username and an approximate follower count,
// never the whole username (Pato, MESITA-2522: "i don't really want the
// instagram username since it might cause the users to abandond my app …
// mentioing the number of followers because that is all the social proof is
// about"). No Instagram → no second line. The place's photo on the right. Three verbs — liked (stored `saved`), visited (stored
// `went`), viewed (stored `viewed`); the labels changed, never the keys.
// Same place + same verb is one item ("perdon and 4 others liked
// Contramar"). The server orders it: newest day first, and within a day the
// places nearer the guest first. Only Instagram-connected members who left
// Show my activity on ever appear (consumer-web-list-activity). No activity
// → SAMPLE rows (MESITA-2520, lib/social-sample.ts): made-up members on
// Home's real places, under one quiet "Sample activity" line, never mixed
// with real rows; with no places either, the empty state.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
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
import { cardPhoto } from "@/lib/place-placeholder";
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

/** The muted Instagram line under a row, or null without Instagram (or for
 *  the guest's own row). */
export function feedInstagram(lead: ActivityPerson): string | null {
  const handle = lead.isYou ? null : maskedHandle(lead.handleHint);
  if (!handle) return null;
  const followers = approxFollowers(lead.followers);
  return followers
    ? `Instagram · ${handle} · ${followers} followers`
    : `Instagram · ${handle}`;
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

/** The member's Instagram picture, or their initial. */
function Face({ person }: { person: ActivityPerson }) {
  return person.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={person.avatarUrl}
      alt=""
      className="h-11 w-11 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span className="bg-muted text-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
      {firstInitial(person.name.replace(/^@/, ""))}
    </span>
  );
}

function FeedRow({ item }: { item: ActivityFeedItem }) {
  const photo = cardPhoto(item.place);
  const instagram = feedInstagram(item.lead);
  return (
    <li>
      <Link
        href={placeHref(item.place.slug || item.place.id)}
        className="hover:bg-muted/60 flex items-center gap-3 px-4 py-3 transition"
        data-social-row
      >
        <Face person={item.lead} />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm leading-snug">
            <span className="font-semibold">{feedWho(item.lead)}</span>{" "}
            {feedVerbPhrase(item)}{" "}
            <span className="font-semibold">{item.place.name}</span>.{" "}
            <span className="text-muted-foreground">{shortAgo(item.at)}</span>
          </p>
          {instagram ? (
            <p
              className="text-muted-foreground mt-0.5 truncate text-xs"
              data-social-instagram
            >
              {instagram}
            </p>
          ) : null}
        </div>
        <span className="bg-muted h-11 w-11 shrink-0 overflow-hidden rounded-md">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : null}
        </span>
      </Link>
    </li>
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
  }, [supabase, fromKey]);

  const feed = useMemo(
    () => feedRows(state.status === "ready" ? state.items : [], samplePlaces),
    [state, samplePlaces],
  );

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-3 p-4" data-social-loading>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <EmptyState
        icon={Users}
        title="Couldn't load Social"
        description={state.message}
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
      <ul role="list" aria-label="Social" className="divide-border divide-y">
        {feed.rows.map((item, i) => (
          <FeedRow key={`${i}|${item.placeId}|${item.kind}`} item={item} />
        ))}
      </ul>
    </div>
  );
}
