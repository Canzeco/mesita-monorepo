import { BadgeCheck, Instagram } from "lucide-react";

import { INSTAGRAM_ICON_GRADIENT_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export function InstagramConnectedSummary({ followers }: { followers: number }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm",
          INSTAGRAM_ICON_GRADIENT_CLASS,
        )}
      >
        <Instagram className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[14px] leading-none font-bold tracking-tight">
            Profile connected
          </span>
          <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        </div>
        <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
          {followers > 0
            ? `${followers.toLocaleString("en-US")} followers · Influencer active`
            : "Influencer active"}
        </p>
        {/* The Instagram door grants Influencer off follower count alone (no
            story-to-keep-it rule), but under segments v6 the Story rung is this
            class's EXCLUSIVE action — so lead with the upside, not the opt-out. */}
        <p className="text-muted-foreground/80 mt-0.5 text-[11px] leading-snug">
          The Instagram Story reward is yours alone — post one any visit for
          more off.
        </p>
      </div>
    </div>
  );
}
