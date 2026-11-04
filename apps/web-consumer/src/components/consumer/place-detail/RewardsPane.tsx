"use client";

import { Fragment, useEffect, useState } from "react";
import { VisitQr } from "@/components/consumer/rewards/VisitQr";
import {
  apiGetPlaceRewards,
  type PlaceReward,
  type PlaceRewards,
  type RewardKind,
} from "@/lib/api/rewards";
import { MOCK_REWARDS } from "@/lib/mock-rewards";
import type { PlaceDetail } from "@/lib/place-detail";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// THE REWARDS TAB'S BODY (MESITA-3202). What this place offers and which are
// this guest's. The guest enters the bill and shows the QR to staff, who close the
// visit at visit.mesita.ai. A discount the place gives on today's bill: no
// money moves through Mesita. Who qualifies and every number is the server's.

const NAME: Record<RewardKind, string> = {
  welcome_visit: "Welcome Visit",
  returning_visit: "Returning Visit",
  instagram_story: "Instagram Story",
  vip_class: "VIP Class",
};

const LINE: Record<RewardKind, string> = {
  welcome_visit: "Your first visit here.",
  returning_visit: "Every visit after your first.",
  instagram_story: "Post a story about this place and show it to staff. You need 1,000 or more Instagram followers and a public profile.",
  vip_class: "For VIP guests.",
};

/** Why Story is off for this guest (MESITA-3224). The server decides. */
const WHY_OFF: Record<string, string> = {
  instagram_not_connected: "Connect your Instagram in Me to use this.",
  not_enough_followers: "Your Instagram is under 1,000 followers.",
};

/** The Cap is in pesos, on the whole bill, whatever adds up (MESITA-3210). */
function capLine(cents: number | null | undefined): string {
  if (cents == null) return "";
  return ` At most $${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} MXN off a bill.`;
}

export function RewardsPane({ place }: { place: PlaceDetail }) {
  // Memoized, unlike the lazy getter: the effect below depends on it, and a new
  // value every render would fetch forever (MESITA-3207).
  const supabase = useBrowserSupabase();
  const [data, setData] = useState<PlaceRewards | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    apiGetPlaceRewards(supabase, place.id).then(
      (rewards) => {
        if (live) setData(rewards);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [supabase, place.id, attempt]);

  if (failed && !data) {
    return (
      <div className="border-border bg-card rounded-2xl border p-4">
        <p className="font-semibold">Rewards didn&apos;t load.</p>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
          className="text-muted-foreground mt-1 text-sm underline"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="border-border bg-card text-muted-foreground rounded-2xl border p-4 text-sm" aria-busy>
        Loading…
      </div>
    );
  }
  // Real rewards where a place has them on, else the mock (MESITA-3218).
  const rewards = data.rewards.length > 0 ? data.rewards : MOCK_REWARDS;
  if (rewards.length === 0) {
    return (
      <div className="border-border bg-card rounded-2xl border p-4">
        <p className="font-semibold">No rewards here yet</p>
        <p className="text-muted-foreground mt-1 text-sm">When this place offers rewards, they show up here.</p>
      </div>
    );
  }

  const usable = rewards.some((r) => r.eligible);
  // (Welcome or Returning) + Story + VIP (Pato, MESITA-3210): the first two share
  // a row, because a visit is one or the other; the rest add on.
  const firstOrLater = rewards.filter((r) => r.kind === "welcome_visit" || r.kind === "returning_visit");
  const addOns = rewards.filter((r) => r.kind !== "welcome_visit" && r.kind !== "returning_visit");
  const cell = (r: PlaceReward) => (
    <div className={cn("min-w-0 flex-1", !r.eligible && data.signed_in && "opacity-50")}>
      <p className="font-semibold">{NAME[r.kind]}</p>
      <p className="text-fact-reward text-sm font-semibold tabular-nums">{r.percent}% OFF</p>
      <p className="text-muted-foreground text-sm">{LINE[r.kind]}</p>
      {r.reason && WHY_OFF[r.reason] ? <p className="text-sm font-medium">{WHY_OFF[r.reason]}</p> : null}
    </div>
  );
  return (
    <section className="border-border bg-card flex flex-col rounded-2xl border" aria-label="Rewards">
      <ul className="divide-border divide-y">
        {firstOrLater.length > 0 ? (
          <li className="flex items-start gap-3 p-4">
            {firstOrLater.map((r, i) => (
              <Fragment key={r.kind}>
                {i > 0 ? <span className="text-muted-foreground shrink-0 pt-0.5 text-sm font-medium">or</span> : null}
                {cell(r)}
              </Fragment>
            ))}
          </li>
        ) : null}
        {addOns.map((r, i) => (
          <li key={r.kind} className="flex items-start gap-3 p-4">
            {firstOrLater.length > 0 || i > 0 ? (
              <span aria-label="plus" className="text-muted-foreground shrink-0 font-semibold">
                +
              </span>
            ) : null}
            {cell(r)}
          </li>
        ))}
      </ul>
      <div className="border-border border-t p-4">
        {usable ? (
          <VisitQr placeId={place.id} />
        ) : (
          <p className="text-muted-foreground text-sm">
            {data.signed_in ? "None of these apply to you right now." : "Sign in to use a reward."}
          </p>
        )}
        <p className="text-muted-foreground mt-3 text-sm">
          The ones you qualify for add up, and the place takes them off today&apos;s bill.
          {capLine(rewards[0]?.cap_cents)}
        </p>
      </div>
    </section>
  );
}
