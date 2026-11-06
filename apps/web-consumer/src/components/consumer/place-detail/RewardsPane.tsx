"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { capLine, RewardList } from "@/components/consumer/rewards/RewardList";
import { seedRewardPlace } from "@/components/consumer/rewards/reward-place-seed";
import { apiGetPlaceRewards, type PlaceRewards } from "@/lib/api/rewards";
import { rewardStepPath } from "@/lib/consumer-route-contract";
import type { PlaceDetail } from "@/lib/place-detail";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";

// THE REWARDS TAB'S BODY (MESITA-3202). What this place offers and which are
// this guest's. "Use my reward" goes to Pay and opens the steps there (Pato,
// MESITA-3254: "never fucking ask bill there"), and staff close the visit at
// visit.mesita.ai. A discount the place gives on today's bill: no money moves
// through Mesita. Who qualifies and every number is the server's.

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
  const rewards = data.rewards;
  if (rewards.length === 0) {
    return (
      <div className="border-border bg-card rounded-2xl border p-4">
        <p className="font-semibold">No rewards here yet</p>
        <p className="text-muted-foreground mt-1 text-sm">When this place offers rewards, they show up here.</p>
      </div>
    );
  }

  const usable = rewards.some((r) => r.eligible);
  return (
    <section className="border-border bg-card flex flex-col rounded-2xl border" aria-label="Rewards">
      <RewardList rewards={rewards} signedIn={data.signed_in} />
      <div className="border-border border-t p-4">
        {usable ? (
          <Link
            href={rewardStepPath(place.id)}
            onClick={() => seedRewardPlace(place.id, place.name, place.photos?.[0])}
            className={PRIMARY_BUTTON_CLASS}
          >
            Use my reward
          </Link>
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
