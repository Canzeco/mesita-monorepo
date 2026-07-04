"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Crown, Instagram, X } from "lucide-react";
import type { SocialPerson } from "./social-feed-data";

// Profile modal for the Social feed. Follows the FilterSheet overlay
// pattern (fixed inset-0 + backdrop button) rather than pulling in a
// dialog dependency — the repo has no Radix primitives and this stays
// consistent with the rest of the consumer chrome.
//
// TODO(EF): social feed — profile stats are mock (see social-feed-data.ts).

export function SocialProfileModal({
  person,
  onClose,
}: {
  person: SocialPerson | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!person) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [person, onClose]);

  if (!person) return null;

  const stats: { label: string; value: number }[] = [
    { label: "Visits", value: person.stats.visits },
    { label: "Likes", value: person.stats.likes },
    { label: "Stories", value: person.stats.stories },
    { label: "Rewards", value: person.stats.rewards },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${person.name} — profile`}
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
    >
      <button
        type="button"
        aria-label="Close profile"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
      />

      <div className="border-border bg-popover shadow-elev animate-in fade-in zoom-in-95 relative w-full max-w-sm overflow-hidden rounded-3xl border duration-200">
        {/* Branded banner moment behind the avatar */}
        <div className="from-primary/25 via-accent/25 to-amber-200/60 h-20 bg-gradient-to-br" />
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
              src={person.avatarUrl}
              alt={person.name}
              width={80}
              height={80}
              className="ring-background h-20 w-20 rounded-full object-cover ring-4"
            />
            {person.plan === "premium" && (
              <span className="bg-tier-premium ring-background absolute -bottom-0.5 -left-0.5 grid h-6 w-6 place-items-center rounded-full text-white ring-2">
                <Crown className="h-3.5 w-3.5 fill-current" />
              </span>
            )}
            <span className="ring-background absolute -right-0.5 -bottom-0.5 grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white ring-2">
              <Instagram className="h-3.5 w-3.5" />
            </span>
          </div>

          <h2 className="font-display text-foreground mt-3 text-lg font-semibold tracking-tight">
            {person.name}
          </h2>
          <p className="text-muted-foreground text-xs">
            <a
              href={`https://instagram.com/${person.igHandle.replace(/^@/, "")}`}
              target="_blank"
              rel="noreferrer"
              className="text-foreground font-semibold underline decoration-[#d62976]/40 underline-offset-2 hover:decoration-[#d62976]"
            >
              {person.igHandle}
            </a>
          </p>

          <div className="mt-3 flex gap-2">
            {person.plan === "premium" && (
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
      </div>
    </div>
  );
}
