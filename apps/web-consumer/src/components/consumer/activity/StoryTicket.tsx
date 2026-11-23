"use client";

// ONE INSTAGRAM STORY, ONE TICKET: /me/tickets/stories/<storyId>
// (MESITA-4747). Pato, 2026-11-23: "Story 1. Post & Tag 2. Bot Checks
// 3. Wait 10 hours 4. Bot Rechecks 5. Get Reward … the structure of the
// ticket must already be built and functional."
//
//   TicketHero     the place's photo with the Instagram badge, "Instagram
//                  Story", Pending · Rejected · Credited (the Stories row's
//                  word, ticket-rows storyRows), the place, when it was
//                  posted, the Test chip on an emulated story
//   VoucherSteps   the five steps, from consumer-web-list-stories
//                  { story_id } (the server's StoryTicket):
//
//   state                        1 Post  2 Check  3 Wait   4 Recheck  5 Reward
//   checking                     done    current  ·        ·          ·
//   verified, recheck ahead      done    done     current  ·          · (amount)
//   verified, recheck due        done    done     done     current    · (amount)
//   rewarded                     done    done     done     done       done +amount
//   rejected at the check        done    failed   ·        ·          ·
//   rejected at the recheck      done    done     done     failed     ·
//
//   A failed step carries the plain reason; the server says which step
//   failed (`failed_at`). The wait's line counts down to the real recheck_at:
//   an emulated story's wait is 2 minutes, so the title stays "Wait 10 hours"
//   and the line says the truth.
//
//   Post another story (filled, the place's Post tab, where test mode keeps
//   its Simulate button) · Open the place (outline)
//
// While a story is checking or waiting, the ticket asks again every 30 s and
// when the page comes back into view, so a running emulator visibly walks
// through its steps. Nothing here writes; no money moves from this page.

import { useEffect, useState } from "react";
import { BadgeDollarSign, Clock3, ScanSearch, ShieldCheck } from "lucide-react";
import { Instagram } from "@/components/shared/instagram-icon";
import { clockTime } from "@mesita/place-profile/lib/money";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { apiGetStory, type StoryTicket as Ticket } from "@/lib/api/story";
import { money } from "@/lib/api/wallet";
import { placeOffersPath, placePath } from "@/lib/consumer-route-contract";
import { ticketsHref } from "@/lib/ticket-kinds";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";
import { PlaceMark, TicketActions, TicketHero, TicketPage, type TicketTone } from "./TicketParts";
import { readyIn, VoucherSteps, type VoucherStep } from "./VoucherSteps";

/** Re-read a moving story this often; the clock ticks faster for the wait. */
const POLL_MS = 30_000;
const TICK_MS = 15_000;

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
const when = (iso: string) => `${day(iso)} · ${clockTime(iso)}`;

/** The Stories row's word for the state (ticket-rows STORY_PILL). */
const STATE: Record<Ticket["state"], [string, TicketTone]> = {
  checking: ["Pending", "ink"],
  verified: ["Pending", "ink"],
  rejected: ["Rejected", "grey"],
  rewarded: ["Credited", "green"],
};

/** The five steps from the server's read and the clock. */
export function storySteps(s: Ticket, nowMs: number): VoucherStep[] {
  const reward = s.reward_cents != null ? money(s.reward_cents, s.currency) : null;
  const due = s.recheck_at != null && Date.parse(s.recheck_at) <= nowMs;
  const failedCheck = s.failed_at === "check";
  const failedRecheck = s.failed_at === "recheck";
  const passedCheck = s.state === "verified" || s.state === "rewarded" || failedRecheck;

  return [
    {
      key: "post",
      Icon: Instagram,
      title: "Post & Tag",
      sub: `Posted ${when(s.posted_at)}`,
      state: "done",
    },
    {
      key: "check",
      Icon: ScanSearch,
      title: "Bot Checks",
      sub: s.state === "checking"
        ? "Checking your tag"
        : failedCheck
          ? s.reason
          : s.checked_at
            ? `Checked ${when(s.checked_at)}`
            : null,
      state: s.state === "checking" ? "current" : failedCheck ? "failed" : "done",
    },
    {
      key: "wait",
      Icon: Clock3,
      title: "Wait 10 hours",
      sub: s.state === "verified" && !due && s.recheck_at ? readyIn(Date.parse(s.recheck_at), nowMs) : null,
      state: !passedCheck ? undefined : s.state === "verified" && !due ? "current" : "done",
    },
    {
      key: "recheck",
      Icon: ShieldCheck,
      title: "Bot Rechecks",
      sub: s.state === "verified" && due
        ? "Rechecking"
        : failedRecheck
          ? s.reason
          : s.state === "rewarded" && s.decided_at
            ? `Rechecked ${when(s.decided_at)}`
            : null,
      state: s.state === "rewarded"
        ? "done"
        : failedRecheck
          ? "failed"
          : s.state === "verified" && due
            ? "current"
            : undefined,
    },
    {
      key: "reward",
      Icon: BadgeDollarSign,
      title: "Get Reward",
      sub: s.state === "rewarded" ? "In your credit at this place" : null,
      amount: s.state === "rewarded"
        ? `+${money(s.credit_cents ?? s.reward_cents ?? 0, s.currency)}`
        : s.state === "verified"
          ? reward
          : null,
      amountTone: s.state === "rewarded" ? "green" : undefined,
      state: s.state === "rewarded" ? "done" : undefined,
    },
  ];
}

export function StoryTicket({ storyId }: { storyId: string }) {
  const getSupabase = useLazyBrowserSupabase();
  const q = useCachedQuery(`story-${storyId}`, () => apiGetStory(getSupabase(), storyId), { ttl: TICK_MS });
  const story = q.data;
  const moving = story?.state === "checking" || story?.state === "verified";
  const [now, setNow] = useState(() => Date.now());
  const { reload } = q;

  // A story on its way re-reads every 30 s and on coming back into view;
  // the clock ticks for the wait's count-down. A decided story sits still.
  useEffect(() => {
    if (!moving) return;
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, POLL_MS);
    const back = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        reload();
      }
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("focus", back);
    };
  }, [moving, reload]);

  return (
    <MeScreen title="Story">
      {story ? (
        <StoryBody story={story} nowMs={now} />
      ) : q.errorStatus === 404 || q.errorStatus === 400 ? (
        // No such story of this guest in this mode, or not a story id: a
        // retry can never work, so the way out is the Stories tab.
        <EmptyState
          icon={Instagram}
          title="This story isn't here"
          description="It may belong to another account or an old link."
          action={{ label: "Back to Stories", href: ticketsHref("stories") }}
        />
      ) : q.error ? (
        <EmptyState
          icon={Instagram}
          title="Couldn't load this story"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: reload }}
        />
      ) : (
        <StoryTicketSkeleton />
      )}
    </MeScreen>
  );
}

function StoryBody({ story: s, nowMs }: { story: Ticket; nowMs: number }) {
  const [state, tone] = STATE[s.state] ?? [s.state, "grey" as TicketTone];
  const placeName = s.place?.name ?? (s.place ? "A Mesita place" : "Checking the place");
  return (
    <TicketPage data-story-ticket>
      <TicketHero
        marks={<PlaceMark photo={s.place?.photo_url} kind="story" />}
        headline="Instagram Story"
        state={state}
        tone={tone}
        place={placeName}
        placeHref={s.place ? placePath(s.place.id) : undefined}
        when={when(s.posted_at)}
        note={s.simulated ? "Test story: the bot's wait is 2 minutes." : null}
        test={s.simulated}
        dim={s.state === "rejected"}
      />
      <VoucherSteps steps={storySteps(s, nowMs)} />
      {s.place ? (
        <TicketActions
          primary={{ label: "Post another story", href: placeOffersPath(s.place.id, "post") }}
          secondary={{ label: "Open the place", href: placePath(s.place.id) }}
        />
      ) : null}
    </TicketPage>
  );
}

/** The ticket's bones: the top box, then the five steps. */
export function StoryTicketSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-4 pb-4" aria-busy>
      <div className="border-border bg-card flex flex-col items-center rounded-2xl border p-4">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <Skeleton className="mt-4 h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-24" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
      <div className="border-border bg-card flex flex-col gap-4 rounded-2xl border px-4 py-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}
