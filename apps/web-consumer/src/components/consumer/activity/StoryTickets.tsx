"use client";

// TICKETS › STORIES (MESITA-4405, Pato 2026-11-18: Tickets is Visits ·
// Vouchers · Gifts · Stories): every open Story first, then the 20 most
// recently decided, from the Wallet read's `stories`. A row is the place,
// the bonus, the state in its tone and the one line of what to do now; it
// opens the Story's screen. The tab is always shown (an empty list says so).

import { PushLink } from "@/components/consumer/nav/PushLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { Instagram } from "@/components/shared/instagram-icon";
import type { StoryTicket } from "@/lib/api/wallet";
import { CONSUMER_ROUTES, storyTicketPath } from "@/lib/consumer-route-contract";
import { storyBonus, storyLine, storyStatus } from "@/lib/story-ticket";
import { timeAgo } from "@/lib/time-ago";
import { cn } from "@/lib/utils";
import { ActivityRows } from "./ActivityRow";
import { GIFT_TONE } from "./GiftTickets";

const OPEN = new Set(["waiting_post", "found", "approved"]);

/** Open Stories first (the ones to act on), then the rest; each part keeps
 *  the read's order, newest first. */
export function storyOrder(stories: StoryTicket[]): StoryTicket[] {
  return [...stories.filter((s) => OPEN.has(s.state)), ...stories.filter((s) => !OPEN.has(s.state))];
}

function StoryTicketRow({ s, showPlace, now }: { s: StoryTicket; showPlace: boolean; now: number }) {
  const status = storyStatus(s, now);
  const place = s.place?.name ?? "A Mesita place";
  return (
    <li>
      <PushLink
        href={storyTicketPath(s.story_id)}
        aria-label={`Story at ${place}, ${storyBonus(s)} bonus, ${status.label}`}
        className="hover:bg-muted/40 active:bg-muted/60 flex min-w-0 items-center gap-3 px-4 py-3 transition"
        data-story-ticket={s.state}
      >
        <span className="relative shrink-0" aria-hidden>
          {s.place?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.place.photo} alt="" className="bg-muted h-10 w-10 rounded-xl object-cover" />
          ) : (
            <span className="bg-muted block h-10 w-10 rounded-xl" />
          )}
          <span className="bg-foreground text-background ring-card absolute -right-1 -bottom-1 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-2">
            <Instagram className="h-[11px] w-[11px]" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold break-words tabular-nums">Story bonus {storyBonus(s)}</span>
          <span className="mt-0.5 block text-sm break-words">
            <span className={cn("font-semibold", GIFT_TONE[status.tone])}>{status.label}</span>
          </span>
          <span className="text-muted-foreground mt-0.5 block text-sm break-words tabular-nums">{storyLine(s, now)}</span>
          {showPlace ? <span className="text-muted-foreground mt-0.5 block text-sm break-words">{place}</span> : null}
        </span>
        <span className="text-muted-foreground shrink-0 self-start text-sm tabular-nums">{timeAgo(s.created_at)}</span>
      </PushLink>
    </li>
  );
}

export function StoryTickets({ stories, showPlace = true }: { stories: StoryTicket[]; showPlace?: boolean }) {
  if (stories.length === 0) {
    return (
      <EmptyState
        icon={Instagram}
        title="No Stories yet"
        description="Buy a Story voucher at a place, then post your story there."
        action={{ label: "Find a place", href: CONSUMER_ROUTES.search }}
      />
    );
  }
  // The list's own clock: rows read their deadline against the read's time.
  const now = Date.parse(stories[0].server_time) || 0;
  return (
    <ActivityRows data-story-tickets>
      {storyOrder(stories).map((s) => (
        <StoryTicketRow key={s.story_id} s={s} showPlace={showPlace} now={now} />
      ))}
    </ActivityRows>
  );
}
