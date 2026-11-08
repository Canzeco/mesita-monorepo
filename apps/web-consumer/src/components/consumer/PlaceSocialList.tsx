"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { apiListActivityFeed, type ActivityFeedItem } from "@/lib/api/activity";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { Face, VERB, feedWho, shortAgo } from "@/components/consumer/home/SocialFeed";

// THE PLACE'S SOCIAL TAB (Pato, MESITA-3417: "social is just the
// notifications for one given place. easy peasy. like all the people that saw
// that profile"): Home › Social's rows for this one place, newest first. The
// place is the screen, so a row is the face, who did what, and when; no place
// photo. Who is named follows Home › Social (consumer-web-list-activity).
// IN A CARD LIKE REVIEWS (Pato, MESITA-3418: "put social in a box, same as
// with google review"): a white rounded card on the page's grey, rows split
// by hairlines, Show more its last row; every state sits in the same card.

const CARD = "bg-card border-border divide-border flex flex-col divide-y overflow-hidden rounded-xl border";

type State =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; items: ActivityFeedItem[]; next: string | null; more: boolean };

export function PlaceSocialList({ placeId }: { placeId: string }) {
  const supabase = useBrowserSupabase();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let live = true;
    apiListActivityFeed(supabase, null, undefined, placeId)
      .then((page) => {
        if (live) setState({ status: "ready", items: page.items, next: page.next, more: false });
      })
      .catch(() => {
        if (live) setState({ status: "failed" });
      });
    return () => {
      live = false;
    };
  }, [supabase, placeId]);

  const loadMore = () => {
    if (state.status !== "ready" || !state.next || state.more) return;
    const shown = state;
    setState({ ...shown, more: true });
    apiListActivityFeed(supabase, null, shown.next ?? undefined, placeId)
      .then((page) =>
        setState({ status: "ready", items: [...shown.items, ...page.items], next: page.next, more: false }),
      )
      .catch(() => setState({ ...shown, more: false }));
  };

  if (state.status === "loading") {
    return (
      <ul className={CARD} aria-busy data-place-social="loading">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 p-4">
            <span className="bg-muted h-11 w-11 shrink-0 animate-pulse rounded-full" />
            <span className="bg-muted h-4 flex-1 animate-pulse rounded" />
          </li>
        ))}
      </ul>
    );
  }
  if (state.status === "failed") {
    return (
      <div className={CARD}>
        <p className="text-muted-foreground p-6 text-center text-sm" data-place-social="failed">
          Couldn&apos;t load this place&apos;s activity.
        </p>
      </div>
    );
  }
  if (state.items.length === 0 && !state.next) {
    return (
      <div className={CARD}>
        <p className="text-muted-foreground p-6 text-center text-sm" data-place-social="empty">
          No one has viewed or liked this place yet.
        </p>
      </div>
    );
  }
  return (
    <div className={CARD} data-place-social="list">
      <ul className="divide-border flex flex-col divide-y">
        {state.items.map((item) => (
          <li key={`${item.at}-${item.kind}-${feedWho(item.person)}`} className="flex items-center gap-3 p-4">
            <Face person={item.person} />
            <span className="min-w-0 flex-1">
              <span className="text-foreground line-clamp-2 text-sm leading-snug">
                <span className="font-semibold">{feedWho(item.person)}</span> {VERB[item.kind]} this place
              </span>
              <span className="text-muted-foreground mt-0.5 flex items-center gap-0.5 text-xs">
                <Clock className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                {shortAgo(item.at)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {state.next ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={state.more}
          className="text-foreground hover:bg-muted/50 h-11 w-full text-sm font-semibold disabled:opacity-60"
        >
          {state.more ? "Loading…" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
