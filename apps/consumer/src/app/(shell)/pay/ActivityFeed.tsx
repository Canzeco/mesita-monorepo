"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  GLOBAL_ACTIVITY,
  MY_ACTIVITY,
} from "@/components/consumer/consumer-activity-data";
import { ConsumerActivityList } from "@/components/consumer/ConsumerActivityList";

// Activity strip below the cashback card on /pay. Two tabs:
//
//   Me    — the user's own events.
//   Live  — anonymised public activity stream.

type Tab = "me" | "live";

export function ActivityFeed() {
  const [tab, setTab] = useState<Tab>("me");
  const segment = tab === "me" ? "mine" : "global";
  const items = tab === "me" ? MY_ACTIVITY : GLOBAL_ACTIVITY;

  return (
    <section className="flex flex-col gap-3">
      <header>
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Activity
        </p>
        <h2 className="font-display mt-0.5 text-lg font-semibold tracking-tight">
          {tab === "me" ? "Your recent moves" : "What's happening on Mesita"}
        </h2>
      </header>

      <div className="border-border bg-card flex rounded-full border p-1">
        <PayTabButton
          active={tab === "me"}
          onClick={() => setTab("me")}
          label="Me"
          count={MY_ACTIVITY.length}
        />
        <PayTabButton
          active={tab === "live"}
          onClick={() => setTab("live")}
          label="Live"
          count={GLOBAL_ACTIVITY.length}
          dot
        />
      </div>

      <ConsumerActivityList
        items={items}
        anonymisedNote={segment === "global"}
      />
    </section>
  );
}

function PayTabButton({
  active,
  onClick,
  label,
  count,
  dot = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
        active ? "bg-foreground text-background" : "text-muted-foreground",
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={cn(
              "absolute inset-0 animate-ping rounded-full",
              active ? "bg-emerald-300/70" : "bg-emerald-500/60",
            )}
          />
          <span
            className={cn(
              "relative h-1.5 w-1.5 rounded-full",
              active ? "bg-emerald-300" : "bg-emerald-500",
            )}
          />
        </span>
      )}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
          active
            ? "bg-background/20 text-background"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
