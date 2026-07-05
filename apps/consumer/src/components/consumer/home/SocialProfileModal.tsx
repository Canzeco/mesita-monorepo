"use client";

import { useState } from "react";
import Image from "next/image";
import { Crown, Instagram, X } from "lucide-react";
import type { SocialPerson } from "./social-feed-data";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

// Profile modal for the Social feed, on the shared LocalDialog (portals
// into the app card so the backdrop covers the whole surface, animated
// open AND close, ESC, z-[130]). Public API stays {person, onClose}:
// open derives from person, and the last non-null person is retained in
// state so the exit animation plays with its content still rendered.
//
// TODO(EF): social feed — profile stats are mock (see social-feed-data.ts).

export function SocialProfileModal({
  person,
  onClose,
}: {
  person: SocialPerson | null;
  onClose: () => void;
}) {
  // Retain the last shown person through close (render-time derived state,
  // guarded, per the React docs pattern) so the card doesn't blank out
  // mid-exit when the caller nulls `person`.
  const [retained, setRetained] = useState<SocialPerson | null>(person);
  if (person && person !== retained) setRetained(person);
  const shown = person ?? retained;

  const stats: { label: string; value: number }[] = shown
    ? [
        { label: "Visits", value: shown.stats.visits },
        { label: "Likes", value: shown.stats.likes },
        { label: "Stories", value: shown.stats.stories },
        { label: "Rewards", value: shown.stats.rewards },
      ]
    : [];

  return (
    <LocalDialog
      open={!!person}
      onClose={onClose}
      ariaLabel={shown ? `${shown.name} — profile` : "Profile"}
    >
      {shown && (
        <>
          {/* Branded banner moment behind the avatar */}
          <div className="from-primary/25 via-accent/25 h-20 bg-gradient-to-br to-amber-200/60" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-foreground/70 bg-background/70 hover:text-foreground absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="-mt-10 px-5 pb-5">
            <div className="relative inline-block">
              <Image
                src={shown.avatarUrl}
                alt={shown.name}
                width={80}
                height={80}
                className="ring-background h-20 w-20 rounded-full object-cover ring-4"
              />
              {shown.plan === "premium" && (
                <span className="bg-tier-premium ring-background absolute -bottom-0.5 -left-0.5 grid h-6 w-6 place-items-center rounded-full text-white ring-2">
                  <Crown className="h-3.5 w-3.5 fill-current" />
                </span>
              )}
              <span className="ring-background absolute -right-0.5 -bottom-0.5 grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white ring-2">
                <Instagram className="h-3.5 w-3.5" />
              </span>
            </div>

            <h2 className="font-display text-foreground mt-3 text-lg font-semibold tracking-tight">
              {shown.name}
            </h2>
            <p className="text-muted-foreground text-xs">
              <a
                href={`https://instagram.com/${shown.igHandle.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="text-foreground font-semibold underline decoration-[#d62976]/40 underline-offset-2 hover:decoration-[#d62976]"
              >
                {shown.igHandle}
              </a>
            </p>

            <div className="mt-3 flex gap-2">
              {shown.plan === "premium" && (
                <span className="bg-tier-premium inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-white">
                  <Crown className="h-3 w-3 fill-current" /> Premium
                </span>
              )}
              <span className="bg-muted text-muted-foreground inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold">
                Public profile
              </span>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="border-border bg-muted/40 rounded-xl border py-2"
                >
                  <p className="text-foreground text-base font-bold">
                    {s.value}
                  </p>
                  <p className="text-muted-foreground text-[10px] tracking-wider uppercase">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </LocalDialog>
  );
}
