"use client";

import { Check, Plus, Users } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { COMMUNITIES, useCommunities } from "@/lib/communities";
import { cn } from "@/lib/utils";

// Communities picker opened from the Me page's Communities box. Membership is
// client-only (localStorage) until the social graph ships — tap to join or
// leave; the profile summary reflects the joined set live.

export function CommunitiesModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isJoined, toggle, joinedIds } = useCommunities();

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Communities">
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Communities
            </h2>
            <p className="text-muted-foreground text-[12px]">
              {joinedIds.length > 0
                ? `${joinedIds.length} joined`
                : "Join your campus circles"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {COMMUNITIES.map((c) => {
            const joined = isJoined(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                aria-pressed={joined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]",
                  joined
                    ? "border-violet-500/40 bg-violet-500/[0.05]"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <span className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg">
                  {c.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{c.name}</span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {c.blurb}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition",
                    joined
                      ? "bg-violet-600 text-white"
                      : "border-border text-muted-foreground border",
                  )}
                >
                  {joined ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-muted-foreground mt-4 text-center text-[11px] leading-snug">
          Communities unlock circle-only perks at partner places. More coming
          soon.
        </p>
      </div>
    </LocalSheet>
  );
}
