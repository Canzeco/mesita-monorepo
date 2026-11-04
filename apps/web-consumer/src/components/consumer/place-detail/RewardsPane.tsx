"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  apiCreateVisitCode,
  apiGetPlaceRewards,
  type PlaceRewards,
  type RewardKind,
  type VisitCode,
} from "@/lib/api/rewards";
import type { PlaceDetail } from "@/lib/place-detail";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { ERROR_BOX_CLASS, PRIMARY_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn, errMsg } from "@/lib/utils";

// THE REWARDS TAB'S BODY (MESITA-3202). What this place offers and which are
// this guest's. The guest taps for a code and shows it to staff, who log the
// visit in Mesita Business. A discount the place gives on today's bill: no
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
  instagram_story: "Post a story about this place and show it to staff.",
  vip_class: "For VIP guests.",
};

/** Whole pesos when there are no centavos. */
function capLine(cents: number | null): string {
  if (cents == null) return "";
  return ` Up to $${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}.`;
}

function endsAt(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function RewardsPane({ place }: { place: PlaceDetail }) {
  const getSupabase = useLazyBrowserSupabase();
  const [data, setData] = useState<PlaceRewards | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState<VisitCode | null>(null);
  const [asking, setAsking] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiGetPlaceRewards(getSupabase(), place.id).then(
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
  }, [getSupabase, place.id, attempt]);

  async function showCode() {
    setAsking(true);
    setCodeError(null);
    try {
      setCode(await apiCreateVisitCode(getSupabase(), place.id));
    } catch (err) {
      setCodeError(errMsg(err, "Couldn't make a code. Try again."));
    } finally {
      setAsking(false);
    }
  }

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
  if (data.rewards.length === 0) {
    return (
      <div className="border-border bg-card rounded-2xl border p-4">
        <p className="font-semibold">No rewards here yet</p>
        <p className="text-muted-foreground mt-1 text-sm">When this place offers rewards, they show up here.</p>
      </div>
    );
  }

  const usable = data.rewards.some((r) => r.eligible);
  return (
    <section className="border-border bg-card flex flex-col rounded-2xl border" aria-label="Rewards">
      <ul className="divide-border divide-y">
        {data.rewards.map((r) => (
          <li key={r.kind} className={cn("flex items-center gap-3 p-4", !r.eligible && data.signed_in && "opacity-50")}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{NAME[r.kind]}</p>
              <p className="text-muted-foreground text-sm">
                {LINE[r.kind]}
                {capLine(r.cap_cents)}
              </p>
            </div>
            <p className="shrink-0 font-semibold tabular-nums">{r.percent}% off</p>
          </li>
        ))}
      </ul>
      <div className="border-border border-t p-4">
        {code ? (
          <div className="text-center" aria-live="polite">
            <p className="text-3xl font-semibold tracking-[0.2em] tabular-nums">{code.code}</p>
            <p className="text-muted-foreground mt-1 text-sm">Show this to staff. It works until {endsAt(code.expires_at)}.</p>
          </div>
        ) : usable ? (
          <button
            type="button"
            onClick={() => void showCode()}
            disabled={asking}
            className={cn(PRIMARY_BUTTON_CLASS, "h-11 w-full")}
          >
            {asking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Show my code"}
          </button>
        ) : (
          <p className="text-muted-foreground text-sm">
            {data.signed_in ? "None of these apply to you right now." : "Sign in to use a reward."}
          </p>
        )}
        {codeError ? <p className={cn(ERROR_BOX_CLASS, "mt-3")}>{codeError}</p> : null}
        <p className="text-muted-foreground mt-3 text-sm">One per visit. The place takes it off today&apos;s bill.</p>
      </div>
    </section>
  );
}
