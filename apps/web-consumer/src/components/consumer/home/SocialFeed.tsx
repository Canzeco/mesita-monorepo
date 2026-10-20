"use client";

// Home › Social (MESITA-2442): where members go. Activity, not reviews.
//
//   (P) Perdón @perdon · 12.4K                     2h
//       went to Contramar                    [photo]
//
// Three verbs only — saved, viewed (opened the profile), went ("I went").
// Same place + same verb is one item ("Perdón and 4 others saved
// Contramar"). The server orders it: newest day first, and within a day the
// places nearer the guest first. Only Instagram-connected members who left
// Show my activity on ever appear (consumer-web-list-activity). No activity
// → the empty state; there is no mock row.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import {
  apiListActivityFeed,
  type ActivityFeedItem,
  type ActivityKind,
  type ActivityPerson,
} from "@/lib/api/activity";
import { useActiveLocation } from "@/lib/active-location";
import { useUserLocation } from "@/lib/use-user-location";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { placeHref } from "@/lib/place-route";
import { cardPhoto } from "@/lib/place-placeholder";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { EmptyState } from "@/components/shared";
import { Skeleton } from "@/components/shared/Skeleton";
import { errMsg, firstInitial, formatCompactCount } from "@/lib/utils";

const VERB: Record<ActivityKind, string> = {
  saved: "saved",
  viewed: "looked at",
  went: "went to",
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

/** "Perdón and 4 others saved" / "You went to". */
export function feedSentence(item: Pick<ActivityFeedItem, "lead" | "others" | "kind">): string {
  const who = item.lead.isYou ? "You" : item.lead.name;
  const verb = VERB[item.kind];
  if (item.others <= 0) return `${who} ${verb}`;
  return `${who} and ${item.others} ${item.others === 1 ? "other" : "others"} ${verb}`;
}

function Face({ person, size }: { person: ActivityPerson; size: string }) {
  return person.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={person.avatarUrl}
      alt=""
      className={`${size} border-card rounded-full border-2 object-cover`}
    />
  ) : (
    <span
      className={`${size} border-card bg-muted text-foreground flex items-center justify-center rounded-full border-2 text-xs font-semibold`}
    >
      {firstInitial(person.name.replace(/^@/, ""))}
    </span>
  );
}

function FeedRow({ item }: { item: ActivityFeedItem }) {
  const photo = cardPhoto(item.place);
  const lead = item.lead;
  return (
    <li>
      <Link
        href={placeHref(item.place.slug || item.place.id)}
        className="hover:bg-muted/60 flex items-start gap-3 px-4 py-3 transition"
      >
        <span className="flex shrink-0 -space-x-3" aria-hidden>
          {item.people.map((p, i) => (
            <Face key={i} person={p} size="h-10 w-10" />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground type-label block truncate">
            {lead.handle ? `@${lead.handle}` : lead.name}
            {lead.followers > 0
              ? ` · ${formatCompactCount(lead.followers)} followers`
              : ""}
          </span>
          <span className="text-foreground block text-sm leading-snug">
            {feedSentence(item)}{" "}
            <span className="font-semibold">{item.place.name}</span>
          </span>
          <span className="text-muted-foreground type-label block">
            {shortAgo(item.at)}
          </span>
        </span>
        <span className="bg-muted h-14 w-14 shrink-0 overflow-hidden rounded-xl">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : null}
        </span>
      </Link>
    </li>
  );
}

export function SocialFeed() {
  const supabase = useBrowserSupabase();
  const coords = useUserLocation();
  const origin = useActiveLocation();
  const from = origin ?? coords;
  const fromKey = from ? `${from.lat.toFixed(2)},${from.lng.toFixed(2)}` : "none";
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; items: ActivityFeedItem[] }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    apiListActivityFeed(supabase, from ? { lat: from.lat, lng: from.lng } : null)
      .then((items) => {
        if (!cancelled) setState({ status: "ready", items });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ status: "error", message: errMsg(err, "Couldn't load Social") });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, fromKey]);

  return (
    <div className="bg-card flex min-h-0 flex-1 flex-col">
      <div className="border-border flex shrink-0 items-center gap-2 border-b px-2 py-2">
        <Link
          href={CONSUMER_ROUTES.discoverDefault}
          aria-label="Back to Home"
          className="hover:bg-muted flex h-11 w-11 items-center justify-center rounded-full transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-lg font-semibold tracking-tight">
          Social
        </h1>
      </div>
      <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        {state.status === "loading" ? (
          <div className="flex flex-col gap-3 p-4" data-social-loading>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <EmptyState
            icon={Users}
            title="Couldn't load Social"
            description={state.message}
            action={{ label: "Try again", href: CONSUMER_ROUTES.discoverSocial }}
          />
        ) : state.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No activity yet"
            description="When members with Instagram save a place, open one, or tap I went, it shows up here."
            action={{ label: "Find a place", href: CONSUMER_ROUTES.discoverDefault }}
          />
        ) : (
          <ul role="list" aria-label="Social" className="divide-border divide-y pb-6">
            {state.items.map((item) => (
              <FeedRow key={`${item.placeId}|${item.kind}`} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
