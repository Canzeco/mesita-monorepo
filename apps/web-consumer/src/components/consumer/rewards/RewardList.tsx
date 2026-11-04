import { Fragment } from "react";
import type { PlaceReward, RewardKind } from "@/lib/api/rewards";
import { cn } from "@/lib/utils";

// What a place offers and which are this guest's (MESITA-3202), for the place's
// Rewards tab and the Reward step (MESITA-3250). Who qualifies and every number
// is the server's.

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
export function capLine(cents: number | null | undefined): string {
  if (cents == null) return "";
  return ` At most $${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} MXN off a bill.`;
}

export function RewardList({ rewards, signedIn }: { rewards: PlaceReward[]; signedIn: boolean }) {
  // (Welcome or Returning) + Story + VIP (Pato, MESITA-3210): the first two share
  // a row, because a visit is one or the other; the rest add on.
  const firstOrLater = rewards.filter((r) => r.kind === "welcome_visit" || r.kind === "returning_visit");
  const addOns = rewards.filter((r) => r.kind !== "welcome_visit" && r.kind !== "returning_visit");
  const cell = (r: PlaceReward) => (
    <div className={cn("min-w-0 flex-1", !r.eligible && signedIn && "opacity-50")}>
      <p className="font-semibold">{NAME[r.kind]}</p>
      <p className="text-fact-reward text-sm font-semibold tabular-nums">{r.percent}% OFF</p>
      <p className="text-muted-foreground text-sm">{LINE[r.kind]}</p>
      {r.reason && WHY_OFF[r.reason] ? <p className="text-sm font-medium">{WHY_OFF[r.reason]}</p> : null}
    </div>
  );
  return (
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
  );
}
