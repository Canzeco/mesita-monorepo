"use client";

// Rewards read like the bill (MESITA-3228): one row per reward, then the Cap, then
// the most a guest can get. What each is worth comes from the server, so nothing
// here sets a number. The owner and Mesita staff change them; the server refuses
// anyone else.

import { useState } from "react";
import { Card } from "@/components/shell/Page";
import { Switch } from "@/components/ui/config";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { setPlaceReward, type PlaceRewards, type RewardKind } from "@/lib/business-api";
import { mostPercent, money, REWARD_COPY } from "@/lib/rewards";

// The last column is the Switch's own width, so the total lines up with the numbers.
const ROW = "grid min-h-14 grid-cols-[minmax(0,1fr)_auto_3rem] items-center gap-4 px-5 py-3 text-sm sm:px-6";

function Row({
  name,
  line,
  value,
  on,
  pending,
  onClick,
}: {
  name: string;
  line: string;
  value: string;
  on: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <li className={ROW}>
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="text-muted-foreground">{line}</p>
      </div>
      <p className={cn("font-medium whitespace-nowrap tabular-nums", !on && "text-muted-foreground")}>{value}</p>
      <Switch on={on} pending={pending} onClick={onClick} label={`${name}: ${on ? "on" : "off"}`} />
    </li>
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

  const pending = !canEdit || busy !== null;
  const capAmount = money(state.cap.cents, "MXN");
  const most = mostPercent(state.rewards);
  const limit = most === 0 ? "Guests pay the full bill." : state.cap.enabled ? `Never more than ${capAmount} off.` : "No limit in pesos.";
  const rewards = (["welcome_visit", "returning_visit", "instagram_story", "vip_class"] as const).map(
    (kind) => state.rewards.find((r) => r.kind === kind) ?? { kind, percent: 0, enabled: false },
  );
  return (
    <>
      <Card className="flex flex-col overflow-hidden p-0 sm:p-0">
        <ul className="divide-border divide-y">
          {rewards.map((r) => (
            <Row
              key={r.kind}
              name={REWARD_COPY[r.kind].name}
              line={REWARD_COPY[r.kind].line}
              value={`${r.percent}%`}
              on={r.enabled}
              pending={pending}
              onClick={() => void flip(r.kind, !r.enabled)}
            />
          ))}
          <Row
            name="Cap"
            line="No bill gets more than this off."
            value={capAmount}
            on={state.cap.enabled}
            pending={pending}
            onClick={() => void flip("cap", !state.cap.enabled)}
          />
          <li className={cn(ROW, "bg-muted")}>
            <div className="min-w-0">
              <p className="font-semibold">The most a guest can get</p>
              <p className="text-muted-foreground">{limit}</p>
            </div>
            <p className="font-semibold tabular-nums">{most}%</p>
          </li>
        </ul>
      </Card>
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
      {!canEdit ? <p className="text-muted-foreground text-sm">Only the owner can change rewards.</p> : null}
    </>
  );
}
