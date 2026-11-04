"use client";

// Four rewards and the Cap, each on or off (MESITA-3202). What each is worth
// comes from the server, so nothing here sets a number. The owner and Mesita
// staff change them; the server refuses anyone else.

import { useState } from "react";
import { Card } from "@/components/shell/Page";
import { Switch } from "@/components/ui/config";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { setPlaceReward, type PlaceRewards, type RewardKind } from "@/lib/business-api";
import { money, REWARD_COPY } from "@/lib/rewards";

const ROW = "flex min-h-14 items-center gap-3 px-5 py-3 text-sm sm:px-6";

function Reward({
  name,
  line,
  on,
  pending,
  onClick,
}: {
  name: string;
  line: string;
  on: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{name}</p>
        <p className="text-muted-foreground">{line}</p>
      </div>
      <Switch on={on} pending={pending} onClick={onClick} label={`${name}: ${on ? "on" : "off"}`} />
    </>
  );
}

export function RewardsCard({ placeId, initial, canEdit }: { placeId: string; initial: PlaceRewards; canEdit: boolean }) {
  const [state, setState] = useState<PlaceRewards>(initial);
  const [busy, setBusy] = useState<RewardKind | "cap" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function flip(key: RewardKind | "cap", enabled: boolean) {
    setBusy(key);
    setError(null);
    const r = await setPlaceReward(placeId, key, enabled);
    setBusy(null);
    if (r.ok) setState(r.data);
    else setError(r.error);
  }

  const capAmount = money(state.cap.cents, "MXN");
  const [welcome, returning, story, vip] = (["welcome_visit", "returning_visit", "instagram_story", "vip_class"] as const).map(
    (kind) => state.rewards.find((r) => r.kind === kind) ?? { kind, percent: 0, enabled: false },
  );
  const props = (r: PlaceRewards["rewards"][number]) => ({
    name: `${REWARD_COPY[r.kind].name} · ${r.percent}%`,
    line: REWARD_COPY[r.kind].line,
    on: r.enabled,
    pending: !canEdit || busy !== null,
    onClick: () => void flip(r.kind, !r.enabled),
  });
  return (
    <>
      <Card className="flex flex-col p-0 sm:p-0">
        <ul className="divide-border divide-y">
          {/* This OR that (Pato, MESITA-3210): a visit is a first one or a later one. */}
          <li className={ROW}>
            <Reward {...props(welcome)} />
            <span className="text-muted-foreground shrink-0 px-2 font-medium">or</span>
            <Reward {...props(returning)} />
          </li>
          {[story, vip].map((r) => (
            <li key={r.kind} className={ROW}>
              <Reward {...props(r)} />
            </li>
          ))}
          <li className={ROW}>
            <Reward
              name={`Cap · ${capAmount}`}
              line={`No bill gets more than ${capAmount} off, however many rewards add up.`}
              on={state.cap.enabled}
              pending={!canEdit || busy !== null}
              onClick={() => void flip("cap", !state.cap.enabled)}
            />
          </li>
        </ul>
      </Card>
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
      {!canEdit ? <p className="text-muted-foreground text-sm">Only the owner can change rewards.</p> : null}
      <p className="text-muted-foreground text-sm">
        Welcome or Returning, plus Story, plus VIP Class: they add up on one bill.
      </p>
    </>
  );
}
